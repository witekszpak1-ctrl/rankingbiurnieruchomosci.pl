"""Wspólne typy klientów rejestrów: encja, błędy, cache, pomocnicze parsowanie adresów i dat."""

from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Protocol

from ..urls import canonical_url
from ..verify import RegistryView


class RegistryError(RuntimeError):
    """Błąd odpytywania rejestru."""


class RegistryBlocked(RegistryError):
    """Zamiast JSON przyszła strona ochrony przed botami (np. Incapsula) z kodem 200."""


class QuotaExceeded(RegistryError):
    """Wyczerpany dzienny limit zapytań do API."""


@dataclass
class RegistryEntity:
    """Znormalizowany rekord rejestru. Zawiera wyłącznie pola biznesowe (bez przedstawicieli, PESEL, rachunków)."""

    nip: str | None
    name: str
    source: str  # mf_vat | krs | ceidg
    regon: str | None = None
    krs: str | None = None
    vat_status: str | None = None
    legal_form: str | None = None
    website: str | None = None
    street: str | None = None
    postcode: str | None = None
    city: str | None = None
    status_active: bool | None = None  # None = nieznane
    start_date: date | None = None
    pkd_codes: list[str] = field(default_factory=list)

    def to_view(self) -> RegistryView:
        return RegistryView(
            nip=self.nip or "",
            name=self.name,
            active=self.status_active,
            postcode=self.postcode,
            city=self.city,
            pkd_codes=list(self.pkd_codes),
        )


# ----------------------------------------------------------------------------- cache


class RegistryCache(Protocol):
    def get(self, source: str, key: str, max_age_days: int) -> dict | None: ...

    def put(self, source: str, key: str, payload: dict) -> None: ...


class MemoryCache:
    """Prosty cache w pamięci (testy, krótkie przebiegi). Produkcyjnie: DbCache z tabeli registry_cache."""

    def __init__(self, clock=time.time) -> None:
        self._data: dict[tuple[str, str], tuple[float, dict]] = {}
        self._clock = clock

    def get(self, source: str, key: str, max_age_days: int) -> dict | None:
        item = self._data.get((source, key))
        if item is None:
            return None
        fetched_at, payload = item
        if self._clock() - fetched_at > max_age_days * 86400:
            return None
        return payload

    def put(self, source: str, key: str, payload: dict) -> None:
        self._data[(source, key)] = (self._clock(), payload)


# ----------------------------------------------------------------------------- parsowanie

_POSTCODE_CITY = re.compile(r"(\d{2}-\d{3})\s+(.+?)\s*$")


def parse_address_string(text: str | None) -> tuple[str | None, str | None, str | None]:
    """'CHEMIKÓW 7, 09-411 PŁOCK' -> ('CHEMIKÓW 7', '09-411', 'PŁOCK'). Brak części daje None."""
    if not text:
        return None, None, None
    text = " ".join(text.split())
    match = _POSTCODE_CITY.search(text)
    if not match:
        return text, None, None
    street = text[: match.start()].strip().rstrip(",").strip() or None
    return street, match.group(1), match.group(2)


def parse_date(value: str | None) -> date | None:
    """Akceptuje 2026-11-10 oraz 10.11.2026 (format KRS)."""
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            continue
    return None


def normalize_website(value: str | None) -> str | None:
    if not value or not value.strip():
        return None
    text = value.strip()
    if " " in text or "." not in text:
        return None
    try:
        return canonical_url(text)
    except ValueError:
        return None


def looks_blocked(content_type: str | None, body: str) -> bool:
    """True, gdy odpowiedź to HTML (strona ochrony przed botami), a nie JSON."""
    head = body.lstrip()[:20].lower()
    if head.startswith("<"):
        return True
    return bool(content_type and "html" in content_type.lower())
