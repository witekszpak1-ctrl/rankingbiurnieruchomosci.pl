"""Orkiestracja etapów pipeline'u (S1-S7). Każdy etap jest funkcją na Context i commituje po jednej domenie.

S1 discover    : zapytania -> domeny kandydatów
S3 probe       : strona główna i kontakt -> klasyfikacja heurystyczna (bez LLM)
S4 verify      : NIP ze strony -> biała lista VAT i KRS -> dopasowanie podmiotu, brand, wpis (listing)
S5 crawl_deep  : kolejne podstrony zweryfikowanych domen (cennik, usługi, o nas)
S6 bundle      : paczki dla Claude Code (opis, ceny, spory klasyfikacji)
S7 import      : walidator wyników z kolejki plikowej i zapis w bazie
"""

from __future__ import annotations

import hashlib
import json
import os
import threading
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from collections.abc import Callable, Iterable, Iterator
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlsplit

from .bundle import ContactLeakError, Fact, build_classify_bundle, build_describe_bundle, facts_from_pages, write_bundle
from .classify import DEFAULT_BLOCKLIST, Classification, classify_page
from .discovery import discover
from .names import better_name, is_bad_name, is_catalog_host, name_from_registry, name_from_titles, registrable_domain, title_segments
from .city import SOURCE_LABEL, AddressHit, CityDecision, decide_city, known_cities, parse_address_fact
from .extract import PageExtraction, _e164, extract_page, merge_extractions
from .fetch import FetchResult, PoliteFetcher
from .offers import scan_offers
from .queries import build_queries
from .registry import KrsClient, MfVatClient, RegistryEntity, RegistryError
from .repo import Repo, slugify
from .search.base import SearchError, SearchProvider
from .urls import canonical_url, pick_pages, registrable_domain, is_legal_url, pick_legal_pages
from .validate import validate_result
from .verify import Verification, _page_names, name_similarity, verify_domain
from .verticals import VerticalConfig

_CONTACT_RE = re.compile(r"kontakt|contact", re.I)
_FACT_METHOD = {"meta_description": "meta", "site_title": "meta", "address": "jsonld", "address_hint": "regex"}


@dataclass
class Context:
    repo: Repo
    vertical: VerticalConfig
    snapshots_dir: Path
    queue_dir: Path
    blocklist: dict[str, str] = field(default_factory=lambda: dict(DEFAULT_BLOCKLIST))

    @property
    def keywords(self) -> list[str]:
        return self.vertical.keywords


# ----------------------------------------------------------------------------- snapshoty


def _store_snapshot(ctx: Context, host: str, html: str) -> tuple[str, str]:
    digest = hashlib.sha256(html.encode("utf-8")).hexdigest()
    path = ctx.snapshots_dir / host / f"{digest[:32]}.html"
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text(html, encoding="utf-8")
    return digest, str(path)


def _save_page(ctx: Context, domain_id: str, host: str, result: FetchResult) -> None:
    digest, path = _store_snapshot(ctx, host, result.text)
    ctx.repo.record_page(domain_id, canonical_url(result.final_url), result.status, digest, path, "httpx", True, result.size)


def _load_pages(ctx: Context, domain_id: str) -> list[PageExtraction]:
    """Strony domeny z lokalnych zrzutów. Zrzuty z innego runnera mogą nie istnieć: takie pomijamy."""
    pages = []
    for row in ctx.repo.pages_for_domain(domain_id):
        path = Path(row["storage_path"])
        if not path.is_file():
            continue
        pages.append(extract_page(path.read_text(encoding="utf-8"), row["url"]))
    return pages


# ----------------------------------------------------------------------------- równoległe pobieranie

def _crawler_workers() -> int:
    """Ile domen pobierać naraz (CRAWLER_WORKERS, domyślnie 8). Każda domena ma jeden wątek, więc odstęp między
    zapytaniami do jednego hosta zostaje bez zmian; równolegle idą tylko różne biura."""
    try:
        return max(1, min(32, int(os.environ.get("CRAWLER_WORKERS", "8"))))
    except ValueError:
        return 8


def _fetch_parallel(fetcher, items: Iterable, work: Callable) -> Iterator[tuple]:
    """Wywołuje work(fetcher_wątku, item) dla każdej pozycji w kilku wątkach i zwraca (item, wynik) w kolejności
    ukończenia. work może tylko pobierać strony i je analizować: zapis do bazy robi wywołujący w głównym wątku.
    Fetcher bez metody clone (np. testowy) albo CRAWLER_WORKERS=1 oznacza pracę po kolei."""
    items = list(items)
    workers = _crawler_workers()
    if workers == 1 or len(items) <= 1 or not hasattr(fetcher, "clone"):
        for item in items:
            yield item, work(fetcher, item)
        return
    local = threading.local()

    def run(item):
        if not hasattr(local, "fetcher"):
            local.fetcher = fetcher.clone()
        return work(local.fetcher, item)

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(run, item): item for item in items}
        for future in as_completed(futures):
            yield futures[future], future.result()


# ----------------------------------------------------------------------------- S1


def stage_discover(
    ctx: Context,
    provider: SearchProvider,
    city: str,
    *,
    max_queries: int | None = None,
    queries: list[str] | None = None,
    source_sha256: str | None = None,
) -> dict:
    """Odkrywa domeny kandydatów. Zapytania pochodzą z szablonów branży albo (dostawca z pliku) z podanej listy.

    source_sha256: suma pliku z wynikami. Ten sam plik nie jest importowany drugi raz.
    """
    repo = ctx.repo
    if source_sha256 and repo.candidate_source_imported(source_sha256):
        return {"skipped_already_imported": 1}
    vertical_id = repo.ensure_vertical(ctx.vertical)
    run_id = repo.start_run("discover", vertical_id)
    if queries is None:
        queries = build_queries(ctx.vertical.search, city, limit=max_queries)
    search_cfg = ctx.vertical.search
    query_params = {"country": search_cfg.country, "lang": search_cfg.language}
    if source_sha256:
        query_params["source_sha256"] = source_sha256

    def log_query(query, results, stat) -> None:
        query_id = repo.record_query(
            run_id, vertical_id, provider.name, query, query_params,
            stat.results, stat.new_candidates, stat.cost_usd,
        )
        repo.record_results(
            query_id, [(r.url, registrable_domain(r.url), r.rank) for r in results if registrable_domain(r.url)]
        )

    candidates, stats = discover(
        provider, queries, ctx.blocklist, country=search_cfg.country, lang=search_cfg.language,
        known_hosts=repo.known_hosts(), on_query=log_query,
    )
    new_domains = 0
    for candidate in candidates:
        _, is_new = repo.upsert_domain(candidate.host, candidate.home_url, city)
        new_domains += is_new
    counts = {"queries": len(stats), "candidates": len(candidates), "new_domains": new_domains,
              "blocked_results": sum(s.blocked for s in stats)}
    repo.finish_run(run_id, "ok", counts, cost_usd=round(sum(s.cost_usd for s in stats), 4))
    repo.mark_city_searched(city)
    repo.conn.commit()
    return counts


# ----------------------------------------------------------------------------- szukanie przez API (kolejka miast)

def _pages(query: str, pages: int) -> list[str]:
    return [query] + [f"{query} (strona {n})" for n in range(2, pages + 1)]


def city_queries(ctx: Context, city: str, deep: bool, districts: dict[str, list[str]]) -> list[str]:
    """Zapytania tak, jak szuka klient: "biuro nieruchomości", "agencja nieruchomości", "pośrednik nieruchomości",
    z kolejnymi stronami wyników Google zamiast fraz typu "sprzedaż domów", które zwracają deweloperów i portale.
    Zwykłe miasto: 6 zapytań. Duże: więcej stron wyników i po jednym zapytaniu na dzielnicę."""
    if not deep:
        return _pages(f"biuro nieruchomości {city}", 3) + _pages(f"agencja nieruchomości {city}", 2) + [
            f"pośrednik nieruchomości {city}"
        ]
    queries = (
        _pages(f"biuro nieruchomości {city}", 5)
        + _pages(f"agencja nieruchomości {city}", 4)
        + _pages(f"pośrednik nieruchomości {city}", 2)
        + _pages(f"biura nieruchomości {city}", 2)
    )
    for district in districts.get(city, []):
        queries.append(f"biuro nieruchomości {city} {district}")
    return queries


def cities_to_search(ctx: Context, limit: int) -> list[dict]:
    """Miasta z kolejki panelu, które trzeba przeszukać: nigdy nieszukane albo z dokładnym przeszukaniem zleconym później."""
    out = []
    for row in ctx.repo.city_search_queue():
        last, requested = row["last_searched_at"], row["deep_requested_at"]
        if last is None or (requested is not None and requested > last):
            out.append({"name": row["name"], "deep": bool(row["deep"]) or requested is not None})
        if len(out) >= limit:
            break
    return out


def stage_discover_queue(ctx: Context, provider: SearchProvider, cities: int, districts: dict[str, list[str]]) -> dict:
    """Szuka biur przez API wyszukiwarki w kolejnych miastach z kolejki (zamiast plików od Claude)."""
    totals: Counter = Counter()
    done = []
    for city in cities_to_search(ctx, cities):
        queries = city_queries(ctx, city["name"], city["deep"], districts)
        try:
            counts = stage_discover(ctx, provider, city["name"], queries=queries)
        except SearchError as exc:
            # np. skończone kredyty: zapisujemy co się udało, reszta miast poczeka na następny przebieg
            ctx.repo.conn.rollback()
            totals["search_errors"] += 1
            done.append(f"{city['name']}: błąd wyszukiwarki ({str(exc)[:120]})")
            break
        for key, value in counts.items():
            if isinstance(value, int):
                totals[key] += value
        done.append(f"{city['name']}{' (dokładnie)' if city['deep'] else ''}: {counts.get('new_domains', 0)}")
        print(json.dumps({"city": city["name"], "deep": city["deep"], **counts}, ensure_ascii=False), file=sys.stderr)
    totals["cities"] = len(done)
    return {**dict(totals), "detail": done}


# ----------------------------------------------------------------------------- miasta


def read_city_list(path: Path) -> list[str]:
    """Miasta z pliku branży (jedno w wierszu, # to komentarz), bez powtórzeń, w kolejności z pliku."""
    seen: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        name = line.strip()
        if name and not name.startswith("#") and name not in seen:
            seen.append(name)
    return seen


def stage_cities_sync(ctx: Context, names: list[str]) -> dict:
    """Dopisuje miasta z listy branży do bazy. Kolejność z panelu (search_priority) nie jest nadpisywana."""
    repo = ctx.repo
    added = 0
    for index, name in enumerate(names):
        added += repo.ensure_city_with_priority(name, index + 1)
    repo.conn.commit()
    return {"cities": len(names), "added": added}


def cities_export(ctx: Context) -> dict:
    """Kolejka miast do wyszukiwania dla porannej sesji Claude Code (queue/cities.json na gałęzi queue-data)."""
    rows = ctx.repo.city_search_queue()
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "note": "Miasta włączone w panelu, w kolejności szukania: najpierw zlecone do dokładnego przeszukania, potem te, "
                "w których jeszcze nie szukano. deep = przeszukać dokładnie (dzielnice i rodzaje usług).",
        "cities": [
            {"name": r["name"], "slug": r["slug"], "deep": bool(r["deep"]),
             "deep_requested_at": r["deep_requested_at"].isoformat() if r["deep_requested_at"] else None,
             "last_searched_at": r["last_searched_at"].isoformat() if r["last_searched_at"] else None}
            for r in rows
        ],
    }


# ----------------------------------------------------------------------------- S3


def _probe_fetch(fetcher: PoliteFetcher, row: dict) -> tuple[FetchResult, list[tuple[FetchResult, PageExtraction]]]:
    """Część sieciowa etapu probe (bez bazy): strona główna, kontakt i w razie potrzeby strony prawne."""
    home = fetcher.fetch(row["canonical_url"] or f"https://{row['host']}/")
    if not home.ok:
        return home, []
    fetched = [(home, extract_page(home.text, home.final_url))]
    # Strona kontaktu (tam zwykle jest NIP) wybierana spośród wszystkich ocenionych podstron, bo cennik i "o nas"
    # dostają więcej punktów i wypychały ją poza czołówkę.
    picks = pick_pages(fetched[0][1].links, home.final_url, limit=50)
    contact = next((u for u in picks if _CONTACT_RE.search(u)), None)
    if contact and contact != canonical_url(home.final_url):
        extra = fetcher.fetch(contact)
        if extra.ok:
            fetched.append((extra, extract_page(extra.text, extra.final_url)))
    if not any(page.nips for _, page in fetched):
        # Brak NIP na stronie głównej i w kontakcie: szukamy go w polityce prywatności albo regulaminie.
        for legal_url in pick_legal_pages(fetched[0][1].links, home.final_url, limit=2):
            extra = fetcher.fetch(legal_url)
            if extra.ok:
                page = extract_page(extra.text, extra.final_url)
                fetched.append((extra, page))
                if page.nips:
                    break
    return home, fetched


def stage_probe(ctx: Context, fetcher: PoliteFetcher, limit: int = 50) -> dict:
    repo = ctx.repo
    counts: Counter = Counter()
    run_id = repo.start_run("probe", None)
    repo.conn.commit()
    rows = list(repo.domains_to_probe(limit))
    for row, (home, fetched) in _fetch_parallel(fetcher, rows, _probe_fetch):
        if home.error == "robots_unreachable":
            # robots.txt chwilowo niedostępny: nie pobieramy strony, ale nie odrzucamy jej na stałe (próba za dobę).
            repo.touch_domain(row["id"], ["robots.txt niedostępny (błąd sieci lub serwera), ponowna próba później"])
            counts["robots_unreachable"] += 1
            repo.conn.commit()
            continue
        if home.error == "robots":
            repo.update_domain_classification(
                row["id"], "unknown", ["robots.txt zabrania pobierania"], robots_status="disallowed",
                verification_status="rejected",
            )
            counts["robots_disallowed"] += 1
            repo.conn.commit()
            continue
        if not home.ok:
            repo.touch_domain(row["id"], [f"pobranie nie powiodło się: {home.error}"], "allowed" if home.robots_allowed else None)
            counts["fetch_error"] += 1
            repo.conn.commit()
            continue

        merged = merge_extractions([page for _, page in fetched])
        classification = classify_page(merged, ctx.keywords, ctx.blocklist)
        for result, _ in fetched:
            _save_page(ctx, row["id"], row["host"], result)
        keep = classification.label in ("official", "uncertain")
        repo.update_domain_classification(
            row["id"], classification.label, classification.reasons, robots_status="allowed",
            verification_status=None if keep else "rejected",
        )
        counts[classification.label] += 1
        repo.conn.commit()
    repo.finish_run(run_id, "ok", dict(counts))
    repo.conn.commit()
    return dict(counts)


# ----------------------------------------------------------------------------- S4


def _fold(text: str) -> str:
    text = text.lower().replace("ł", "l")
    return "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))


def mentions_city(text: str, city: str) -> bool:
    """Czy tekst wymienia miasto, także w odmianie (Wrocław, we Wrocławiu, Kraków, w Krakowie).

    Całe słowa, nie początek nazwy: "ul. Warszawska" to nie Warszawa, "Lubliniec" to nie Lublin.
    """
    return offer_mentions_city(_tokens(text), _tokens(city))


def city_decision(
    registry_city: str | None,
    city_hint: str | None,
    pages: list[PageExtraction],
    known: dict[tuple[str, ...], str] | None = None,
    brand_name: str = "",
    host: str = "",
) -> CityDecision:
    """Miasto wpisu z dowodów na stronach firmy i w rejestrze (kolejność źródeł: katalog_worker/city.py)."""
    hits = [AddressHit(h.postcode, h.city, h.context) for p in pages for h in p.postcodes]
    return decide_city(registry_city, city_hint, " ".join(p.text for p in pages), hits, known, brand_name, host)


def listing_city(registry_city: str | None, city_hint: str | None, pages_text: str,
                 address_hits: list[AddressHit] | None = None) -> str | None:
    """Samo miasto z city_decision (dla testów i prostych wywołań)."""
    return decide_city(registry_city, city_hint, pages_text, address_hits or []).city


# Źródła, na podstawie których automat może przenieść wpis do innego miasta (sama wzmianka nie wystarcza).
STRONG_CITY_SOURCES = frozenset({"adres_wyszukiwanie", "rejestr_adres", "rejestr", "adres"})


def brand_city_decision(repo: Repo, brand_id: str, city_hint: str | None, brand_name: str,
                        known: dict[tuple[str, ...], str]) -> CityDecision:
    """city_decision z danych zapisanych w bazie: adresy z faktów, siedziba z rejestru, tekst faktów."""
    hits = [h for h in (parse_address_fact(r["value"], r["quote"]) for r in repo.brand_address_facts(brand_id)) if h]
    return decide_city(repo.brand_registry_city(brand_id), city_hint, repo.brand_fact_text(brand_id), hits, known,
                       brand_name, repo.brand_host(brand_id) or "")


def _brand_name(pages: list[PageExtraction], entity: RegistryEntity | None) -> str | None:
    """Nazwa marki ze strony; nazwy stron ("Strona główna", "Home", sama domena) pomijamy (katalog_worker/names.py).

    Kolejno: og:site_name, dane strukturalne, człony tytułu strony głównej, najczęstszy człon tytułów podstron,
    nazwa z rejestru. None, gdy firma bez rejestru nie ma żadnej dobrej nazwy (wtedy nie trafia do katalogu).
    """
    home = pages[0]
    host = urlsplit(home.url).hostname or ""
    candidates = [home.og_site_name]
    candidates += [str(o["name"]) for o in home.organizations if o.get("name")]
    candidates += title_segments(home.title)
    for name in candidates:
        if name and 2 <= len(name) <= 80 and not is_bad_name(name, host):
            return name.strip()
    from_titles = name_from_titles([p.title for p in pages], host)
    if from_titles:
        return from_titles
    if entity is None:
        return None
    return name_from_registry(entity.name) or entity.name.title()


def _pick_entity(entities: list[RegistryEntity], pages: list[PageExtraction]) -> RegistryEntity | None:
    if not entities:
        return None
    if len(entities) == 1:
        return entities[0]
    names = _page_names(pages)
    return max(entities, key=lambda e: max((name_similarity(e.name, n) for n in names), default=0.0))


def stage_verify(ctx: Context, mf: MfVatClient, krs: KrsClient, limit: int = 50) -> dict:
    repo = ctx.repo
    vertical_id = repo.ensure_vertical(ctx.vertical)
    counts: Counter = Counter()
    run_id = repo.start_run("verify", vertical_id)
    repo.conn.commit()

    loaded: list[tuple[dict, list[PageExtraction], PageExtraction]] = []
    for row in repo.domains_to_verify(limit):
        pages = _load_pages(ctx, row["id"])
        if pages:
            loaded.append((row, pages, merge_extractions(pages)))
        else:
            # Zrzuty stron zniknęły (cache Actions trzyma je ograniczony czas): bez nich domena utknęłaby tu na
            # zawsze, więc wraca do probe, które pobierze strony od nowa i ją sklasyfikuje.
            repo.requeue_probe(row["id"], "brak zapisanych stron, ponowne pobranie")
            counts["requeued_no_snapshots"] += 1
    repo.conn.commit()
    all_nips = sorted({hit.value for _, _, merged in loaded for hit in merged.nips})
    lookups = mf.lookup(all_nips) if all_nips else {}
    known = known_cities(repo.city_names())

    for row, pages, merged in loaded:
        entities = [lookups[h.value].entity for h in merged.nips if h.value in lookups and lookups[h.value].entity]
        entity = _pick_entity(entities, pages)
        if entity and entity.krs:
            try:
                enriched = krs.fetch(entity.krs)
            except RegistryError:
                enriched = None
            if enriched:
                entity.pkd_codes = enriched.pkd_codes
                entity.legal_form = enriched.legal_form
                entity.website = enriched.website
                entity.start_date = enriched.start_date or entity.start_date
                entity.source = "krs"
        classification = Classification(row["classification"], 0.5, [])
        verification = verify_domain(
            entity.to_view() if entity else None, pages, classification, ctx.keywords,
            ctx.vertical.registry.expected_pkd,
        )
        if entity is None and merged.nips and verification.status == "candidate":
            verification = Verification(0, "needs_review", None, ["NIP ze strony nie występuje w wykazie VAT"])

        legal_entity_id = brand_id = None
        if entity is None and verification.status == "needs_review" and row["classification"] in ("official", "uncertain"):
            # Biuro bez potwierdzenia w rejestrze (np. brak NIP na stronie): trafia do katalogu z niższym rankingiem.
            # Strony "niepewne" też dostają markę: o tym, czy to biuro, decyduje sesja opisów (pomija urzędy,
            # portale i deweloperów), a bez marki taka domena nigdy by do niej nie trafiła.
            name = _brand_name(pages, None)
            if not name and not row.get("brand_id"):
                counts["bad_name"] += 1  # same nazwy stron ("Strona główna") i brak rejestru: nie dodajemy
                repo.update_domain_verification(row["id"], verification.score, "needs_review", None, None,
                                                [*verification.reasons, "brak nazwy firmy na stronie"])
                repo.conn.commit()
                continue
            brand_id = row.get("brand_id") or repo.insert_unregistered_brand(name)
            decision = city_decision(None, row["city_hint"], pages, known, name or "", row["host"])
            if decision.city:
                listing_id = repo.upsert_listing(brand_id, vertical_id, repo.ensure_city(decision.city), "needs_review")
                repo.set_listing_city_source(listing_id, decision.source)
            else:
                counts["city_unconfirmed"] += 1
        elif entity and verification.status != "rejected":
            legal_entity_id = repo.upsert_legal_entity(entity)
            name = _brand_name(pages, entity)
            brand_id = repo.upsert_brand(legal_entity_id, name)
            decision = city_decision(entity.city, row["city_hint"], pages, known, name, row["host"])
            if decision.city:
                listing_status = "verified" if verification.status == "verified" else "needs_review"
                listing_id = repo.upsert_listing(brand_id, vertical_id, repo.ensure_city(decision.city), listing_status)
                repo.set_listing_city_source(listing_id, decision.source)
            else:
                counts["city_unconfirmed"] += 1
        repo.update_domain_verification(
            row["id"], verification.score, verification.status, legal_entity_id, brand_id, verification.reasons
        )
        counts[verification.status] += 1
        repo.conn.commit()
    counts["mf_requests"] = mf.requests_made
    repo.finish_run(run_id, "ok", dict(counts))
    repo.conn.commit()
    return dict(counts)


def stage_reverify(ctx: Context, mf: MfVatClient, krs: KrsClient, limit: int = 100) -> dict:
    """Ponowna weryfikacja biur bez potwierdzenia, na wszystkich pobranych podstronach.

    Pierwsza weryfikacja (stage_verify) widzi tylko stronę główną, kontakt i stronę prawną. Podstrony dobrane
    później (crawl-deep) często podają NIP. Gdy NIP jest w wykazie VAT, marka dostaje podmiot z rejestru,
    a wpis status zweryfikowanego (opublikowany wpis zostaje opublikowany). Każda domena raz na 30 dni.
    """
    repo = ctx.repo
    vertical_id = repo.ensure_vertical(ctx.vertical)
    counts: Counter = Counter()
    loaded: list[tuple[dict, list[PageExtraction], PageExtraction]] = []
    for row in repo.domains_to_reverify(limit):
        pages = _load_pages(ctx, row["id"])
        if not pages:
            counts["no_snapshots"] += 1  # zrzuty z innego runnera: spróbujemy przy kolejnym przebiegu
            continue
        loaded.append((row, pages, merge_extractions(pages)))
    all_nips = sorted({hit.value for _, _, merged in loaded for hit in merged.nips})
    lookups = mf.lookup(all_nips) if all_nips else {}

    for row, pages, merged in loaded:
        domain_id, brand_id = str(row["id"]), str(row["brand_id"])
        entities = [lookups[h.value].entity for h in merged.nips if h.value in lookups and lookups[h.value].entity]
        entity = _pick_entity(entities, pages)
        if entity is None:
            counts["no_nip" if not merged.nips else "nip_not_in_vat_list"] += 1
            repo.mark_reverified(domain_id)
            repo.conn.commit()
            continue
        if entity.krs:
            try:
                enriched = krs.fetch(entity.krs)
            except RegistryError:
                enriched = None
            if enriched:
                entity.pkd_codes = enriched.pkd_codes
                entity.legal_form = enriched.legal_form
                entity.website = enriched.website
                entity.start_date = enriched.start_date or entity.start_date
                entity.source = "krs"
        verification = verify_domain(
            entity.to_view(), pages, Classification(row["classification"], 0.5, []), ctx.keywords,
            ctx.vertical.registry.expected_pkd,
        )
        if verification.status == "rejected":
            counts["rejected_by_registry"] += 1  # np. podmiot z innej branży; zostaje bez potwierdzenia
            repo.mark_reverified(domain_id)
            repo.conn.commit()
            continue
        legal_entity_id = repo.upsert_legal_entity(entity)
        if not repo.attach_brand_to_entity(brand_id, legal_entity_id):
            counts["brand_name_taken"] += 1
            repo.mark_reverified(domain_id)
            repo.conn.commit()
            continue
        decision = city_decision(entity.city, row["city_hint"], pages, known_cities(repo.city_names()),
                                 _brand_name(pages, entity) or "", row["host"])
        if decision.city and verification.status == "verified":
            listing_id = repo.upsert_listing(brand_id, vertical_id, repo.ensure_city(decision.city), "verified")
            repo.set_listing_city_source(listing_id, decision.source)
        repo.update_domain_verification(
            domain_id, verification.score, verification.status, legal_entity_id, brand_id, verification.reasons
        )
        repo.mark_reverified(domain_id)
        counts[f"confirmed_{verification.status}"] += 1
        repo.conn.commit()
    counts["mf_requests"] = mf.requests_made
    return dict(counts)


# ----------------------------------------------------------------------------- S5


def stage_crawl_deep(ctx: Context, fetcher: PoliteFetcher, limit: int = 20, max_pages: int = 8) -> dict:
    repo = ctx.repo
    counts: Counter = Counter()
    candidates: dict[str, dict] = {}
    for row in list(repo.domains_for_deep_crawl(limit)) + list(repo.domains_awaiting_bundle(limit)):
        candidates.setdefault(str(row["id"]), row)
    # Strony z bazy i zrzutów wczytujemy w głównym wątku; w wątkach idzie tylko pobieranie z sieci.
    jobs = [(row, _load_pages(ctx, row["id"])) for row in candidates.values()]

    def work(f: PoliteFetcher, job: tuple[dict, list[PageExtraction]]) -> tuple[FetchResult | None, list[FetchResult]]:
        row, pages = job
        home = None
        if not pages:
            # Brak lokalnych zrzutów (np. przebieg na nowym runnerze): pobieramy stronę główną od nowa.
            home = f.fetch(row["canonical_url"] or f"https://{row['host']}/")
            if not home.ok:
                return home, []
            pages = [extract_page(home.text, home.final_url)]
        have = {canonical_url(p.url) for p in pages}
        links = [link for p in pages for link in p.links]
        results = [f.fetch(url) for url in pick_pages(links, pages[0].url, limit=max_pages) if url not in have]
        return home, results

    for (row, _), (home, results) in _fetch_parallel(fetcher, jobs, work):
        if home is not None:
            if not home.ok:
                counts[f"refetch_failed_{home.error}"] += 1
                repo.mark_deep_crawled(str(row["id"]))
                repo.conn.commit()
                continue
            _save_page(ctx, row["id"], row["host"], home)
            counts["refetched_home"] += 1
        for result in results:
            if result.ok:
                _save_page(ctx, row["id"], row["host"], result)
                counts["pages"] += 1
            else:
                counts[f"skipped_{result.error}"] += 1
        repo.mark_deep_crawled(str(row["id"]))
        counts["domains"] += 1
        repo.conn.commit()
    return dict(counts)


# ----------------------------------------------------------------------------- S6


def _registry_facts(ctx: Context, brand_id: str) -> list[Fact]:
    row = ctx.repo.conn.execute(
        """select le.start_date, le.registry_source from legal_entities le
           join brands b on b.legal_entity_id = le.id where b.id = %s""",
        (brand_id,),
    ).fetchone()
    if not row or not row["start_date"]:
        return []
    iso = row["start_date"].isoformat()
    # Uwaga: to data wpisu do rejestru (KRS lub wykaz VAT), nie dowód faktycznego początku działalności.
    label = "data wpisu do KRS" if row["registry_source"] == "krs" else "data rejestracji w wykazie VAT"
    return [Fact("registry_start_date", iso, f"{label}: {iso}", f"rejestr:{row['registry_source']}")]


def stage_requeue_lost(ctx: Context) -> dict:
    """Zadania 'pending', których pliku paczki nie ma lokalnie (zginął z runnerem), oznacza jako 'failed'.

    Marka wraca wtedy do kolejki crawla i budowania paczki. Uruchamiać tylko po pobraniu kolejki z gałęzi queue-data,
    przed crawl-deep, bo inaczej każde zadanie wyglądałoby na zgubione.
    """
    lost = 0
    for item in ctx.repo.pending_queue_items():
        if not Path(item["bundle_path"]).is_file():
            ctx.repo.finish_queue_item(
                item["id"], "failed", None,
                {"ok": False, "errors": [{"code": "bundle_lost", "message": "Plik paczki nie istnieje, paczka zostanie zbudowana od nowa."}]},
            )
            lost += 1
    ctx.repo.conn.commit()
    return {"requeued_lost": lost}


def stage_bundle(ctx: Context, limit: int = 50) -> dict:
    repo = ctx.repo
    counts: Counter = Counter()
    for row in repo.brands_needing_description(limit):
        pages = [p for p in _load_pages(ctx, row["domain_id"]) if not is_legal_url(p.url)]
        if not pages:
            counts["no_pages"] += 1
            continue
        facts = _registry_facts(ctx, row["brand_id"]) + facts_from_pages(pages)
        for fact in facts:
            fact.db_id = repo.add_fact(
                row["brand_id"], fact.type, fact.value, fact.quote, fact.source_url,
                _FACT_METHOD.get(fact.type, "registry"),
            )
        bundle = build_describe_bundle(
            vertical=ctx.vertical.slug, firm_id=str(row["brand_id"]), name=row["name"], city=row["city"],
            pages=pages, preset_facts=facts,
        )
        try:
            path = write_bundle(bundle, ctx.queue_dir)
        except ContactLeakError as exc:
            # Pojedyncza paczka z niewyczyszczonym kontaktem nie zatrzymuje etapu. Fakty tej marki wycofujemy.
            repo.conn.rollback()
            print(f"Pominięto paczkę describe dla marki {row['brand_id']}: {exc}", file=sys.stderr)
            counts["blocked_contacts"] += 1
            continue
        is_new = not repo.queue_item_exists("describe", bundle["bundle_sha256"], brand_id=row["brand_id"])
        repo.enqueue("describe", str(path), bundle["bundle_sha256"], brand_id=row["brand_id"])
        counts["describe"] += 1
        if is_new:
            counts["describe_new"] += 1  # nowa praca dla sesji opisów (ta sama paczka zbudowana ponownie się nie liczy)
        repo.conn.commit()
    for row in repo.domains_needing_classification(limit):
        pages = [p for p in _load_pages(ctx, row["id"]) if not is_legal_url(p.url)]
        if not pages:
            continue
        merged = merge_extractions(pages)
        bundle = build_classify_bundle(
            vertical=ctx.vertical.slug, firm_id=str(row["id"]), url=row["canonical_url"], page=merged,
            reasons=list(row["classification_reasons"] or []),
        )
        try:
            path = write_bundle(bundle, ctx.queue_dir)
        except ContactLeakError as exc:
            print(f"Pominięto paczkę classify dla domeny {row['id']}: {exc}", file=sys.stderr)
            counts["blocked_contacts"] += 1
            continue
        repo.enqueue("classify", str(path), bundle["bundle_sha256"], domain_id=row["id"])
        counts["classify"] += 1
        repo.conn.commit()
    return dict(counts)


# ----------------------------------------------------------------------------- S7


def _max_overlap(ctx: Context) -> float:
    row = ctx.repo.conn.execute("select value from settings where key = 'validator_max_ngram_overlap'").fetchone()
    return float(row["value"]) if row else 0.2


def _apply_describe(ctx: Context, item: dict, bundle: dict, result: dict, report: dict) -> None:
    repo = ctx.repo
    brand_id = str(item["brand_id"])
    db_ids = {f["fact_id"]: f.get("db_id") for f in bundle["facts"]}
    cited = sorted({db_ids[fid] for c in result["description"]["claims"] for fid in c["fact_ids"] if db_ids.get(fid)})
    repo.add_description(brand_id, result["description"]["text"].strip(), cited, report, "claude_code", "validated")
    brand = result.get("brand")
    if brand and brand.get("name"):
        repo.rename_brand(brand_id, brand["name"].strip())
    for service in result.get("services", []):
        repo.add_fact(brand_id, "service", service["name"], service["quote"], service["source_url"], "llm", 0.7)
    prices = [
        {
            "service": p["service"], "unit": p["unit"], "amount_min": p.get("amount_min"),
            "amount_max": p.get("amount_max"), "tax_mode": p["tax_mode"], "conditions": p.get("conditions"),
            "quote": p["quote"], "source_url": p["source_url"],
        }
        for p in result.get("prices", [])
    ]
    if prices:
        repo.replace_price_items(brand_id, prices)


def _apply_classify(ctx: Context, item: dict, result: dict) -> None:
    verdict = result["verdict"]
    label = verdict["label"]
    status = None if label in ("official", "uncertain") else "rejected"
    ctx.repo.update_domain_classification(
        str(item["domain_id"]), label, [f"Claude Code: {verdict['reason']}"], verification_status=status
    )


def stage_import(ctx: Context) -> dict:
    repo = ctx.repo
    counts: Counter = Counter()
    max_overlap = _max_overlap(ctx)
    for item in repo.pending_queue_items():
        firm_id = str(item["brand_id"] or item["domain_id"])
        result_path = ctx.queue_dir / "results" / item["type"] / f"{firm_id}.json"
        skip_path = ctx.queue_dir / "results" / "skipped" / item["type"] / f"{firm_id}.json"
        if not result_path.exists() and skip_path.exists():
            # Claude Code uznał, że paczka nie dotyczy firmy z branży: zamykamy zadanie, żeby nie wracało.
            try:
                reason = str(json.loads(skip_path.read_text(encoding="utf-8")).get("reason", ""))[:300]
            except (json.JSONDecodeError, AttributeError):
                reason = ""
            repo.finish_queue_item(item["id"], "rejected", str(skip_path), {"ok": False, "errors": [{"code": "skipped", "message": reason or "Pominięte przez Claude Code."}]})
            counts["skipped"] += 1
            repo.conn.commit()
            continue
        if not result_path.exists():
            counts["waiting"] += 1
            continue
        bundle = json.loads(Path(item["bundle_path"]).read_text(encoding="utf-8"))
        if bundle.get("bundle_sha256") != item["bundle_sha256"]:
            repo.finish_queue_item(item["id"], "rejected", str(result_path), {"ok": False, "errors": [{"code": "stale_bundle", "message": "Paczka na dysku różni się od zapisanej w bazie."}]})
            counts["rejected"] += 1
            repo.conn.commit()
            continue
        try:
            result = json.loads(result_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            repo.finish_queue_item(item["id"], "rejected", str(result_path), {"ok": False, "errors": [{"code": "bad_json", "message": "Wynik nie jest poprawnym JSON."}]})
            counts["rejected"] += 1
            repo.conn.commit()
            continue
        report = validate_result(bundle, result, max_overlap)
        if not report.ok:
            repo.finish_queue_item(item["id"], "rejected", str(result_path), report.to_dict())
            counts["rejected"] += 1
        else:
            if item["type"] == "describe":
                _apply_describe(ctx, item, bundle, result, report.to_dict())
            else:
                _apply_classify(ctx, item, result)
            repo.finish_queue_item(item["id"], "done", str(result_path), report.to_dict())
            counts["done"] += 1
        repo.conn.commit()
    return dict(counts)


def import_sessions(ctx: Context) -> int:
    """Raporty sesji Claude (queue/results/sessions/*.json) zapisuje w pipeline_runs, każdy plik raz."""
    folder = ctx.queue_dir / "results" / "sessions"
    added = 0
    for path in sorted(folder.glob("*.json")) if folder.is_dir() else []:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if not isinstance(data, dict) or not data.get("started_at"):
            continue
        cities = [c for c in data.get("cities") or [] if isinstance(c, dict) and c.get("name")]
        counts = {
            "file": path.name,
            "described": int(data.get("described") or 0),
            "skipped": int(data.get("skipped") or 0),
            "cities_searched": len(cities),
            "new_domains": sum(int(c.get("domains") or 0) for c in cities),
            "city_list": ", ".join(f"{c['name']}{' (dokładnie)' if c.get('deep') else ''}" for c in cities)[:500],
        }
        status = "failed" if data.get("status") == "failed" else "ok"
        if ctx.repo.save_session_run(counts, data["started_at"], data.get("finished_at"), status, data.get("errors")):
            added += 1
    ctx.repo.conn.commit()
    return added


# ----------------------------------------------------------------------------- oferty


def stage_offers(ctx: Context, fetcher: PoliteFetcher, limit: int = 200, dry_run: bool = False) -> dict:
    """Najnowsze oferty (tytuł i link) ze stron opublikowanych biur. Raport każdej domeny idzie na stderr.

    Gdy odczyt się nie uda, poprzednie oferty zostają (strona ukrywa te niewidziane od 14 dni)."""
    repo = ctx.repo
    counts: Counter = Counter()
    for row in repo.domains_for_offers(limit):
        home = row["canonical_url"] or f"https://{row['host']}/"
        scan = scan_offers(fetcher, home, known_index=row["offers_url"])
        report = {
            "host": row["host"], "source": scan.source_url, "method": scan.method, "offers": len(scan.offers),
            "tried": scan.tried, "errors": scan.errors[:3], "priced": sum(1 for o in scan.offers if o.price_amount),
            "sample": [[o.title, o.price_text, o.url] for o in scan.offers[:3]],
        }
        if not scan.offers and scan.diagnostics:
            report["diagnostics"] = scan.diagnostics
        print(json.dumps(report, ensure_ascii=False), file=sys.stderr)
        counts["domains"] += 1
        counts["with_offers" if scan.offers else "without_offers"] += 1
        if dry_run:
            continue
        if scan.offers:
            for key, value in repo.save_offers(str(row["id"]), str(row["brand_id"]), scan.offers).items():
                if value:
                    counts[f"offers_{key}"] += value
        repo.mark_offers_checked(str(row["id"]), scan.source_url)
        repo.conn.commit()
    return dict(counts)


# ----------------------------------------------------------------------------- kontakty

_CONTACT_PAGE = re.compile(r"(?i)kontakt|contact|o-nas|onas|about|o-firmie|biuro")
_FREE_MAIL = {"gmail.com", "wp.pl", "o2.pl", "onet.pl", "op.pl", "interia.pl", "interia.eu", "poczta.fm", "tlen.pl",
              "outlook.com", "hotmail.com", "icloud.com", "yahoo.com", "gazeta.pl", "vp.pl", "go2.pl"}


def contact_page_urls(links: list[tuple[str, str]], base_url: str, limit: int = 2) -> list[str]:
    """Podstrony z kontaktem (Kontakt, O nas) tej samej domeny, najlepsze pierwsze."""
    base_domain = registrable_domain(base_url)
    scored: dict[str, int] = {}
    for href, anchor in links:
        if not href or href.startswith(("mailto:", "tel:", "javascript:", "#")):
            continue
        absolute = urljoin(base_url, href)
        if registrable_domain(absolute) != base_domain:
            continue
        haystack = f"{urlsplit(absolute).path} {anchor}"
        if not _CONTACT_PAGE.search(haystack):
            continue
        score = 3 if re.search(r"(?i)kontakt|contact", haystack) else 1
        url = canonical_url(absolute)
        if url != canonical_url(base_url):
            scored[url] = max(scored.get(url, 0), score)
    return [u for u, _ in sorted(scored.items(), key=lambda i: (-i[1], i[0]))[:limit]]


def pick_contacts(pages: list[PageExtraction], host: str) -> dict:
    """Telefony (najpierw z linków tel: i JSON-LD), adresy e-mail firmowe (bez imiennych) i profile społecznościowe."""
    domain = registrable_domain(f"https://{host}/")
    phones: dict[str, tuple[int, str]] = {}
    emails: dict[str, tuple[int, str]] = {}
    socials: dict[str, tuple[str, str]] = {}
    for page in pages:
        for org in page.organizations:
            tel = org.get("telephone")
            for raw in tel if isinstance(tel, list) else [tel]:
                if isinstance(raw, str) and (e164 := _e164(raw)):
                    phones.setdefault(e164, (0, page.url))
        for hit in page.phones:
            rank = {"tel": 0, "jsonld": 0}.get(hit.source, 1)
            if hit.e164 not in phones or phones[hit.e164][0] > rank:
                phones[hit.e164] = (rank, page.url)
        for hit in page.emails:
            if hit.kind == "personal_like":
                continue
            mail_domain = hit.address.rsplit("@", 1)[-1].lower()
            if mail_domain != domain and not mail_domain.endswith("." + domain) and mail_domain not in _FREE_MAIL:
                continue
            rank = (0 if hit.kind == "role" else 1) + (0 if hit.source == "mailto" else 1)
            if hit.address.lower() not in emails or emails[hit.address.lower()][0] > rank:
                emails[hit.address.lower()] = (rank, page.url)
        for link in page.socials:
            socials.setdefault(link.network, (link.url, page.url))
    return {
        "phones": [(v, src) for v, (_, src) in sorted(phones.items(), key=lambda i: i[1][0])[:3]],
        "emails": [(v, src) for v, (_, src) in sorted(emails.items(), key=lambda i: i[1][0])[:3]],
        "socials": [(net, url, src) for net, (url, src) in socials.items()],
    }


_IMG_EXT_BAD = re.compile(r"(?i)\.(svg|ico)(?:$|\?)")


def pick_image(html: str, page_url: str) -> tuple[str, str] | None:
    """Obrazek reprezentujący firmę: og:image (podgląd strony), potem logo z JSON-LD, potem duża ikona strony.

    Zwraca (adres https, rodzaj) albo None. Obrazy SVG i favicony .ico pomijamy, bo źle wyglądają na liście."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "lxml")

    def ok(url: str | None) -> str | None:
        if not url or not isinstance(url, str):
            return None
        absolute = urljoin(page_url, url.strip())
        if not absolute.startswith("https://") or _IMG_EXT_BAD.search(absolute) or len(absolute) > 1000:
            return None
        return absolute

    for attrs in ({"property": "og:image:secure_url"}, {"property": "og:image"}, {"name": "og:image"},
                  {"name": "twitter:image"}, {"property": "twitter:image"}):
        tag = soup.find("meta", attrs=attrs)
        if tag and (url := ok(tag.get("content"))):
            return url, "og"
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except (ValueError, TypeError):
            continue
        for node in data if isinstance(data, list) else [data]:
            if not isinstance(node, dict):
                continue
            for item in [node, *(node.get("@graph") or [])]:
                if isinstance(item, dict):
                    logo = item.get("logo") or item.get("image")
                    if isinstance(logo, dict):
                        logo = logo.get("url")
                    if isinstance(logo, list):
                        logo = logo[0] if logo else None
                    if (url := ok(logo if isinstance(logo, str) else None)):
                        return url, "logo"
    for rel in ("apple-touch-icon", "apple-touch-icon-precomposed"):
        tag = soup.find("link", rel=lambda v: v and rel in (v if isinstance(v, list) else [v]))
        if tag and (url := ok(tag.get("href"))):
            return url, "icon"
    return None


_LOGO_HINT = re.compile(r"(?i)logo|brand|znak")
_ICON_HINT = re.compile(r"(?i)icon|favicon|sprite|avatar|flag|flaga|loader|spinner|pixel|placeholder|blank|arrow|strzal")
_HERO_HINT = re.compile(r"(?i)hero|slider|slide|banner|baner|carousel|swiper|header-bg|top-bg|main-photo|cover|jumbotron")
_PHOTO_EXT = re.compile(r"(?i)\.(jpe?g|webp|avif)(?:$|\?)")


def pick_images(html: str, page_url: str) -> dict:
    """Logo (do kółka) i zdjęcie (do banera) ze strony głównej biura.

    Logo: JSON-LD logo, obrazek z "logo" w adresie/klasie/alt, og:image wyglądający na logo, duża ikona strony.
    Zdjęcie: og:image o poziomych proporcjach albo bez cech logo, potem duży obrazek z sekcji hero/slidera
    albo z tła w stylu, potem pierwsze duże zdjęcie JPG/WEBP z treści strony."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "lxml")

    def ok(url) -> str | None:
        if not url or not isinstance(url, str):
            return None
        url = url.strip().split(" ")[0]
        absolute = urljoin(page_url, url)
        if not absolute.startswith("https://") or _IMG_EXT_BAD.search(absolute) or len(absolute) > 1000:
            return None
        return absolute

    def meta(*names: str) -> str | None:
        for name in names:
            tag = soup.find("meta", attrs={"property": name}) or soup.find("meta", attrs={"name": name})
            if tag and tag.get("content"):
                return str(tag["content"])
        return None

    logo: str | None = None
    cover: str | None = None

    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except (ValueError, TypeError):
            continue
        for node in data if isinstance(data, list) else [data]:
            for item in [node, *((node.get("@graph") or []) if isinstance(node, dict) else [])]:
                if isinstance(item, dict) and not logo:
                    value = item.get("logo")
                    if isinstance(value, dict):
                        value = value.get("url")
                    logo = ok(value if isinstance(value, str) else None)

    og = ok(meta("og:image:secure_url", "og:image", "twitter:image"))
    if og:
        try:
            width = int(meta("og:image:width") or 0)
            height = int(meta("og:image:height") or 0)
        except ValueError:
            width = height = 0
        looks_logo = bool(_LOGO_HINT.search(og)) or (width and height and width / max(height, 1) < 1.25)
        if looks_logo:
            logo = logo or og
        else:
            cover = og

    images = soup.find_all("img")
    if not logo:
        for img in images:
            hint = " ".join([str(img.get("src", "")), " ".join(img.get("class") or []), str(img.get("alt", "")),
                             " ".join(p.get("class", [""])[0] if p.get("class") else "" for p in img.parents if p.name)])
            if _LOGO_HINT.search(hint[:600]):
                logo = ok(img.get("src") or img.get("data-src"))
                if logo:
                    break
    if not cover:
        for node in soup.select("[style*='background']"):
            if _HERO_HINT.search(" ".join(node.get("class") or []) + " " + str(node.get("id", ""))):
                match = re.search(r"url\(['\"]?([^'\")]+)", str(node.get("style", "")))
                if match and (url := ok(match.group(1))) and not _LOGO_HINT.search(url):
                    cover = url
                    break
    if not cover:
        def candidates(in_hero: bool):
            for img in images:
                src = img.get("src") or img.get("data-src") or img.get("data-lazy-src")
                if not src or _LOGO_HINT.search(str(src)) or _ICON_HINT.search(str(src)):
                    continue
                try:
                    width = int(str(img.get("width", "0")).rstrip("px") or 0)
                except ValueError:
                    width = 0
                if 0 < width < 400:
                    continue
                parents = " ".join(" ".join(p.get("class") or []) for p in img.parents if p.name)[:800]
                if in_hero and not _HERO_HINT.search(parents):
                    continue
                if not in_hero and not _PHOTO_EXT.search(str(src)):
                    continue
                if url := ok(src):
                    yield url
        cover = next(candidates(True), None) or next(candidates(False), None)

    if not logo:
        for rel in ("apple-touch-icon", "apple-touch-icon-precomposed", "icon"):
            tag = soup.find("link", rel=lambda v: v and rel in (v if isinstance(v, list) else [v]))
            if tag and (url := ok(tag.get("href"))) and not url.endswith(".ico"):
                logo = url
                break
    return {"logo": logo, "cover": cover}


def stage_contacts(ctx: Context, fetcher: PoliteFetcher, limit: int = 300, only_new: bool = False) -> dict:
    """Telefon, e-mail firmowy i profile społecznościowe ze strony głównej i podstrony Kontakt zweryfikowanych biur."""
    repo = ctx.repo
    counts: Counter = Counter()
    for row in repo.domains_for_contacts(limit, only_new=only_new):
        home_url = row["canonical_url"] or f"https://{row['host']}/"
        home = fetcher.fetch(home_url)
        if not home.ok:
            counts["home_failed"] += 1
            continue
        pages = [extract_page(home.text, home.final_url)]
        for url in contact_page_urls(pages[0].links, home.final_url, limit=3):
            result = fetcher.fetch(url)
            if result.ok:
                pages.append(extract_page(result.text, result.final_url))
        found = pick_contacts(pages, row["host"])
        repo.save_contacts(str(row["brand_id"]), found)
        image = pick_image(home.text, home.final_url)
        repo.save_brand_image(str(row["brand_id"]), image)
        images = pick_images(home.text, home.final_url)
        repo.save_brand_logo_cover(str(row["brand_id"]), images)
        counts["with_image"] += bool(image)
        counts["with_logo"] += bool(images["logo"])
        counts["with_cover"] += bool(images["cover"])
        counts["domains"] += 1
        for key in ("phones", "emails", "socials"):
            counts[f"with_{key}"] += bool(found[key])
        print(json.dumps({"host": row["host"], "image": image, **images, **{k: [list(x) for x in v] for k, v in found.items()}},
                         ensure_ascii=False),
              file=sys.stderr)
        repo.conn.commit()
    return dict(counts)


# ----------------------------------------------------------------------------- opinie Google


def stage_google_reviews(ctx: Context, limit: int = 100, max_age_days: int = 7) -> dict:
    """Ocena i opinie z Google dla firm w katalogu (najdawniej odświeżane pierwsze). Bez klucza API nic nie robi."""
    import os

    from .google_places import fetch_place

    if not os.environ.get("GOOGLE_PLACES_API_KEY"):
        return {"skipped": "brak GOOGLE_PLACES_API_KEY"}
    repo = ctx.repo
    counts: Counter = Counter()
    for row in repo.brands_for_google_reviews(limit, max_age_days):
        result = fetch_place(
            row["name"], row["city"], row["website"],
            lambda found: name_similarity(row["name"], found) >= 0.6,
        )
        repo.save_google_place(str(row["brand_id"]), result)
        counts[result.status] += 1
        counts["reviews"] += len(result.reviews)
        repo.conn.commit()
    return dict(counts)


# ----------------------------------------------------------------------------- publikacja


def stage_publish_ready(ctx: Context, limit: int = 200) -> dict:
    """Publikuje wpisy spełniające bramkę (gdy w ustawieniach auto_publish = true).

    Bramka jak w panelu: domena zweryfikowana NIP-em, zwalidowany opis, minimum faktów (publish_min_facts).
    Przy publikacji poprawia miasto wpisu na miasto z wyszukiwania, jeśli fakty o firmie je wymieniają.
    Każda publikacja zapisuje wpis w audit_log (aktor: pipeline). Wpis można wycofać w panelu.
    """
    repo = ctx.repo
    if repo.setting("auto_publish", False) is not True:
        return {"auto_publish": "wyłączone"}
    from .guard import publishing_blocked

    if publishing_blocked(repo):
        return {"auto_publish": "wstrzymane przez kontrolę (katalog guard)"}
    min_facts = int(repo.setting("publish_min_facts", 6))
    counts: Counter = Counter()
    known = known_cities(repo.city_names())
    for row in repo.listings_ready_to_publish(min_facts, limit):
        city_id, city_name = str(row["city_id"]), row["city_name"]
        decision = brand_city_decision(repo, str(row["brand_id"]), row["city_hint"], row["brand_name"], known)
        target = decision.city if decision.source in STRONG_CITY_SOURCES else None
        if target and _fold(target) != _fold(city_name):
            target_id = repo.ensure_city(target)
            if repo.brand_has_listing_in_city(str(row["brand_id"]), str(row["vertical_id"]), target_id, str(row["id"])):
                # Firma ma już osobny wpis w tamtym mieście: ten zostaje w swoim (unikalność marka + miasto).
                counts["city_kept_duplicate"] += 1
            else:
                city_id, city_name = target_id, target
                counts["city_corrected"] += 1
        if decision.city and _fold(decision.city) == _fold(city_name):
            repo.set_listing_city_source(str(row["id"]), decision.source)
        slug = row["slug"] if row["slug"] and city_id == str(row["city_id"]) else None
        if not slug:
            slug = _unique_slug(slugify(row["brand_name"]) or "firma", repo.taken_slugs(str(row["vertical_id"]), city_id))
        repo.publish_listing(str(row["id"]), city_id, slug, row["description_id"])
        repo.write_audit(
            "pipeline", "listing.publish", "listing", str(row["id"]),
            {"status": "verified", "city": row["city_name"]},
            {"status": "published", "city": city_name, "slug": slug, "auto": True},
        )
        counts["published"] += 1
        repo.conn.commit()
    return dict(counts)


# Nazwy miast, które są też zwykłymi słowami w ogłoszeniach ("koło lasu", "brzeg jeziora", "góra"): pomijamy je
# przy szukaniu miast w ofertach, żeby nie dodawać firmy do miasta tylko przez przypadkowe słowo.
_AMBIGUOUS_CITY_WORDS = {"kolo", "brzeg", "gora", "ruda", "pila", "police", "hel", "most", "bor", "las", "osiek"}


def _tokens(text: str) -> list[str]:
    return [t for t in re.split(r"[^a-z0-9]+", _fold(text)) if t]


def offer_mentions_city(text_tokens: list[str], city_tokens: list[str], other_city_words: frozenset[str] = frozenset()) -> bool:
    """Czy tekst (tokeny) wymienia miasto, także w odmianie: "Karpacz", "w Karpaczu", "Jelenia Góra", "Jeleniej Górze".

    other_city_words: jednowyrazowe nazwy innych miast. Słowo, które samo jest nazwą innego miasta, nie liczy się
    jako odmiana ("Lubliniec" to nie "Lublin", "Chełmno" to nie "Chełm", "Wieliczka" to nie "Wieluń").
    """
    n = len(city_tokens)
    if n == 0 or len(text_tokens) < n:
        return False

    def same_word(token: str, k: int) -> bool:
        word = city_tokens[k]
        if token == word:
            return True
        if token in other_city_words or token.endswith(_ADJECTIVE_ENDINGS):
            return False  # nazwa innego miasta albo przymiotnik ("ul. Warszawska")
        cut = _inflection_cut(token, word)
        if cut is None:
            return False
        # Słowo pasujące do kilku nazw należy do tej, od której mniej ucięto ("Szczecinie" to Szczecin, nie Szczecinek;
        # "Lublińcu" to Lubliniec, bo od "Lublin" nie da się utworzyć "-ńcu"), przy remisie do dłuższej nazwy.
        for other in other_city_words:
            if other == word:
                continue
            other_cut = _inflection_cut(token, other)
            if other_cut is not None and (other_cut < cut or (other_cut == cut and len(other) > len(word))):
                return False
        return True

    return any(all(same_word(text_tokens[i + k], k) for k in range(n)) for i in range(len(text_tokens) - n + 1))


# Końcówki odmiany nazw miast po odcięciu 0-3 ostatnich liter: Karpacz-u, Krakow-ie, Oław-ie, Gliwic-ach,
# Wieliczc-e, Lublin-cu (Lubliniec), Sopo-cie, Zakopane-m.
_CITY_ENDINGS = frozenset({
    "", "a", "u", "e", "y", "i", "m", "ie", "iu", "em", "om", "ej", "ia", "ii", "ce", "cu", "ca", "cie", "niu",
    "ach", "ami", "ow", "owi", "ego", "emu",
})


# Końcówki, które zastępują ucięte litery ("Wielicz-ka" -> "Wielic-ce", "Lubli-niec" -> "Lubli-ńcu", "Sopo-t" -> "Sopo-cie").
# Nie mogą stać po pełnej nazwie ("Lublin" + "cu" to nie odmiana), a ucięcie 3 liter wymaga właśnie takiej końcówki
# ("Kart-uzy" -> "Kart-a" to zwykłe słowo "karta", nie Kartuzy).
_REPLACING_ENDINGS = frozenset({"ce", "cu", "ca", "cie", "niu"})


def _inflection_cut(token: str, word: str) -> int | None:
    """Ile liter ucięto od słowa z nazwy miasta, żeby dostać token w odmianie; None, gdy token nie jest jego odmianą."""
    if len(word) <= 4:
        # krótkie słowa ("Łódź", "Góra"): tylko końcówka odmiany ("w Łodzi", "Jeleniej Górze")
        ok = len(word) >= 3 and token.startswith(word[:-1]) and len(token) <= len(word) + 2
        return (0 if token.startswith(word) else 1) if ok else None
    for cut in range(0, min(3, len(word) - 4) + 1):
        stem = word[: len(word) - cut]
        ending = token[len(stem):]
        if not token.startswith(stem) or ending not in _CITY_ENDINGS:
            continue
        if ending in _REPLACING_ENDINGS and cut == 0:
            continue
        if cut == 3 and ending not in _REPLACING_ENDINGS:
            continue
        return cut
    return None


def _inflects(token: str, word: str) -> bool:
    """Czy token to odmiana słowa z nazwy miasta (nie dowolne słowo zaczynające się tak samo)."""
    return _inflection_cut(token, word) is not None


def _city_prefix(word: str) -> str:
    """Początek, który musi mieć każda odmiana słowa (zob. _inflects): 3 litery, dla słów 3-literowych 2."""
    return word[:3] if len(word) >= 4 else word[:2]


_ADJECTIVE_ENDINGS = ("ska", "skiej", "skie", "ski", "skim", "skich", "cka", "ckiej", "ckie", "cki", "ckim", "ckich")


def stage_extra_cities(ctx: Context, min_offers: int = 3, max_extra: int = 10) -> dict:
    """Dodatkowe wpisy firmy w miastach, w których działa (biura często obsługują kilka miast).

    Miasto dostaje wpis, gdy co najmniej `min_offers` aktywnych ofert firmy je wymienia (tytuł lub adres oferty)
    albo fakty o firmie podają w nim adres biura (kod pocztowy z miastem) i jest tam co najmniej jedna oferta. Tylko miasta, które już mają stronę
    w katalogu. Wpis jest od razu opublikowany; strona firmy w drugim mieście wskazuje główny wpis jako kanoniczny.
    Wpisy dodane tak wcześniej są sprawdzane przy każdym przebiegu: gdy miasto przestaje spełniać warunek
    (np. oferty wygasły), wpis jest wycofywany, a gdy znów spełnia, wraca. Wpisów wycofanych ręcznie nie przywracamy.
    """
    repo = ctx.repo
    from .guard import publishing_blocked

    if publishing_blocked(repo):
        return {"extra_cities": "wstrzymane przez kontrolę (katalog guard)"}
    counts: Counter = Counter()
    cities = [(str(r["id"]), r["name"], _tokens(r["name"])) for r in repo.conn.execute("select id, name from cities").fetchall()]
    cities = [c for c in cities if c[2] and " ".join(c[2]) not in _AMBIGUOUS_CITY_WORDS]
    single_words = frozenset(c[2][0] for c in cities if len(c[2]) == 1)
    listings_of: dict[tuple[str, str], dict[str, dict]] = defaultdict(dict)
    for r in repo.listings_by_brand():
        listings_of[(str(r["brand_id"]), str(r["vertical_id"]))][str(r["city_id"])] = r
    auto_of: dict[tuple[str, str], dict[str, dict]] = defaultdict(dict)
    for r in repo.auto_extra_listings_all():
        auto_of[(str(r["brand_id"]), str(r["vertical_id"]))][str(r["city_id"])] = r
    offers_of: dict[str, list[list[str]]] = defaultdict(list)
    for o in repo.active_offer_texts_all():
        offers_of[str(o["brand_id"])].append(_tokens(f"{o['title'] or ''} {o['url'] or ''}"))
    addresses_of: dict[str, list[list[str]]] = defaultdict(list)
    for r in repo.address_texts_all():
        addresses_of[str(r["brand_id"])].append(_tokens(r["v"]))
    for brand in repo.brands_with_published_listing():
        brand_id, vertical_id = str(brand["brand_id"]), str(brand["vertical_id"])
        listings = listings_of[(brand_id, vertical_id)]
        auto = auto_of[(brand_id, vertical_id)]
        offer_texts = offers_of[brand_id]
        address_texts = addresses_of[brand_id]
        prefixes = {p for t in (*offer_texts, *address_texts) for tok in t for p in (tok[:2], tok[:3])}
        scored: list[tuple[int, str, str]] = []
        for city_id, city_name, city_tokens in cities:
            if city_id in listings and city_id not in auto:
                continue  # wpis z wyszukiwania albo z panelu: nie ruszamy
            if _city_prefix(city_tokens[0]) not in prefixes:
                continue  # żadne słowo w ofertach nie zaczyna się jak nazwa miasta: szybkie pominięcie
            # Własna nazwa miasta w zbiorze nie przeszkadza: identyczne słowo jest sprawdzane wcześniej.
            hits = sum(1 for t in offer_texts if offer_mentions_city(t, city_tokens, single_words))
            # Adres ze strony biura liczy się tylko razem z co najmniej jedną ofertą w tym mieście: strony podają też
            # cudze adresy (UODO w polityce prywatności, firma przetwarzająca dane, właściciel serwisu).
            office = hits >= 1 and any(offer_mentions_city(t, city_tokens, single_words) for t in address_texts)
            if hits >= min_offers or office:
                scored.append((hits + (1000 if office else 0), city_id, city_name))
        keep = {city_id: city_name for _, city_id, city_name in sorted(scored, reverse=True)[:max_extra]}
        changed = False
        # Zabezpieczenie: firma nigdy nie znika z katalogu przez ten krok (ostatni opublikowany wpis zostaje).
        to_remove = {c for c, r in auto.items() if c not in keep and r["status"] == "published"}
        if to_remove and not any(r["status"] == "published" and c not in to_remove for c, r in listings.items()):
            counts["extra_kept_last"] += 1
            to_remove = set()
        for city_id, row in auto.items():
            if city_id in to_remove:
                repo.set_listing_status(str(row["id"]), "removed")
                repo.write_audit("pipeline", "listing.remove_extra_city", "listing", str(row["id"]),
                                 {"status": "published"}, {"status": "removed", "auto": True})
                counts["extra_removed"] += 1
                changed = True
        for city_id, city_name in keep.items():
            row = auto.get(city_id)
            if row and row["status"] == "published":
                continue
            if row and row["last_action"] != "listing.remove_extra_city":
                continue  # wycofany ręcznie w panelu
            slug = row["slug"] if row and row["slug"] else _unique_slug(
                slugify(brand["brand_name"]) or "firma", repo.taken_slugs(vertical_id, city_id))
            listing_id = str(row["id"]) if row else repo.upsert_listing(brand_id, vertical_id, city_id, "verified")
            repo.publish_listing(listing_id, city_id, slug, None)
            repo.write_audit("pipeline", "listing.publish_extra_city", "listing", listing_id, None,
                             {"status": "published", "city": city_name, "slug": slug, "auto": True})
            counts["extra_listings"] += 1
            changed = True
        if changed:
            repo.conn.commit()
    repo.conn.commit()
    return dict(counts)


def _unique_slug(base: str, taken: set[str]) -> str:
    if base not in taken:
        return base
    n = 2
    while f"{base}-{n}" in taken:
        n += 1
    return f"{base}-{n}"


# ----------------------------------------------------------------------------- raport miast (etap 2 planu poprawy)

def stage_cities_report(ctx: Context, out_dir: str, apply: bool = False) -> dict:
    """Przelicza miasto każdego opublikowanego wpisu głównego nową regułą (katalog_worker/city.py).

    Bez `apply` tylko zapisuje raport: `raport-miasta.csv` (biuro, stare i nowe miasto, źródło, decyzja, ostrzeżenia)
    i `raport-miasta-podsumowanie.md` (liczba biur na miasto przed i po, miasta ze spadkiem ponad 30%).
    Z `apply` przenosi wpisy, dla których nowa reguła ma pewne źródło innego miasta: stary adres profilu trafia do
    listing_redirects (przekierowanie stałe), a gdy firma ma już wpis w nowym mieście, przenoszony wpis jest wycofany
    i przekierowany na tamten. Wpisów bez pewnego źródła (miasto niepotwierdzone) nie zmienia: decyzja właściciela.
    """
    import csv

    repo = ctx.repo
    known = known_cities(repo.city_names())
    # Miasta, które mają już stronę w katalogu: tylko do nich przenosimy automatycznie (wieś pod miastem bez strony
    # zabrałaby biuro z rankingu miasta, w którym działa).
    catalog = {tuple(_tokens(n)) for n in repo.catalog_city_names()}
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    counts: Counter = Counter()
    before: Counter = Counter()
    after: Counter = Counter()
    rows_out: list[dict] = []
    rows = repo.primary_listings_for_city_report()
    decisions = [brand_city_decision(repo, str(r["brand_id"]), r["city_hint"], r["brand_name"], known) for r in rows]
    # Kody pocztowe (dwie pierwsze cyfry) miast z wpisów potwierdzonych adresem w obecnym mieście. Przeniesienie
    # z adresem o kodzie spoza tych kodów idzie do przeglądu: "05-084 Leszno" (wieś pod Warszawą) to nie Leszno 64-100.
    city_codes: dict[str, Counter] = {}
    for r, d in zip(rows, decisions):
        if d.postcode and d.city and _fold(d.city) == _fold(r["city_name"]):
            city_codes.setdefault(_fold(d.city), Counter())[d.postcode[:2]] += 1
    # Firma z wpisami głównymi w kilku miastach (sieć, oddziały z jednym NIP-em po scaleniu duplikatów): jedna
    # siedziba z rejestru nie oznacza, że biuro w drugim mieście nie istnieje, więc takie przeniesienia do przeglądu.
    listings_per_brand = Counter(str(r["brand_id"]) for r in rows)
    for row, decision in zip(rows, decisions):
        listing_id, brand_id = str(row["id"]), str(row["brand_id"])
        current = row["city_name"]
        before[current] += 1
        codes = city_codes.get(_fold(decision.city or ""), Counter())
        names_current = any(w.endswith(f": {current}") for w in decision.warnings if w.startswith("inne miasto w"))
        if decision.city is None:
            verdict = "niepotwierdzone"
            after[current] += 1
        elif _fold(decision.city) == _fold(current):
            verdict = "bez zmian"
            after[current] += 1
        elif decision.source not in STRONG_CITY_SOURCES:
            verdict = "bez zmian (słaby dowód)"
            after[current] += 1
        elif tuple(_tokens(decision.city)) not in catalog:
            verdict = "do przeglądu (miasto bez strony w katalogu)"
            after[current] += 1
        elif decision.source == "rejestr" and mentions_city(repo.brand_fact_text(brand_id), current):
            verdict = "do przeglądu (rejestr podaje inne miasto niż strona biura)"
            after[current] += 1
        elif names_current:
            verdict = "do przeglądu (nazwa lub domena biura wskazuje obecne miasto)"
            after[current] += 1
        elif listings_per_brand[brand_id] > 1:
            verdict = "do przeglądu (firma ma wpisy w kilku miastach)"
            after[current] += 1
        elif decision.postcode and sum(codes.values()) >= 2 and decision.postcode[:2] not in codes:
            verdict = "do przeglądu (kod pocztowy nie pasuje do miasta)"
            after[current] += 1
        elif decision.source in STRONG_CITY_SOURCES:
            verdict = "przeniesienie"
            after[decision.city] += 1
        else:
            verdict = "bez zmian (słaby dowód)"
            after[current] += 1
        counts[verdict] += 1
        rows_out.append({
            "biuro": row["brand_name"],
            "domena": repo.brand_host(brand_id) or "",
            "stare_miasto": current,
            "nowe_miasto": decision.city or "",
            "zrodlo": SOURCE_LABEL.get(decision.source, decision.source),
            "decyzja": verdict,
            "ostrzezenia": "; ".join(decision.warnings),
            "kod": decision.postcode or "",
            "profil": f"/{row['city_slug']}/{row['slug']}",
        })
        if apply:
            if verdict == "przeniesienie":
                _move_listing(repo, row, decision, counts)
            elif decision.city and verdict == "bez zmian":
                repo.set_listing_city_source(listing_id, decision.source)
            repo.conn.commit()

    with (out / "raport-miasta.csv").open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows_out[0].keys()) if rows_out else ["biuro"])
        writer.writeheader()
        writer.writerows(rows_out)

    cities = sorted(set(before) | set(after), key=lambda c: (-before[c], c))
    drops = [c for c in cities if before[c] >= 3 and after[c] < before[c] * 0.7]
    lines = [
        "# Raport miast (na sucho)" if not apply else "# Raport miast (zapisany)",
        "",
        f"Wpisy główne: {len(rows_out)}. " + ", ".join(f"{k}: {v}" for k, v in sorted(counts.items())),
        "",
        "## Miasta ze spadkiem ponad 30%",
        "",
        *([f"- {c}: {before[c]} -> {after[c]}" for c in drops] or ["- brak"]),
        "",
        "## Liczba biur na miasto (wpisy główne, przed -> po)",
        "",
        *[f"- {c}: {before[c]} -> {after[c]}" for c in cities if before[c] != after[c] or before[c] >= 10],
    ]
    (out / "raport-miasta-podsumowanie.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    counts["drops_over_30pct"] = len(drops)
    return dict(counts)


def _move_listing(repo: Repo, row: dict, decision: CityDecision, counts: Counter) -> None:
    listing_id, brand_id, vertical_id = str(row["id"]), str(row["brand_id"]), str(row["vertical_id"])
    old_path = f"/{row['city_slug']}/{row['slug']}"
    target_id = repo.ensure_city(decision.city)
    existing = repo.brand_listing_in_city(brand_id, vertical_id, target_id)
    if existing and str(existing["id"]) != listing_id:
        # Firma ma już wpis w nowym mieście: przenoszony wpis wycofujemy i przekierowujemy na tamten.
        repo.set_listing_status(listing_id, "removed")
        if existing["status"] != "published":
            slug = existing["slug"] or _unique_slug(slugify(row["brand_name"]) or "firma",
                                                     repo.taken_slugs(vertical_id, target_id))
            repo.publish_listing(str(existing["id"]), target_id, slug, None)
        repo.add_listing_redirect(old_path, str(existing["id"]))
        repo.set_listing_city_source(str(existing["id"]), decision.source)
        target_listing = str(existing["id"])
        counts["moved_merged"] += 1
    else:
        slug = _unique_slug(slugify(row["brand_name"]) or "firma", repo.taken_slugs(vertical_id, target_id))
        repo.move_listing(listing_id, target_id, slug)
        repo.add_listing_redirect(old_path, listing_id)
        repo.set_listing_city_source(listing_id, decision.source)
        target_listing = listing_id
        counts["moved"] += 1
    repo.write_audit("pipeline", "listing.move_city", "listing", listing_id,
                     {"city": row["city_name"], "path": old_path},
                     {"city": decision.city, "source": decision.source, "target_listing": target_listing})


# ----------------------------------------------------------------------------- nazwy i duplikaty (etap 3 planu poprawy)

def _write_csv(path: Path, rows: list[dict]) -> None:
    import csv

    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()) if rows else ["biuro"])
        writer.writeheader()
        writer.writerows(rows)


def _published_by_brand(repo: Repo) -> dict[str, dict]:
    brands: dict[str, dict] = {}
    for r in repo.published_listings_overview():
        b = brands.setdefault(str(r["brand_id"]), {**r, "listings": []})
        b["listings"].append(r)
    return brands


def _reslug_listing(repo: Repo, listing: dict, new_name: str, counts: Counter) -> None:
    """Nowy slug wpisu po zmianie nazwy; stary adres trafia do przekierowań."""
    vertical_id, city_id = str(listing["vertical_id"]), str(listing["city_id"])
    base = slugify(new_name) or "firma"
    if listing["slug"] == base:
        return
    slug = _unique_slug(base, repo.taken_slugs(vertical_id, city_id) - {listing["slug"]})
    if slug == listing["slug"]:
        return
    repo.move_listing(str(listing["id"]), city_id, slug)
    repo.add_listing_redirect(f"/{listing['city_slug']}/{listing['slug']}", str(listing["id"]))
    repo.write_audit("pipeline", "listing.reslug", "listing", str(listing["id"]),
                     {"slug": listing["slug"]}, {"slug": slug})
    counts["reslugged"] += 1


def stage_names_report(ctx: Context, out_dir: str, apply: bool = False) -> dict:
    """Opublikowane firmy z nazwą, która nie jest nazwą biura, albo ze strony katalogu firm.

    Raport `raport-nazwy.csv`: obecna nazwa, problem, proponowana nazwa i jej źródło, decyzja (zmiana nazwy albo
    ukrycie). Z `apply` zmienia nazwy (nowy adres profilu, stary przekierowany) i ukrywa wpisy bez dobrej nazwy
    (status removed, strona odpowiada kodem 410).
    """
    repo = ctx.repo
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    counts: Counter = Counter()
    rows: list[dict] = []
    for brand_id, b in _published_by_brand(repo).items():
        host = b["host"] or ""
        if is_catalog_host(host):
            problem, new_name, source, verdict = "strona katalogu firm", None, "", "ukrycie"
        elif is_bad_name(b["brand_name"], host):
            problem = "nazwa strony zamiast nazwy firmy"
            new_name, source = better_name(b["brand_name"], host, repo.brand_titles(brand_id),
                                           repo.brand_description(brand_id), b["legal_name"])
            verdict = "zmiana nazwy" if new_name else "ukrycie"
        else:
            continue
        counts[verdict] += 1
        rows.append({
            "biuro": b["brand_name"], "domena": host, "miasta": ", ".join(x["city_name"] for x in b["listings"]),
            "problem": problem, "nowa_nazwa": new_name or "", "zrodlo": source, "decyzja": verdict,
            "profile": " ".join(f"/{x['city_slug']}/{x['slug']}" for x in b["listings"]),
        })
        if not apply:
            continue
        if verdict == "zmiana nazwy":
            repo.rename_brand(brand_id, new_name)
            for listing in b["listings"]:
                _reslug_listing(repo, listing, new_name, counts)
            repo.write_audit("pipeline", "brand.rename_bad_name", "brand", brand_id,
                             {"name": b["brand_name"]}, {"name": new_name, "source": source})
        else:
            for listing in b["listings"]:
                repo.set_listing_status(str(listing["id"]), "removed")
                repo.write_audit("pipeline", "listing.hide_bad_name", "listing", str(listing["id"]),
                                 {"status": "published", "name": b["brand_name"]}, {"status": "removed", "reason": problem})
        repo.conn.commit()
    _write_csv(out / "raport-nazwy.csv", rows)
    return dict(counts)


def stage_duplicates_report(ctx: Context, out_dir: str, apply: bool = False) -> dict:
    """Firmy opublikowane kilka razy: ten sam NIP (podmiot z rejestru) albo ta sama domena.

    Klucz scalania: NIP, a bez niego domena (bez www i subdomen). Ta sama nazwa w jednym mieście przy innym kluczu
    trafia do raportu tylko do przeglądu ("Biuro Nieruchomości" bywa różnymi firmami). Raport `raport-duplikaty.csv`.
    Z `apply` każdą grupę scala w profil firmy z największą liczbą danych: wpis duplikatu w mieście, w którym ta
    firma ma już wpis, jest wycofany i przekierowany, a w pozostałych miastach przechodzi na nią.
    """
    repo = ctx.repo
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    brands = _published_by_brand(repo)
    parent = {b: b for b in brands}

    def find(x: str) -> str:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    reasons: dict[str, str] = {}
    by_key: dict[tuple[str, str], list[str]] = defaultdict(list)
    for brand_id, b in brands.items():
        if b["nip"]:
            by_key[("ten sam NIP", b["nip"])].append(brand_id)
        if b["host"] and not is_catalog_host(b["host"]):
            by_key[("ta sama domena", registrable_domain(b["host"]))].append(brand_id)
    for (reason, _), ids in by_key.items():
        for other in ids[1:]:
            ra, rb = find(ids[0]), find(other)
            if ra != rb:
                parent[rb] = ra
            reasons[other] = reasons.get(other) or reason
            reasons[ids[0]] = reasons.get(ids[0]) or reason
    groups: dict[str, list[str]] = defaultdict(list)
    for brand_id in brands:
        groups[find(brand_id)].append(brand_id)

    counts: Counter = Counter()
    rows: list[dict] = []
    merged_ids: set[str] = set()
    city_words = {t for n in repo.city_names() for t in _tokens(n)}
    for ids in groups.values():
        if len(ids) < 2:
            continue
        keep = max(ids, key=lambda i: (brands[i]["nip"] is not None, brands[i]["facts"], brands[i]["offers"],
                                       -brands[i]["first_published"].timestamp()))
        for brand_id in ids:
            if brand_id == keep:
                continue
            b, k = brands[brand_id], brands[keep]
            same_city = bool({x["city_id"] for x in b["listings"]} & {x["city_id"] for x in k["listings"]})
            if _branch_names(b["brand_name"], k["brand_name"], city_words):
                # "Metrohouse Białogard" i "Metrohouse Szczecinek": ten sam NIP, ale osobne biura z własnymi stronami.
                counts["review"] += 1
                rows.append({
                    "biuro": b["brand_name"], "domena": b["host"] or "", "nip": b["nip"] or "",
                    "miasta": ", ".join(x["city_name"] for x in b["listings"]),
                    "scal_z": k["brand_name"], "scal_z_domena": k["host"] or "", "powod": reasons.get(brand_id, ""),
                    "decyzja": "do przeglądu (oddziały w różnych miastach)",
                    "profile": " ".join(f"/{x['city_slug']}/{x['slug']}" for x in b["listings"]),
                })
                continue
            if not (_names_alike(b["brand_name"], k["brand_name"], city_words) or same_city):
                # Ten sam NIP przy zupełnie innych nazwach w innych miastach: często sieć franczyzowa z NIP-em centrali.
                counts["review"] += 1
                rows.append({
                    "biuro": b["brand_name"], "domena": b["host"] or "", "nip": b["nip"] or "",
                    "miasta": ", ".join(x["city_name"] for x in b["listings"]),
                    "scal_z": k["brand_name"], "scal_z_domena": k["host"] or "", "powod": reasons.get(brand_id, ""),
                    "decyzja": "do przeglądu (różne nazwy, możliwa sieć franczyzowa)",
                    "profile": " ".join(f"/{x['city_slug']}/{x['slug']}" for x in b["listings"]),
                })
                continue
            merged_ids.add(brand_id)
            counts["merge"] += 1
            rows.append({
                "biuro": b["brand_name"], "domena": b["host"] or "", "nip": b["nip"] or "",
                "miasta": ", ".join(x["city_name"] for x in b["listings"]),
                "scal_z": k["brand_name"], "scal_z_domena": k["host"] or "", "powod": reasons.get(brand_id, ""),
                "decyzja": "scalenie",
                "profile": " ".join(f"/{x['city_slug']}/{x['slug']}" for x in b["listings"]),
            })
            if apply:
                _merge_brand(repo, b, k, counts)
                repo.conn.commit()

    # Ta sama nazwa w tym samym mieście przy innym NIP i domenie: tylko do przeglądu.
    same_name: dict[tuple[str, str], list[str]] = defaultdict(list)
    for brand_id, b in brands.items():
        if brand_id in merged_ids:
            continue
        for x in b["listings"]:
            same_name[(_fold(b["brand_name"]).strip(), str(x["city_id"]))].append(brand_id)
    for (_, _), ids in same_name.items():
        roots = {find(i) for i in ids}
        if len(roots) < 2:
            continue
        for brand_id in ids:
            b = brands[brand_id]
            counts["review"] += 1
            rows.append({
                "biuro": b["brand_name"], "domena": b["host"] or "", "nip": b["nip"] or "",
                "miasta": ", ".join(x["city_name"] for x in b["listings"]), "scal_z": "", "scal_z_domena": "",
                "powod": "ta sama nazwa w tym samym mieście, inny NIP i domena", "decyzja": "do przeglądu",
                "profile": " ".join(f"/{x['city_slug']}/{x['slug']}" for x in b["listings"]),
            })
    _write_csv(out / "raport-duplikaty.csv", rows)
    return dict(counts)


_NAME_FILLER = frozenset({"nieruchomosci", "nieruchomosc", "biuro", "biura", "agencja", "agent", "posrednictwo",
                          "pl", "com", "net", "eu", "sp", "z", "o", "i", "w", "na", "s", "c", "group", "grupa"})


def _names_alike(a: str, b: str, city_words: set[str]) -> bool:
    """Czy dwie nazwy mają wspólne znaczące słowo (bez słów branżowych i nazw miast): "Agent Power" i "AGENT POWER"."""
    def significant(name: str) -> set[str]:
        return {t for t in _tokens(name) if len(t) > 2 and t not in _NAME_FILLER and t not in city_words}
    return bool(significant(a) & significant(b))


def _branch_names(a: str, b: str, city_words: set[str]) -> bool:
    """Czy nazwy wskazują dwa oddziały: każda zawiera nazwę innego miasta ("Metrohouse Białogard", "Metrohouse Szczecinek")."""
    def cities(name: str) -> set[str]:
        return {t for t in _tokens(name) if len(t) >= 4 and t in city_words and t not in _NAME_FILLER}
    ca, cb = cities(a), cities(b)
    return bool(ca) and bool(cb) and not (ca & cb)


def _merge_brand(repo: Repo, dup: dict, keep: dict, counts: Counter) -> None:
    keep_id = str(keep["brand_id"])
    for listing in dup["listings"]:
        vertical_id, city_id = str(listing["vertical_id"]), str(listing["city_id"])
        old_path = f"/{listing['city_slug']}/{listing['slug']}"
        existing = repo.brand_listing_in_city(keep_id, vertical_id, city_id)
        if existing:
            if existing["status"] != "published":
                slug = existing["slug"] or _unique_slug(slugify(keep["brand_name"]) or "firma",
                                                         repo.taken_slugs(vertical_id, city_id))
                repo.publish_listing(str(existing["id"]), city_id, slug, None)
            repo.set_listing_status(str(listing["id"]), "removed")
            repo.add_listing_redirect(old_path, str(existing["id"]))
            repo.write_audit("pipeline", "listing.merge_brand", "listing", str(listing["id"]),
                             {"status": "published", "brand_id": str(dup["brand_id"])},
                             {"status": "removed", "redirect_to": str(existing["id"])})
            counts["merged_into_existing"] += 1
        else:
            repo.reassign_listing(str(listing["id"]), keep_id)
            repo.write_audit("pipeline", "listing.merge_brand", "listing", str(listing["id"]),
                             {"brand_id": str(dup["brand_id"])}, {"brand_id": keep_id})
            _reslug_listing(repo, {**listing, "brand_id": keep_id}, keep["brand_name"], counts)
            counts["merged_moved"] += 1
    repo.write_audit("pipeline", "brand.merge", "brand", str(dup["brand_id"]),
                     {"name": dup["brand_name"]}, {"merged_into": keep_id, "name": keep["brand_name"]})
