"""Miesięczne liczniki płatnych API z limitami (LiteScrape, opcjonalnie Serper i Brave).

Licznik jest w tabeli settings pod kluczem "api_usage":
    {"months": {"2026-11": {"litescrape": 812, "litescrape:fetch": 600, "litescrape:search": 90, ...}},
     "limits": {"litescrape": 100000, "serper": 2000}}
LiteScrape: klient liczy udane zapytania w pamięci i dopisuje je do licznika na końcu polecenia (add), a limit
miesięczny z panelu zamienia na budżet przebiegu. Saldo LiteScrape jest przedpłacone, więc bez doładowania i tak
nie da się wydać więcej, niż wpłacono. Miesiąc liczymy w UTC.

Google Places API jest wyłączone (za drogie). Historia jego licznika zostaje w ustawieniu do podglądu.
"""

from __future__ import annotations

import calendar
from datetime import datetime, timezone

SETTINGS_KEY = "api_usage"
DEFAULT_LIMITS: dict[str, int] = {}
KEEP_MONTHS = 12


def month_key(now: datetime | None = None) -> str:
    now = now or datetime.now(timezone.utc)
    return now.astimezone(timezone.utc).strftime("%Y-%m")


def days_left(now: datetime | None = None) -> int:
    """Dni do końca miesiąca razem z dzisiejszym (UTC)."""
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    return calendar.monthrange(now.year, now.month)[1] - now.day + 1


def limit_of(value: dict | None, service: str) -> int | None:
    """Limit z ustawień, a bez wpisu domyślny. Wartość 0 albo ujemna w ustawieniach wyłącza usługę."""
    limits = (value or {}).get("limits") or {}
    raw = limits.get(service, DEFAULT_LIMITS.get(service))
    if raw is None:
        return None
    try:
        return max(0, int(raw))
    except (TypeError, ValueError):
        return DEFAULT_LIMITS.get(service)


def used_in(value: dict | None, month: str, service: str) -> int | None:
    raw = (((value or {}).get("months") or {}).get(month) or {}).get(service)
    return int(raw) if isinstance(raw, (int, float)) else None


def reserve(value: dict | None, month: str, service: str, seed: int = 0, count: int = 1) -> tuple[bool, dict, int, int | None]:
    """Rezerwuje `count` zapytań w miesiącu. Zwraca (czy wolno, nowa wartość ustawienia, zużycie, limit).

    seed: zużycie przyjmowane, gdy w danym miesiącu nie ma jeszcze licznika (szacunek z danych sprzed licznika).
    Przy odmowie wartość jest zwracana bez zmian zużycia (ale z zapisanym szacunkiem początkowym).
    """
    value = dict(value or {})
    months = {k: dict(v) for k, v in (value.get("months") or {}).items()}
    current = dict(months.get(month) or {})
    used = current.get(service)
    used = int(used) if isinstance(used, (int, float)) else max(0, int(seed))
    limit = limit_of(value, service)
    allowed = limit is None or used + count <= limit
    if allowed:
        used += count
    current[service] = used
    months[month] = current
    # Zostawiamy historię ostatnich miesięcy do podglądu w panelu.
    for old in sorted(months)[:-KEEP_MONTHS]:
        months.pop(old, None)
    value["months"] = months
    return allowed, value, used, limit


def add(value: dict | None, month: str, counts: dict[str, int]) -> dict:
    """Dopisuje zużycie (bez sprawdzania limitu: zapytania już poszły). Zwraca nową wartość ustawienia."""
    value = dict(value or {})
    months = {k: dict(v) for k, v in (value.get("months") or {}).items()}
    current = dict(months.get(month) or {})
    for service, n in counts.items():
        if n:
            current[service] = int(current.get(service) or 0) + int(n)
    months[month] = current
    for old in sorted(months)[:-KEEP_MONTHS]:
        months.pop(old, None)
    value["months"] = months
    return value


def run_budget(used: int, limit: int | None, days: int, requested: int) -> int:
    """Ile zapytań wolno zrobić w tym przebiegu: reszta limitu rozłożona równo na pozostałe dni miesiąca.

    Dzięki temu nowe firmy dostają oceny przez cały miesiąc, a nie tylko w pierwszych dniach.
    """
    if limit is None:
        return max(0, requested)
    remaining = max(0, limit - used)
    if remaining == 0:
        return 0
    per_day = -(-remaining // max(1, days))  # zaokrąglenie w górę
    return max(0, min(requested, per_day, remaining))
