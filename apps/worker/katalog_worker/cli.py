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


def _print(data) -> None:
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
        _print(stage_contacts(ctx, _fetcher(settings), args.limit))
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
        ctx, _ = _context(args, conn)
        _print(stage_import(ctx))
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
    p = add("contacts", cmd_contacts, "telefon, e-mail firmowy i social media ze stron biur")
    p.add_argument("--limit", type=int, default=300)
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
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
