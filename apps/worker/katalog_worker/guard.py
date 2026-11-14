"""Kontrole po przebiegu robota (mechanizmy zabezpieczające z planu poprawy).

Po każdym przebiegu porównujemy katalog z poprzednim zaakceptowanym stanem (settings.guard_snapshot). Gdy któraś
kontrola nie przejdzie, ustawiamy settings.guard_block: publikacja (publish-ready, extra-cities) wstrzymuje się,
a krok kontroli kończy się błędem, więc przebieg na GitHubie jest oznaczony jako nieudany (powiadomienie e-mail).
Po sprawdzeniu przyczyny właściciel zatwierdza nowy stan: `katalog guard --accept` (workflow report, kontrola).

Kontrole:
- liczba biur w mieście zmieniła się o ponad 20% (miasta z co najmniej 5 biurami),
- opublikowana firma ma nazwę z listy odrzucanych (katalog_worker/names.py),
- przybyło grup firm z tym samym NIP-em albo tą samą domeną,
- udział biur bez potwierdzenia w rejestrze wzrósł o ponad 5 punktów procentowych.
"""

from __future__ import annotations


from collections import Counter, defaultdict
from datetime import UTC, datetime

from .names import is_bad_name, is_catalog_host, registrable_domain

CITY_CHANGE = 0.20
CITY_MIN = 5
UNCONFIRMED_PP = 5.0


def catalog_stats(repo) -> dict:
    rows = repo.published_listings_overview()
    cities: Counter = Counter(r["city_name"] for r in rows)
    brands: dict[str, dict] = {}
    for r in rows:
        brands.setdefault(str(r["brand_id"]), r)
    by_nip: dict[str, set] = defaultdict(set)
    by_domain: dict[str, set] = defaultdict(set)
    bad_names = []
    for brand_id, b in brands.items():
        if b["nip"]:
            by_nip[b["nip"]].add(brand_id)
        if b["host"] and not is_catalog_host(b["host"]):
            by_domain[registrable_domain(b["host"])].add(brand_id)
        if is_bad_name(b["brand_name"], b["host"]) or is_catalog_host(b["host"]):
            bad_names.append(b["brand_name"])
    unconfirmed = sum(1 for b in brands.values() if not b["nip"])
    return {
        "cities": dict(cities),
        "duplicate_groups": sum(1 for s in by_nip.values() if len(s) > 1) + sum(1 for s in by_domain.values() if len(s) > 1),
        "bad_names": sorted(bad_names),
        "unconfirmed_pct": round(100 * unconfirmed / len(brands), 2) if brands else 0.0,
        "brands": len(brands),
    }


def compare(previous: dict | None, current: dict) -> list[str]:
    """Problemy w obecnym stanie względem poprzedniego zaakceptowanego (pusta lista = w porządku)."""
    problems: list[str] = []
    if previous:
        for city, before in previous.get("cities", {}).items():
            after = current["cities"].get(city, 0)
            if before >= CITY_MIN and abs(after - before) > before * CITY_CHANGE:
                problems.append(f"{city}: liczba biur {before} -> {after}")
        for city, after in current["cities"].items():
            if city not in previous.get("cities", {}) and after >= CITY_MIN * 2:
                problems.append(f"{city}: nowe miasto od razu z {after} biurami")
        if current["duplicate_groups"] > previous.get("duplicate_groups", 0):
            problems.append(f"grupy firm z tym samym NIP-em lub domeną: {previous.get('duplicate_groups', 0)} -> {current['duplicate_groups']}")
        old_bad = set(previous.get("bad_names", []))
        new_bad = [n for n in current["bad_names"] if n not in old_bad]
        if new_bad:
            problems.append("nazwy z listy odrzucanych: " + ", ".join(new_bad[:10]))
        if current["unconfirmed_pct"] - previous.get("unconfirmed_pct", 0.0) > UNCONFIRMED_PP:
            problems.append(f"udział biur bez rejestru: {previous.get('unconfirmed_pct')}% -> {current['unconfirmed_pct']}%")
    # Pierwszy przebieg (bez zapisanego stanu) tylko zapisuje stan wyjściowy.
    return problems


def run_guard(repo, accept: bool = False) -> dict:
    current = catalog_stats(repo)
    previous = repo.setting("guard_snapshot", None)
    now = datetime.now(UTC).isoformat(timespec="seconds")
    if accept:
        repo.set_setting("guard_snapshot", {**current, "accepted_at": now})
        repo.set_setting("guard_block", None)
        repo.write_audit("pipeline", "guard.accept", "settings", "guard_snapshot", None, {"at": now})
        repo.conn.commit()
        return {"accepted": True, "brands": current["brands"]}
    problems = compare(previous, current)
    if problems:
        repo.set_setting("guard_block", {"at": now, "problems": problems})
        repo.write_audit("pipeline", "guard.block", "settings", "guard_block", None, {"problems": problems})
    else:
        repo.set_setting("guard_snapshot", {**current, "accepted_at": now})
        repo.set_setting("guard_block", None)
    repo.conn.commit()
    return {"ok": not problems, "problems": problems, "brands": current["brands"]}


def publishing_blocked(repo) -> list[str] | None:
    block = repo.setting("guard_block", None)
    return block.get("problems") if isinstance(block, dict) else None



