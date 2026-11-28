"""Wiersz poleceń: katalog <polecenie>. Każdy etap pipeline'u jest osobnym poleceniem."""

from __future__ import annotations

import argparse
import json
import sys
from contextlib import contextmanager
from pathlib import Path

from .config import Settings
from .db import connect, migrate
from .fetch import PoliteFetcher
from .queries import build_queries
from .repo import DEFAULT_VERTICAL
from .verticals import load_vertical, vertical_path


_LAST: dict = {}

# Polecenia, których każde uruchomienie trafia do pipeline_runs (widać je w panelu: co działa teraz i co było).
# discover, probe i verify zapisują przebiegi same.
LOGGED = {
    "discover-queue": "search",
    "import": "import",
    "publish-ready": "publish",
    "crawl-deep": "crawl_deep",
    "bundle": "bundle",
    "offers": "offers",
    "contacts": "contacts",
    "google-reviews": "google_reviews",
}


def _print(data) -> None:
    if isinstance(data, dict):
        _LAST.clear()
        _LAST.update(data)
    print(json.dumps(data, ensure_ascii=False, indent=2, default=str))


def _context(args, conn):
    from .pipeline import Context
    from .repo import Repo

    from .classify import DEFAULT_BLOCKLIST

    settings = Settings()
    vertical = load_vertical(args.vertical)
    blocklist = {**DEFAULT_BLOCKLIST, **vertical.blocklist}
    return Context(Repo(conn), vertical, settings.snapshots_dir, settings.queue_dir, blocklist), settings


def _fetcher(settings: Settings, litescrape=None):
    """Własny fetcher, a z kluczem LiteScrape (i włączonym pobieraniem stron w panelu) LiteScrape z własnym w zapasie."""
    own = PoliteFetcher(settings.crawler_user_agent, min_delay_seconds=settings.crawler_min_delay_seconds)
    client, config = litescrape or (None, None)
    if client is None or not config.use_fetch:
        return own
    from .litescrape import LiteScrapeFetcher

    return LiteScrapeFetcher(client, own, settings.crawler_user_agent)


@contextmanager
def _litescrape(ctx):
    """Klient LiteScrape na czas polecenia (klucz z panelu). Na końcu zapytania trafiają do licznika miesiąca."""
    from .litescrape import open_client, record_run_usage

    client, config = open_client(ctx.repo)
    try:
        yield client, config
    except BaseException:
        ctx.repo.conn.rollback()
        raise
    finally:
        if client is not None and client.total:
            record_run_usage(client.total)  # budżet przebiegu workflowu (LITESCRAPE_RUN_BUDGET), niezależny od bazy
            try:
                ctx.repo.api_usage_add(client.usage())
            except Exception as exc:  # noqa: BLE001 - zerwane połączenie nie może ukryć liczby zapytań
                try:
                    from .db import connect as _connect
                    from .repo import Repo

                    with _connect() as fresh:
                        Repo(fresh).api_usage_add(client.usage())
                except Exception:  # noqa: BLE001
                    print(json.dumps({"litescrape_usage_not_saved": client.usage(), "error": str(exc)[:200]}), file=sys.stderr)
            _LAST["litescrape_calls"] = client.total
            print(json.dumps({"litescrape": client.usage(), "stopped": client.disabled}, ensure_ascii=False),
                  file=sys.stderr)


def cmd_migrate(args) -> int:
    with connect() as conn:
        _print({"applied": migrate(conn)})
    return 0


def cmd_queries(args) -> int:
    vertical = load_vertical(args.vertical)
    _print(build_queries(vertical.search, args.city, limit=args.limit))
    return 0


def cmd_discover(args) -> int:
    from .pipeline import stage_discover
    from .search import FileSearch, SearchError, make_provider

    queries = None
    source_sha256 = None
    try:
        if args.provider == "file":
            if not args.file:
                print("Dostawca 'file' wymaga opcji --file.", file=sys.stderr)
                return 2
            provider = FileSearch.from_path(args.file)
            if args.city and args.city != provider.city:
                print(f"Miasto z opcji ({args.city}) różni się od miasta w pliku ({provider.city}).", file=sys.stderr)
                return 2
            city, queries, source_sha256 = provider.city, provider.queries, provider.source_sha256
        else:
            if not args.city:
                print("Opcja --city jest wymagana dla tego dostawcy.", file=sys.stderr)
                return 2
            city = args.city
            provider = None
    except SearchError as exc:
        print(f"Błąd: {exc}", file=sys.stderr)
        return 2

    with connect() as conn:
        ctx, _ = _context(args, conn)
        with _litescrape(ctx) as (client, _config):
            if provider is None:
                try:
                    provider = make_provider(args.provider, Settings(), litescrape=client)
                except SearchError as exc:
                    print(f"Błąd: {exc}", file=sys.stderr)
                    return 2
            _print(
                stage_discover(
                    ctx, provider, city, max_queries=args.max_queries, queries=queries, source_sha256=source_sha256
                )
            )
    return 0


def cmd_discover_queue(args) -> int:
    from .pipeline import stage_discover_queue
    from .search import SearchError, make_provider

    districts_path = Path(args.districts) if args.districts else vertical_path(args.vertical, "districts.json")
    districts = json.loads(districts_path.read_text(encoding="utf-8")) if districts_path.exists() else {}
    districts = {k: v for k, v in districts.items() if isinstance(v, list)}
    with connect() as conn:
        ctx, _ = _context(args, conn)
        with _litescrape(ctx) as (client, config):
            if not config.use_search:
                client = None  # szukanie przez LiteScrape wyłączone w panelu: tylko zapas (Serper)
            try:
                provider = make_provider(args.provider, Settings(), litescrape=client)
            except SearchError as exc:
                _print({"skipped": str(exc)})
                return 0
            result = stage_discover_queue(ctx, provider, args.cities, districts, config.search_pages)
            if getattr(provider, "switched", None):
                result["fallback"] = f"LiteScrape niedostępny, dalej Serper: {provider.switched}"
            _print(result)
            if result.get("incomplete_cities") or (result.get("search_errors") and not result.get("cities_ok")):
                # Żaden dostawca nie odpowiedział: miasta nie dostały znacznika przeszukania, przebieg ma status "failed".
                print("Wyszukiwanie nieudane: miasta bez odpowiedzi dostawcy nie zostały oznaczone jako przeszukane.",
                      file=sys.stderr)
                return 1
    return 0


def cmd_probe(args) -> int:
    from .pipeline import stage_probe

    with connect() as conn:
        ctx, settings = _context(args, conn)
        with _litescrape(ctx) as ls:
            _print(stage_probe(ctx, _fetcher(settings, ls), args.limit))
    return 0


def cmd_verify(args) -> int:
    from .pipeline import stage_verify
    from .registry import KrsClient, MfVatClient
    from .repo import DbCache

    with connect() as conn:
        ctx, settings = _context(args, conn)
        cache = DbCache(conn)
        mf = MfVatClient(settings.mf_vat_base_url, cache=cache)
        krs = KrsClient(settings.krs_base_url, cache=cache)
        _print(stage_verify(ctx, mf, krs, args.limit))
    return 0


def cmd_reverify(args) -> int:
    from .pipeline import stage_reverify
    from .registry import KrsClient, MfVatClient
    from .repo import DbCache

    with connect() as conn:
        ctx, settings = _context(args, conn)
        cache = DbCache(conn)
        mf = MfVatClient(settings.mf_vat_base_url, cache=cache)
        krs = KrsClient(settings.krs_base_url, cache=cache)
        _print(stage_reverify(ctx, mf, krs, args.limit))
    return 0


def cmd_extra_cities(args) -> int:
    from .pipeline import stage_extra_cities

    with connect() as conn:
        ctx, settings = _context(args, conn)
        _print(stage_extra_cities(ctx, args.min_offers))
    return 0


def cmd_cities_report(args) -> int:
    from .pipeline import stage_cities_report

    with connect() as conn:
        ctx, settings = _context(args, conn)
        _print(stage_cities_report(ctx, args.out, apply=args.apply))
    return 0


def cmd_names_report(args) -> int:
    from .pipeline import stage_names_report

    with connect() as conn:
        ctx, settings = _context(args, conn)
        _print(stage_names_report(ctx, args.out, apply=args.apply))
    return 0


def cmd_duplicates_report(args) -> int:
    from .pipeline import stage_duplicates_report

    with connect() as conn:
        ctx, settings = _context(args, conn)
        _print(stage_duplicates_report(ctx, args.out, apply=args.apply))
    return 0


def cmd_guard(args) -> int:
    from .guard import run_guard

    with connect() as conn:
        ctx, settings = _context(args, conn)
        result = run_guard(ctx.repo, accept=args.accept, vertical=ctx.queue_vertical, vertical_id=ctx.vertical_id)
        _print(result)
    # Kod błędu oznacza przebieg na GitHubie jako nieudany (powiadomienie), publikacja jest już wstrzymana.
    return 0 if result.get("ok", True) else 3


def cmd_crawl_deep(args) -> int:
    from .pipeline import stage_crawl_deep

    with connect() as conn:
        ctx, settings = _context(args, conn)
        with _litescrape(ctx) as ls:
            _print(stage_crawl_deep(ctx, _fetcher(settings, ls), args.limit))
    return 0


def cmd_offers(args) -> int:
    from .pipeline import stage_offers

    with connect() as conn:
        ctx, settings = _context(args, conn)
        with _litescrape(ctx) as ls:
            _print(stage_offers(ctx, _fetcher(settings, ls), args.limit, dry_run=args.dry_run))
    return 0


def cmd_contacts(args) -> int:
    from .pipeline import stage_contacts

    with connect() as conn:
        ctx, settings = _context(args, conn)
        with _litescrape(ctx) as ls:
            _print(stage_contacts(ctx, _fetcher(settings, ls), args.limit, only_new=args.only_new))
    return 0


def cmd_cities(args) -> int:
    from .pipeline import cities_export, read_city_list, stage_cities_sync

    with connect() as conn:
        ctx, settings = _context(args, conn)
        result = stage_cities_sync(ctx, read_city_list(Path(args.file) if args.file else vertical_path(args.vertical, "cities.txt")))
        if args.export:
            out = Path(args.export)
            out.parent.mkdir(parents=True, exist_ok=True)
            data = cities_export(ctx)
            out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            result["exported"] = len(data["cities"])
        _print(result)
    return 0


def cmd_prompts(args) -> int:
    """Zapisuje prompt opisów ustawiony w panelu (settings.describe_prompt) do pliku dla sesji Claude."""
    with connect() as conn:
        row = conn.execute("select value from settings where key = 'describe_prompt'").fetchone()
    text = (row or {}).get("value", {}).get("text") if row else None
    out = Path(args.export)
    if not isinstance(text, str) or not text.strip():
        _print({"exported": 0})
        return 0
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text.strip() + "\n", encoding="utf-8")
    _print({"exported": 1, "chars": len(text)})
    return 0


def cmd_ai_check(args) -> int:
    """Próbny pomiar odpowiedzi AI w Google przez LiteScrape (najwyżej --max zapytań, raport do kolejki)."""
    from .ai_check import run

    with connect() as conn:
        ctx, settings = _context(args, conn)
        with _litescrape(ctx) as (client, config):
            if client is None:
                _print({"ok": False, "error": "brak klucza LiteScrape w panelu"})
                return 2
            report = run(client, Path(args.out), max_calls=min(args.max, 15), paths=args.endpoint or None,
                         per_endpoint=args.per_endpoint, overview_search=not args.no_search)
    _print({k: report.get(k) for k in ("endpoint_used", "calls", "saved", "openapi_error")})
    return 0


def cmd_geo_measure(args) -> int:
    """Pomiary odpowiedzi AI (Gemini, AI Mode, AI Overview) przez LiteScrape do schematu geo. Płatne zapytania."""
    from . import geo_measure

    platforms = [p.strip() for p in args.platforms.split(",") if p.strip()]
    save_raw = Path(args.save_raw) if args.save_raw else None
    with connect() as conn:
        store = geo_measure.GeoStore(conn, args.vertical)
        kwargs = dict(industry=args.vertical, cities=args.cities, platforms=platforms, per_city=args.per_city_prompts,
                      max_calls=args.max_calls, max_age_days=args.max_age_days, save_raw=save_raw)
        try:
            if args.dry_run:
                report = geo_measure.run(store, None, dry_run=True, **kwargs)
            else:
                ctx, _settings = _context(args, conn)
                with _litescrape(ctx) as (client, _config):
                    if client is None:
                        _print({"ok": False, "error": "brak klucza LiteScrape w panelu"})
                        return 2
                    report = geo_measure.run(store, client, **kwargs)
        except ValueError as exc:
            _print({"ok": False, "error": str(exc)})
            return 2
    _print(report)
    return 0


def cmd_litescrape_check(args) -> int:
    """Test LiteScrape na żywo tą samą ścieżką co automat: saldo, dwie strony wyników Google, Mapy z opiniami dla
    kilku firm bez oceny i pobranie jednej strony. Wypisuje kształt odpowiedzi i przykładowe pola (bez klucza)."""
    from .google_maps import fetch_place
    from .litescrape import LiteScrapeError, LiteScrapeFetcher
    from .search import LiteScrapeSearch
    from .verify import name_similarity

    out: dict = {}
    with connect() as conn:
        ctx, settings = _context(args, conn)
        with _litescrape(ctx) as (client, config):
            if client is None:
                _print({"ok": False, "error": "brak klucza LiteScrape w panelu"})
                return 2
            try:
                status = client.key_status()
                out["key_status"] = {k: status.get(k) for k in ("status", "remaining_calls", "concurrency_limit")}
            except LiteScrapeError as exc:
                _print({"ok": False, "error": str(exc)})
                return 2
            import time as _time

            out["search_variants"] = {}
            for name, extra in {"szybki_bez_rozwijania": {"fast_mode": "true", "resolve_all_links": "false"},
                                "z_rozwijaniem": {"fast_mode": "true", "resolve_all_links": "true"}}.items():
                t0 = _time.monotonic()
                try:
                    data = client._get("search", "/api/google/search", {"q": f"agencja nieruchomości {args.city}", "gl": "pl",
                                       "hl": "pl", "num": 10, "timeout": 90, **extra}, timeout=110)
                    organic = data.get("organic_results") or []
                    out["search_variants"][name] = {
                        "sekund": round(_time.monotonic() - t0, 1), "wynikow": len(organic),
                        "goto": sum(1 for o in organic if "google.com/goto" in (o.get("link") or "")),
                        "przyklady": [{"link": (o.get("link") or "")[:60], "displayed_link": o.get("displayed_link"),
                                       "source": o.get("source")} for o in organic[:5]],
                    }
                except LiteScrapeError as exc:
                    out["search_variants"][name] = {"sekund": round(_time.monotonic() - t0, 1), "error": str(exc)}
            print(json.dumps({"search_variants": out["search_variants"]}, ensure_ascii=False, indent=1), file=sys.stderr)
            search = LiteScrapeSearch(client)
            out["search"] = {}
            for query in (f"biuro nieruchomości {args.city}", f"biuro nieruchomości {args.city} (strona 2)"):
                try:
                    results = search.search(query)
                    out["search"][query] = {"results": len(results), "sample": [(r.rank, r.url[:80]) for r in results[:4]]}
                except Exception as exc:  # noqa: BLE001 - raport testu
                    out["search"][query] = {"error": str(exc)}
            rows = ctx.repo.conn.execute(
                """select b.name, c.name as city, d.canonical_url as website from listings l
                   join brands b on b.id = l.brand_id join cities c on c.id = l.city_id
                   join lateral (select canonical_url from domains where brand_id = b.id
                                 order by verification_score desc nulls last limit 1) d on true
                   left join google_places g on g.brand_id = b.id
                   where l.status = 'published' and c.name = %s and (g.status is null or g.status <> 'ok')
                   order by b.name limit %s""",
                (args.city, args.firms),
            ).fetchall()
            out["maps"] = []
            for row in rows:
                place = fetch_place(client, row["name"], row["city"], row["website"],
                                    lambda found, n=row["name"]: name_similarity(n, found) >= 0.6, config.reviews_per_place)
                out["maps"].append({"firm": row["name"], "status": place.status, "rating": place.rating,
                                    "count": place.rating_count, "reviews": len(place.reviews),
                                    "replies": sum(1 for r in place.reviews if r.get("reply"))})
            if rows:
                fetcher = LiteScrapeFetcher(client, _fetcher(settings), settings.crawler_user_agent)
                page = fetcher.fetch(rows[0]["website"])
                out["fetch"] = {"url": rows[0]["website"], "ok": page.ok, "via": page.via, "chars": page.size,
                                "jsonld": "application/ld+json" in page.text, "error": page.error,
                                "litescrape_failures": dict(client.failures)}
            out["calls"] = client.usage()
    _print({"ok": True, **out})
    return 0


def cmd_google_reviews(args) -> int:
    from .pipeline import stage_google_reviews

    with connect() as conn:
        ctx, _ = _context(args, conn)
        with _litescrape(ctx) as (client, config):
            _print(stage_google_reviews(ctx, client, config, args.limit, args.max_age_days))
    return 0


def cmd_requeue_lost(args) -> int:
    from .pipeline import stage_requeue_lost

    with connect() as conn:
        ctx, _ = _context(args, conn)
        _print(stage_requeue_lost(ctx))
    return 0


def cmd_publish_ready(args) -> int:
    from .pipeline import stage_publish_ready

    with connect() as conn:
        ctx, _ = _context(args, conn)
        _print(stage_publish_ready(ctx, args.limit))
    return 0


def cmd_indexnow(args) -> int:
    import httpx

    from .indexnow import stage_indexnow
    from .repo import Repo

    settings = Settings()
    if args.vertical != DEFAULT_VERTICAL:
        # IndexNow zgłasza mapę strony portalu nieruchomości; inne branże nie mają jeszcze własnego portalu.
        _print({"skipped": f"IndexNow dotyczy portalu nieruchomości, nie branży {args.vertical}"})
        return 0
    with connect() as conn, httpx.Client(timeout=30.0, headers={"User-Agent": settings.crawler_user_agent}) as client:
        _print(stage_indexnow(Repo(conn), client, all_urls=args.all, dry_run=args.dry_run))
    return 0


def cmd_bundle(args) -> int:
    from .pipeline import stage_bundle

    with connect() as conn:
        ctx, _ = _context(args, conn)
        _print(stage_bundle(ctx, args.limit))
    return 0


def cmd_import(args) -> int:
    from .pipeline import stage_import

    with connect() as conn:
        from .pipeline import import_sessions

        ctx, _ = _context(args, conn)
        result = stage_import(ctx)
        result["claude_sessions"] = import_sessions(ctx)
        _print(result)
    return 0


def cmd_validate(args) -> int:
    """Waliduje pojedynczy wynik względem paczki (bez bazy). Kod wyjścia 0 = wynik poprawny."""
    from .validate import validate_result

    bundle = json.loads(Path(args.bundle).read_text(encoding="utf-8"))
    result = json.loads(Path(args.result).read_text(encoding="utf-8"))
    report = validate_result(bundle, result, args.max_overlap)
    _print(report.to_dict())
    return 0 if report.ok else 1


def cmd_ab_search(args) -> int:
    from dataclasses import asdict

    from .ab_search import load_entities_csv, run_ab
    from .search import make_provider

    settings = Settings()
    providers = [make_provider(name.strip(), settings) for name in args.providers.split(",")]
    stats = run_ab(load_entities_csv(Path(args.csv)), providers, queries_per_entity=args.queries_per_entity)
    _print([{**asdict(s), "hit_rate": round(s.hit_rate, 3)} for s in stats])
    return 0


# Okresy przechowywania danych z formularzy (miesiące). Te same liczby podaje polityka prywatności (apps/web/lib/legal.ts).
RETENTION_MONTHS = {"leads": 12, "requests": 24, "claims": 24, "visits": 24}


def cmd_purge_personal(args) -> int:
    from .repo import Repo

    with connect() as conn:
        counts = Repo(conn).purge_personal_data(RETENTION_MONTHS)
        conn.commit()
    _print({"deleted": counts, "retention_months": RETENTION_MONTHS})
    return 0


def cmd_backlog(args) -> int:
    """Ile pracy czeka na automat: domeny do otwarcia, domeny do pobrania podstron i nieprzeszukane miasta."""
    from .repo import Repo

    with connect() as conn:
        repo = Repo(conn)
        vertical_id = repo.vertical_id_by_slug(args.vertical)
        if vertical_id is None:
            # Branża jeszcze bez wiersza w bazie: nie ma domen ani wpisów, więc nie ma pracy.
            _print({"probe": 0, "deep_crawl": 0, "cities": 0, "total": 0})
            return 0
        scope, params = repo.domain_scope(vertical_id)
        one = lambda sql, p=(): int(next(iter(dict(conn.execute(sql, p).fetchone()).values())))  # noqa: E731
        data = {
            "probe": one(
                "select count(*) from domains d where d.classification = 'unknown' and d.verification_status = 'candidate'"
                f" and (d.last_checked_at is null or d.last_checked_at < now() - interval '1 day') and {scope}", params
            ),
            "deep_crawl": one(
                "select count(*) from domains d where (d.verification_status = 'verified'"
                " or (d.verification_status = 'needs_review' and d.brand_id is not null))"
                " and (select count(*) from crawl_pages p where p.domain_id = d.id) < 3"
                f" and (d.deep_crawled_at is null or d.deep_crawled_at < now() - interval '7 days') and {scope}", params
            ),
            "cities": repo.cities_unsearched_count(vertical_id),
        }
    data["total"] = data["probe"] + data["deep_crawl"] + data["cities"]
    _print(data)
    return 0


def cmd_status(args) -> int:
    from .repo import Repo

    with connect() as conn:
        repo = Repo(conn)
        vertical_id = repo.vertical_id_by_slug(args.vertical)
        if vertical_id is None and args.vertical != DEFAULT_VERTICAL:
            _print({"vertical": args.vertical, "note": "brak wiersza branży w bazie (jeszcze nic nie zebrano)"})
            return 0
        _print(repo.status_counts(vertical_id))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="katalog", description="Worker katalogu firm")
    sub = parser.add_subparsers(dest="cmd", required=True)

    def add(name, func, help_text, vertical=True):
        p = sub.add_parser(name, help=help_text)
        if vertical:
            p.add_argument("--vertical", default="nieruchomosci")
        p.set_defaults(func=func)
        return p

    add("migrate", cmd_migrate, "zastosuj migracje bazy", vertical=False)
    p = add("queries", cmd_queries, "pokaż zapytania wyszukiwarki dla miasta")
    p.add_argument("--city", required=True)
    p.add_argument("--limit", type=int)
    p = add("discover", cmd_discover, "S1: znajdź domeny kandydatów")
    p.add_argument("--city", help="miasto (dla dostawcy 'file' bierze się z pliku)")
    p.add_argument("--provider", choices=["auto", "litescrape", "brave", "serper", "file"], required=True)
    p.add_argument("--file", help="plik JSON z wynikami wyszukiwania (dostawca 'file', bez klucza API)")
    p.add_argument("--max-queries", type=int)
    p = add("discover-queue", cmd_discover_queue, "S1: szukaj biur przez API w kolejnych miastach z kolejki panelu")
    p.add_argument("--provider", choices=["auto", "litescrape", "brave", "serper"], default="auto",
                   help="auto = LiteScrape (klucz w panelu), a w zapasie Serper")
    p.add_argument("--cities", type=int, default=15, help="ile miast w jednym przebiegu")
    p.add_argument("--districts", help="domyślnie packages/verticals/<--vertical>/districts.json")
    p = add("probe", cmd_probe, "S3: pobierz stronę główną i kontakt, sklasyfikuj")
    p.add_argument("--limit", type=int, default=50)
    p = add("verify", cmd_verify, "S4: NIP -> rejestry -> weryfikacja domeny")
    p.add_argument("--limit", type=int, default=50)
    p = add("reverify", cmd_reverify, "ponowna weryfikacja biur bez potwierdzenia na wszystkich podstronach")
    p.add_argument("--limit", type=int, default=100)
    p = add("guard", cmd_guard, "kontrole po przebiegu: skoki liczby biur, złe nazwy, duplikaty; wstrzymanie publikacji")
    p.add_argument("--accept", action="store_true", help="zatwierdź obecny stan katalogu i odblokuj publikację")
    p = add("names-report", cmd_names_report, "firmy z nazwą strony zamiast nazwy biura: raport albo zapis (--apply)")
    p.add_argument("--out", default="queue/results/reports")
    p.add_argument("--apply", action="store_true", help="zmień nazwy i ukryj wpisy bez dobrej nazwy")
    p = add("duplicates-report", cmd_duplicates_report, "firmy opublikowane kilka razy (NIP, domena): raport albo scalenie")
    p.add_argument("--out", default="queue/results/reports")
    p.add_argument("--apply", action="store_true", help="scal grupy duplikatów")
    p = add("cities-report", cmd_cities_report, "przeliczenie miast wpisów nową regułą: raport na sucho albo zapis (--apply)")
    p.add_argument("--out", default="queue/results/reports", help="katalog na raport-miasta.csv i podsumowanie")
    p.add_argument("--apply", action="store_true", help="przenieś wpisy z pewnym źródłem innego miasta")
    p = add("extra-cities", cmd_extra_cities, "dodatkowe wpisy firm w miastach, w których mają oferty lub biuro")
    p.add_argument("--min-offers", type=int, default=3)
    p = add("crawl-deep", cmd_crawl_deep, "S5: kolejne podstrony zweryfikowanych domen")
    p.add_argument("--limit", type=int, default=20)
    p = add("offers", cmd_offers, "najnowsze oferty (tytuł i link) ze stron opublikowanych biur")
    p.add_argument("--limit", type=int, default=200)
    p.add_argument("--dry-run", action="store_true", help="tylko raport na stderr, bez zapisu w bazie")
    p = add("cities", cmd_cities, "dopisz miasta z listy branży do bazy i zapisz kolejkę wyszukiwania")
    p.add_argument("--file", help="domyślnie packages/verticals/<--vertical>/cities.txt")
    p.add_argument("--export", help="ścieżka pliku z kolejką miast (np. queue/cities.json)")
    p = add("prompts", cmd_prompts, "zapisz prompt opisów z panelu do pliku dla sesji Claude", vertical=False)
    p.add_argument("--export", default="queue/prompts/describe.md")
    p = add("ai-check", cmd_ai_check, "próbny pomiar odpowiedzi AI w Google przez LiteScrape (najwyżej 15 zapytań)")
    p.add_argument("--max", type=int, default=15)
    p.add_argument("--out", default="queue/results/reports")
    p.add_argument("--endpoint", action="append", help="ścieżka endpointu AI (można podać kilka)")
    p.add_argument("--per-endpoint", type=int, default=4)
    p.add_argument("--no-search", action="store_true", help="bez testu bloku AI w zwykłym wyszukiwaniu")
    p = add("geo-measure", cmd_geo_measure,
            "pomiary odpowiedzi AI (Gemini, AI Mode, AI Overview) przez LiteScrape do schematu geo (płatne, bezpiecznik 1000 na przebieg)")
    p.add_argument("--cities", type=int, default=3, help="ile największych miast (wg opublikowanych wpisów)")
    p.add_argument("--platforms", default="gemini,google_ai_mode,google_ai_overview")
    p.add_argument("--per-city-prompts", type=int, default=2, help="ile pytań z biblioteki na miasto")
    p.add_argument("--max-calls", type=int, default=20, help="limit płatnych zapytań (bezpiecznik 1000)")
    p.add_argument("--max-age-days", type=int, default=7, help="świeży pomiar młodszy niż tyle dni jest używany ponownie")
    p.add_argument("--save-raw", help="katalog na surowe odpowiedzi (jeden plik JSON na pomiar)")
    p.add_argument("--dry-run", action="store_true", help="tylko pokaż plan i trafienia pamięci podręcznej, bez zapytań")
    p = add("litescrape-check", cmd_litescrape_check, "test LiteScrape na żywo (najwyżej 4 zapytania)")
    p.add_argument("--city", default="Gdynia")
    p.add_argument("--firms", type=int, default=5)
    p = add("google-reviews", cmd_google_reviews, "ocena i opinie z Map Google (LiteScrape, klucz w panelu)")
    p.add_argument("--limit", type=int, default=400)
    p.add_argument("--max-age-days", type=int, default=30, help="odśwież firmy pobrane dawniej niż tyle dni (0 = wszystkie)")
    p = add("contacts", cmd_contacts, "telefon, e-mail firmowy i social media ze stron biur")
    p.add_argument("--limit", type=int, default=300)
    p.add_argument("--only-new", action="store_true", help="tylko firmy jeszcze niesprawdzone (po każdym przebiegu)")
    p = add("publish-ready", cmd_publish_ready, "opublikuj wpisy spełniające bramkę (gdy auto_publish = true)")
    p.add_argument("--limit", type=int, default=200)
    add(
        "requeue-lost", cmd_requeue_lost,
        "zadania bez pliku paczki oznacz jako failed (tylko po pobraniu kolejki z queue-data, przed crawl-deep)",
    )
    p = add("indexnow", cmd_indexnow, "zgłoś Bingowi (IndexNow) nowe i zmienione strony z mapy strony (tylko nieruchomości)")
    p.add_argument("--all", action="store_true", help="zgłoś wszystkie adresy z mapy strony, nie tylko zmienione")
    p.add_argument("--dry-run", action="store_true", help="tylko policz adresy, bez wysyłki")
    p = add("bundle", cmd_bundle, "S6: przygotuj paczki dla Claude Code")
    p.add_argument("--limit", type=int, default=50)

    add("import", cmd_import, "S7: zwaliduj i zaimportuj wyniki z kolejki")
    p = add("validate", cmd_validate, "zwaliduj pojedynczy wynik względem paczki", vertical=False)
    p.add_argument("--bundle", required=True)
    p.add_argument("--result", required=True)
    p.add_argument("--max-overlap", type=float, default=0.2)
    p = add("ab-search", cmd_ab_search, "porównaj dostawców wyszukiwania na zestawie podmiotów", vertical=False)
    p.add_argument("--csv", required=True)
    p.add_argument("--providers", default="brave,serper")
    p.add_argument("--queries-per-entity", type=int, default=2)
    add("status", cmd_status, "liczby rekordów według statusów (domeny, wpisy i kolejka wskazanej branży)")
    add("backlog", cmd_backlog, "ile pracy czeka na automat (do decyzji o kolejnym przebiegu)")
    add(
        "purge-personal", cmd_purge_personal,
        "usuń dane z formularzy i statystyki wejść po okresie przechowywania (12 lub 24 mies.)", vertical=False,
    )
    return parser


def _numeric(data: dict) -> dict:
    return {k: v for k, v in data.items() if isinstance(v, (int, float)) and not isinstance(v, bool)}


def _run_logged(args) -> int:
    """Zapisuje start polecenia od razu (widać go w panelu jako trwające), a po końcu wynik albo błąd."""
    from .repo import Repo

    try:
        log_conn = connect()
        repo = Repo(log_conn)
        run_id = repo.start_run(LOGGED[args.cmd], repo.vertical_id_by_slug(getattr(args, "vertical", None)))
        log_conn.commit()
    except Exception:  # noqa: BLE001 - brak bazy nie może zatrzymać właściwej pracy
        return args.func(args)
    _LAST.clear()
    try:
        code = args.func(args)
    except Exception as exc:
        repo.finish_run(run_id, "failed", _numeric(_LAST), errors=[{"message": str(exc)[:500]}])
        log_conn.commit()
        log_conn.close()
        raise
    repo.finish_run(run_id, "ok" if code == 0 else "failed", _numeric(_LAST))
    log_conn.commit()
    log_conn.close()
    return code


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.cmd in LOGGED and not getattr(args, "dry_run", False):
        return _run_logged(args)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
