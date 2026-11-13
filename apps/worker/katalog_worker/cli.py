"""Wiersz poleceń: katalog <polecenie>. Każdy etap pipeline'u jest osobnym poleceniem."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .config import Settings
from .db import connect, migrate
from .fetch import PoliteFetcher
from .queries import build_queries
from .verticals import load_vertical


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

    settings = Settings()
    return Context(Repo(conn), load_vertical(args.vertical), settings.snapshots_dir, settings.queue_dir), settings


def _fetcher(settings: Settings) -> PoliteFetcher:
    return PoliteFetcher(settings.crawler_user_agent, min_delay_seconds=settings.crawler_min_delay_seconds)


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
            provider, city = make_provider(args.provider, Settings()), args.city
    except SearchError as exc:
        print(f"Błąd: {exc}", file=sys.stderr)
        return 2

    with connect() as conn:
        ctx, _ = _context(args, conn)
        _print(
            stage_discover(
                ctx, provider, city, max_queries=args.max_queries, queries=queries, source_sha256=source_sha256
            )
        )
    return 0


def cmd_discover_queue(args) -> int:
    from .pipeline import stage_discover_queue
    from .search import SearchError, make_provider

    try:
        provider = make_provider(args.provider, Settings())
    except SearchError as exc:
        print(f"Błąd: {exc}", file=sys.stderr)
        return 2
    districts = json.loads(Path(args.districts).read_text(encoding="utf-8")) if Path(args.districts).exists() else {}
    districts = {k: v for k, v in districts.items() if isinstance(v, list)}
    with connect() as conn:
        ctx, _ = _context(args, conn)
        _print(stage_discover_queue(ctx, provider, args.cities, districts))
    return 0


def cmd_probe(args) -> int:
    from .pipeline import stage_probe

    with connect() as conn:
        ctx, settings = _context(args, conn)
        _print(stage_probe(ctx, _fetcher(settings), args.limit))
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


def cmd_crawl_deep(args) -> int:
    from .pipeline import stage_crawl_deep

    with connect() as conn:
        ctx, settings = _context(args, conn)
        _print(stage_crawl_deep(ctx, _fetcher(settings), args.limit))
    return 0


def cmd_offers(args) -> int:
    from .pipeline import stage_offers

    with connect() as conn:
        ctx, settings = _context(args, conn)
        _print(stage_offers(ctx, _fetcher(settings), args.limit, dry_run=args.dry_run))
    return 0


def cmd_contacts(args) -> int:
    from .pipeline import stage_contacts

    with connect() as conn:
        ctx, settings = _context(args, conn)
        _print(stage_contacts(ctx, _fetcher(settings), args.limit, only_new=args.only_new))
    return 0


def cmd_cities(args) -> int:
    from .pipeline import cities_export, read_city_list, stage_cities_sync

    with connect() as conn:
        ctx, settings = _context(args, conn)
        result = stage_cities_sync(ctx, read_city_list(Path(args.file)))
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


def cmd_google_reviews(args) -> int:
    from .pipeline import stage_google_reviews

    with connect() as conn:
        ctx, _ = _context(args, conn)
        _print(stage_google_reviews(ctx, args.limit))
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
    with connect() as conn:
        one = lambda sql: int(next(iter(dict(conn.execute(sql).fetchone()).values())))  # noqa: E731
        data = {
            "probe": one(
                "select count(*) from domains where classification = 'unknown' and verification_status = 'candidate'"
                " and (last_checked_at is null or last_checked_at < now() - interval '1 day')"
            ),
            "deep_crawl": one(
                "select count(*) from domains d where (d.verification_status = 'verified'"
                " or (d.verification_status = 'needs_review' and d.brand_id is not null))"
                " and (select count(*) from crawl_pages p where p.domain_id = d.id) < 3"
                " and (d.deep_crawled_at is null or d.deep_crawled_at < now() - interval '7 days')"
            ),
            "cities": one("select count(*) from cities where search_enabled and last_searched_at is null"),
        }
    data["total"] = data["probe"] + data["deep_crawl"] + data["cities"]
    _print(data)
    return 0


def cmd_status(args) -> int:
    from .repo import Repo

    with connect() as conn:
        _print(Repo(conn).status_counts())
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
    p.add_argument("--provider", choices=["brave", "serper", "file"], required=True)
    p.add_argument("--file", help="plik JSON z wynikami wyszukiwania (dostawca 'file', bez klucza API)")
    p.add_argument("--max-queries", type=int)
    p = add("discover-queue", cmd_discover_queue, "S1: szukaj biur przez API w kolejnych miastach z kolejki panelu")
    p.add_argument("--provider", choices=["brave", "serper"], default="serper")
    p.add_argument("--cities", type=int, default=15, help="ile miast w jednym przebiegu")
    p.add_argument("--districts", default="packages/verticals/nieruchomosci/districts.json")
    p = add("probe", cmd_probe, "S3: pobierz stronę główną i kontakt, sklasyfikuj")
    p.add_argument("--limit", type=int, default=50)
    p = add("verify", cmd_verify, "S4: NIP -> rejestry -> weryfikacja domeny")
    p.add_argument("--limit", type=int, default=50)
    p = add("crawl-deep", cmd_crawl_deep, "S5: kolejne podstrony zweryfikowanych domen")
    p.add_argument("--limit", type=int, default=20)
    p = add("offers", cmd_offers, "najnowsze oferty (tytuł i link) ze stron opublikowanych biur")
    p.add_argument("--limit", type=int, default=200)
    p.add_argument("--dry-run", action="store_true", help="tylko raport na stderr, bez zapisu w bazie")
    p = add("cities", cmd_cities, "dopisz miasta z listy branży do bazy i zapisz kolejkę wyszukiwania")
    p.add_argument("--file", default="packages/verticals/nieruchomosci/cities.txt")
    p.add_argument("--export", help="ścieżka pliku z kolejką miast (np. queue/cities.json)")
    p = add("prompts", cmd_prompts, "zapisz prompt opisów z panelu do pliku dla sesji Claude", vertical=False)
    p.add_argument("--export", default="queue/prompts/describe.md")
    p = add("google-reviews", cmd_google_reviews, "ocena i opinie z Google (Places API, wymaga GOOGLE_PLACES_API_KEY)")
    p.add_argument("--limit", type=int, default=100)
    p = add("contacts", cmd_contacts, "telefon, e-mail firmowy i social media ze stron biur")
    p.add_argument("--limit", type=int, default=300)
    p.add_argument("--only-new", action="store_true", help="tylko firmy jeszcze niesprawdzone (po każdym przebiegu)")
    p = add("publish-ready", cmd_publish_ready, "opublikuj wpisy spełniające bramkę (gdy auto_publish = true)")
    p.add_argument("--limit", type=int, default=200)
    add(
        "requeue-lost", cmd_requeue_lost,
        "zadania bez pliku paczki oznacz jako failed (tylko po pobraniu kolejki z queue-data, przed crawl-deep)",
    )
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
    add("status", cmd_status, "liczby rekordów według statusów", vertical=False)
    add("backlog", cmd_backlog, "ile pracy czeka na automat (do decyzji o kolejnym przebiegu)", vertical=False)
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
        run_id = repo.start_run(LOGGED[args.cmd], None)
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
