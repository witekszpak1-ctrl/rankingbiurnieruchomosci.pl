"""Klient białej listy VAT (Ministerstwo Finansów). Publiczne API, bez klucza.

Kontrakt sprawdzony na prawdziwych odpowiedziach (10.11.2026):
GET {base}/api/search/nips/{nip1,nip2,...}?date=YYYY-MM-DD  (do 30 NIP-ów w zapytaniu)
-> {"result": {"entries": [{"identifier": "<nip>", "subjects": [ {...} ]} lub {"identifier", "error": {"code", "message"}}]}}

Ustalenia z testów na żywo:
- limit: 100 zapytań dziennie, do 30 NIP-ów w zapytaniu (wg strony gov.pl),
- przed API stoi ochrona Incapsula, która potrafi zwrócić HTML z kodem 200. Klient to wykrywa, ponawia z
  odstępem i kończy błędem RegistryBlocked. Z adresów centrów danych blokada może być częsta,
- nie zapisujemy przedstawicieli, PESEL ani numerów rachunków (dane osobowe i zbędne).
"""

from __future__ import annotations

import time
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import date

import httpx

from ..ids import is_valid_nip, normalize_nip
from .base import (
    MemoryCache,
    QuotaExceeded,
    RegistryBlocked,
    RegistryCache,
    RegistryEntity,
    RegistryError,
    looks_blocked,
    parse_address_string,
    parse_date,
)

SOURCE = "mf_vat"
BATCH_SIZE = 30
_KEEP_FIELDS = (
    "name", "nip", "statusVat", "regon", "krs", "residenceAddress", "workingAddress",
    "registrationLegalDate", "registrationDenialDate", "restorationDate", "removalDate", "exemptionSmeDate",
)
_RETRY_STATUSES = {429, 500, 502, 503, 504}


@dataclass
class MfResult:
    nip: str
    entity: RegistryEntity | None  # None = brak w wykazie albo błąd
    error: str | None = None  # kod błędu (np. WL-115) lub invalid_nip


def sanitize_subject(subject: dict) -> dict:
    """Zostawia tylko pola biznesowe. Reszta (osoby, rachunki, PESEL) jest odrzucana."""
    return {key: subject.get(key) for key in _KEEP_FIELDS}


def entity_from_subject(subject: dict) -> RegistryEntity:
    krs = subject.get("krs")
    working = subject.get("workingAddress")
    residence = subject.get("residenceAddress")
    if working:
        street, postcode, city = parse_address_string(working)
    elif krs:
        street, postcode, city = parse_address_string(residence)  # siedziba spółki
    else:
        # Osoba fizyczna bez adresu działalności: adres zamieszkania jest daną prywatną,
        # zachowujemy tylko miejscowość i kod pocztowy.
        _, postcode, city = parse_address_string(residence)
        street = None
    vat_status = subject.get("statusVat")
    removed = subject.get("removalDate")
    active = True if vat_status in ("Czynny", "Zwolniony") and not removed else None
    return RegistryEntity(
        nip=subject.get("nip"),
        name=subject.get("name") or "",
        source=SOURCE,
        regon=subject.get("regon"),
        krs=krs,
        vat_status=vat_status,
        street=street,
        postcode=postcode,
        city=city,
        status_active=active,
        start_date=parse_date(subject.get("registrationLegalDate")),
    )


def parse_entries(payload: dict) -> list[MfResult]:
    """Parsuje odpowiedź zbiorczą. Wpis bez podmiotu daje entity=None, wpis z błędem daje kod błędu."""
    results: list[MfResult] = []
    for entry in (payload.get("result") or {}).get("entries") or []:
        nip = str(entry.get("identifier") or "")
        error = entry.get("error")
        if error:
            results.append(MfResult(nip, None, str(error.get("code") or "error")))
            continue
        subjects = entry.get("subjects") or []
        results.append(MfResult(nip, entity_from_subject(subjects[0]) if subjects else None))
    return results


class MfVatClient:
    def __init__(
        self,
        base_url: str = "https://wl-api.mf.gov.pl",
        client: httpx.Client | None = None,
        cache: RegistryCache | None = None,
        *,
        max_requests_per_day: int = 100,
        max_retries: int = 2,
        cache_max_age_days: int = 7,
        today: Callable[[], date] = date.today,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._client = client or httpx.Client(timeout=30.0, headers={"Accept": "application/json"})
        self._cache = cache if cache is not None else MemoryCache()
        self._max_requests = max_requests_per_day
        self._max_retries = max_retries
        self._cache_max_age = cache_max_age_days
        self._today = today
        self._sleep = sleep
        self.requests_made = 0

    # ------------------------------------------------------------------ API publiczne

    def lookup(self, nips: Iterable[str]) -> dict[str, MfResult]:
        """Sprawdza NIP-y (z cache, potem partiami po 30). Nieprawidłowe NIP-y nie generują zapytań."""
        results: dict[str, MfResult] = {}
        pending: list[str] = []
        for raw in nips:
            nip = normalize_nip(raw)
            if not nip or not is_valid_nip(nip):
                results[str(raw)] = MfResult(str(raw), None, "invalid_nip")
                continue
            if nip in results or nip in pending:
                continue
            cached = self._cache.get(SOURCE, nip, self._cache_max_age)
            if cached is not None:
                subject = cached.get("subject")
                results[nip] = MfResult(nip, entity_from_subject(subject) if subject else None)
            else:
                pending.append(nip)
        for start in range(0, len(pending), BATCH_SIZE):
            for result in self._fetch_batch(pending[start : start + BATCH_SIZE]):
                results[result.nip] = result
        return results

    # ------------------------------------------------------------------ wewnętrzne

    def _fetch_batch(self, nips: list[str]) -> list[MfResult]:
        url = f"{self._base_url}/api/search/nips/{','.join(nips)}"
        params = {"date": self._today().isoformat()}
        response: httpx.Response | None = None
        for attempt in range(self._max_retries + 1):
            if self.requests_made >= self._max_requests:
                raise QuotaExceeded(f"Wyczerpany limit {self._max_requests} zapytań do białej listy VAT.")
            self.requests_made += 1
            response = self._client.get(url, params=params)
            blocked = looks_blocked(response.headers.get("content-type"), response.text)
            if (blocked or response.status_code in _RETRY_STATUSES) and attempt < self._max_retries:
                self._sleep(2.0 ** (attempt + 1))
                continue
            if blocked:
                raise RegistryBlocked("Biała lista VAT zwróciła stronę ochrony przed botami zamiast JSON.")
            break
        assert response is not None
        if response.status_code == 429:
            raise QuotaExceeded("Biała lista VAT: HTTP 429 (limit zapytań).")
        if response.status_code != 200:
            raise RegistryError(f"Biała lista VAT: HTTP {response.status_code}: {response.text[:200]}")
        try:
            payload = response.json()
        except ValueError as exc:
            raise RegistryError("Biała lista VAT: odpowiedź nie jest poprawnym JSON.") from exc

        results = parse_entries(payload)
        by_nip = {entry.get("identifier"): entry for entry in (payload.get("result") or {}).get("entries") or []}
        for result in results:
            if result.error:
                continue  # błędów nie cache'ujemy
            entry = by_nip.get(result.nip) or {}
            subjects = entry.get("subjects") or []
            subject = sanitize_subject(subjects[0]) if subjects else None
            self._cache.put(SOURCE, result.nip, {"subject": subject})
        return results
