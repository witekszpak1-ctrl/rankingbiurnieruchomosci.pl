"""Klient KRS Open API (Ministerstwo Sprawiedliwości). Publiczne API, bez klucza.

Kontrakt sprawdzony na prawdziwej odpowiedzi (10.11.2026):
GET {base}/api/krs/OdpisAktualny/{numer KRS}?rejestr=P&format=json
-> {"odpis": {"naglowekA": {...}, "dane": {"dzial1": {...}, "dzial3": {...}}}}

KRS NIE pozwala wyszukiwać po kodzie PKD ani po NIP-ie, tylko po numerze KRS. Numer KRS bierzemy z białej listy VAT.
Ważne pola: nazwa, forma prawna, NIP i REGON, adres siedziby, PKD (dział 3) oraz adresStronyInternetowej,
czyli oficjalna strona spółki, jeśli została wpisana.

Nie czytamy działu 2 (osoby: zarząd, wspólnicy) i nie zapisujemy go w cache.
"""

from __future__ import annotations

import time
from collections.abc import Callable

import httpx

from ..ids import normalize_krs
from .base import (
    MemoryCache,
    RegistryBlocked,
    RegistryCache,
    RegistryEntity,
    RegistryError,
    looks_blocked,
    normalize_website,
    parse_date,
)

SOURCE = "krs"
_RETRY_STATUSES = {429, 500, 502, 503, 504}


def _get(data, *path):
    for key in path:
        if not isinstance(data, dict):
            return None
        data = data.get(key)
    return data


def pkd_code(item: dict) -> str | None:
    """Składa kod PKD z pól KRS: ('19','20','Z') -> '19.20.Z'. Starsze wpisy bez podklasy dają np. '20.1'."""
    dzial, klasa, podklasa = item.get("kodDzial"), item.get("kodKlasa"), item.get("kodPodklasa")
    if not dzial or not klasa:
        return None
    base = f"{dzial}.{klasa}"
    return f"{base}.{podklasa}" if podklasa else base


def summarize_odpis(payload: dict) -> dict:
    """Wyciąga z odpisu tylko pola, których używamy (to zapisujemy w cache, bez osób z działu 2)."""
    odpis = payload.get("odpis") or {}
    subject = _get(odpis, "dane", "dzial1", "danePodmiotu") or {}
    address = _get(odpis, "dane", "dzial1", "siedzibaIAdres", "adres") or {}
    activity = _get(odpis, "dane", "dzial3", "przedmiotDzialalnosci") or {}
    return {
        "numerKRS": _get(odpis, "naglowekA", "numerKRS"),
        "dataRejestracjiWKRS": _get(odpis, "naglowekA", "dataRejestracjiWKRS"),
        "nazwa": subject.get("nazwa"),
        "formaPrawna": subject.get("formaPrawna"),
        "nip": _get(subject, "identyfikatory", "nip"),
        "regon": _get(subject, "identyfikatory", "regon"),
        "adres": {k: address.get(k) for k in ("ulica", "nrDomu", "nrLokalu", "miejscowosc", "kodPocztowy")},
        "www": _get(odpis, "dane", "dzial1", "siedzibaIAdres", "adresStronyInternetowej"),
        "pkdPrzewazajace": [c for c in (pkd_code(i) for i in activity.get("przedmiotPrzewazajacejDzialalnosci") or []) if c],
        "pkdPozostale": [c for c in (pkd_code(i) for i in activity.get("przedmiotPozostalejDzialalnosci") or []) if c],
    }


def entity_from_summary(summary: dict) -> RegistryEntity:
    address = summary.get("adres") or {}
    street_parts = [address.get("ulica"), address.get("nrDomu")]
    street = " ".join(str(p) for p in street_parts if p)
    if address.get("nrLokalu"):
        street += f"/{address['nrLokalu']}"
    return RegistryEntity(
        nip=summary.get("nip"),
        name=summary.get("nazwa") or "",
        source=SOURCE,
        regon=summary.get("regon"),
        krs=normalize_krs(summary.get("numerKRS")),
        legal_form=summary.get("formaPrawna"),
        website=normalize_website(summary.get("www")),
        street=street or None,
        postcode=address.get("kodPocztowy"),
        city=address.get("miejscowosc"),
        status_active=None,  # odpis aktualny nie mówi wprost o statusie, nie zgadujemy
        start_date=parse_date(summary.get("dataRejestracjiWKRS")),
        pkd_codes=list(summary.get("pkdPrzewazajace") or []) + list(summary.get("pkdPozostale") or []),
    )


class KrsClient:
    def __init__(
        self,
        base_url: str = "https://api-krs.ms.gov.pl",
        client: httpx.Client | None = None,
        cache: RegistryCache | None = None,
        *,
        max_retries: int = 2,
        cache_max_age_days: int = 30,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._client = client or httpx.Client(timeout=30.0, headers={"Accept": "application/json"})
        self._cache = cache if cache is not None else MemoryCache()
        self._max_retries = max_retries
        self._cache_max_age = cache_max_age_days
        self._sleep = sleep

    def fetch(self, krs_number: str) -> RegistryEntity | None:
        """Zwraca encję z aktualnego odpisu albo None, gdy numeru nie ma w rejestrze przedsiębiorców."""
        krs = normalize_krs(krs_number)
        if not krs:
            raise RegistryError(f"Nieprawidłowy numer KRS: {krs_number!r}")
        cached = self._cache.get(SOURCE, krs, self._cache_max_age)
        if cached is not None:
            return entity_from_summary(cached) if cached.get("found", True) and cached.get("nazwa") else None

        url = f"{self._base_url}/api/krs/OdpisAktualny/{krs}"
        params = {"rejestr": "P", "format": "json"}
        response: httpx.Response | None = None
        for attempt in range(self._max_retries + 1):
            response = self._client.get(url, params=params)
            blocked = looks_blocked(response.headers.get("content-type"), response.text)
            if (blocked or response.status_code in _RETRY_STATUSES) and attempt < self._max_retries:
                self._sleep(2.0 ** (attempt + 1))
                continue
            if blocked:
                raise RegistryBlocked("KRS zwrócił stronę ochrony przed botami zamiast JSON.")
            break
        assert response is not None
        if response.status_code == 404:
            self._cache.put(SOURCE, krs, {"found": False})
            return None
        if response.status_code != 200:
            raise RegistryError(f"KRS: HTTP {response.status_code}: {response.text[:200]}")
        try:
            payload = response.json()
        except ValueError as exc:
            raise RegistryError("KRS: odpowiedź nie jest poprawnym JSON.") from exc
        summary = summarize_odpis(payload)
        self._cache.put(SOURCE, krs, summary)
        return entity_from_summary(summary)
