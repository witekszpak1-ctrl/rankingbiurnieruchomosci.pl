from __future__ import annotations

import shutil
from pathlib import Path

import psycopg
import pytest

from katalog_worker.db import MigrationError, default_migrations_dir, migrate

EXPECTED_TABLES = {
    "verticals", "vertical_versions", "cities", "legal_entities", "brands", "domains",
    "locations", "contacts", "social_links", "listings", "crawl_pages", "facts",
    "price_items", "review_links", "descriptions", "pipeline_runs", "search_queries",
    "search_results", "queue_items", "registry_cache", "audit_log", "settings",
    "schema_migrations", "requests",
}


def _tables(conn) -> set[str]:
    rows = conn.execute(
        "select table_name from information_schema.tables where table_schema = 'public'"
    ).fetchall()
    return {r["table_name"] for r in rows}


def test_schema_has_expected_tables(db):
    assert EXPECTED_TABLES <= _tables(db)


def test_migrate_is_idempotent(db):
    assert migrate(db) == []  # szablon ma już wszystko zastosowane
    versions = [r["version"] for r in db.execute("select version from schema_migrations order by version").fetchall()]
    assert versions == ["0001_init", "0002_requests"]


def test_changed_applied_migration_is_rejected(db, tmp_path):
    copy_dir = tmp_path / "migrations"
    shutil.copytree(default_migrations_dir(), copy_dir)
    (copy_dir / "0001_init.sql").write_text("-- zmienione\n", encoding="utf-8")
    with pytest.raises(MigrationError):
        migrate(db, copy_dir)


def test_nip_constraints(db):
    db.execute("insert into legal_entities (nip, name) values ('7740001454', 'Test SA')")
    with pytest.raises(psycopg.errors.UniqueViolation):
        db.execute("insert into legal_entities (nip, name) values ('7740001454', 'Inny')")
    db.rollback()
    with pytest.raises(psycopg.errors.CheckViolation):
        db.execute("insert into legal_entities (nip, name) values ('123', 'Zly')")
    db.rollback()


def test_listing_unique_per_brand_vertical_city(db):
    entity = db.execute(
        "insert into legal_entities (nip, name) values ('7740001454', 'Test') returning id"
    ).fetchone()["id"]
    brand = db.execute(
        "insert into brands (legal_entity_id, name) values (%s, 'Marka') returning id", (entity,)
    ).fetchone()["id"]
    vertical = db.execute(
        "insert into verticals (slug, name) values ('nieruchomosci', 'Nieruchomości') returning id"
    ).fetchone()["id"]
    city = db.execute(
        "insert into cities (name, slug) values ('Wrocław', 'wroclaw') returning id"
    ).fetchone()["id"]
    db.execute(
        "insert into listings (brand_id, vertical_id, city_id) values (%s, %s, %s)",
        (brand, vertical, city),
    )
    with pytest.raises(psycopg.errors.UniqueViolation):
        db.execute(
            "insert into listings (brand_id, vertical_id, city_id) values (%s, %s, %s)",
            (brand, vertical, city),
        )
    db.rollback()


def test_queue_item_requires_target(db):
    with pytest.raises(psycopg.errors.CheckViolation):
        db.execute(
            "insert into queue_items (type, bundle_path, bundle_sha256) values ('describe', 'x.json', 'abc')"
        )
    db.rollback()


def test_default_dir_points_to_repo_migrations():
    assert Path(default_migrations_dir(), "0001_init.sql").exists()


def test_requests_constraints(db):
    ok = "insert into requests (kind, requester_email, message, nip) values (%s, %s, %s, %s)"
    db.execute(ok, ("correction", "a@b.pl", "Proszę o poprawę adresu firmy.", "1234563218"))
    db.execute(ok, ("removal", "a@b.pl", "Proszę o usunięcie wpisu.", None))
    assert db.execute("select status from requests limit 1").fetchone()["status"] == "new"
    for bad in [
        ("nieznany", "a@b.pl", "Wystarczająco długa treść.", None),  # rodzaj spoza listy
        ("other", "a@b.pl", "krótka", None),  # treść poniżej 10 znaków
        ("other", "a@b.pl", "x" * 2001, None),  # treść powyżej 2000 znaków
        ("other", "a@b.pl", "Wystarczająco długa treść.", "123"),  # zły NIP
    ]:
        with pytest.raises(Exception):
            with db.transaction():
                db.execute(ok, bad)


def test_clean_dsn_extracts_url_from_pasted_text():
    from katalog_worker.db import clean_dsn

    url = "postgresql://u:p@host.example/db?sslmode=require"
    assert clean_dsn(url) == url
    assert clean_dsn(f"  {url}\n") == url
    assert clean_dsn(f"Wartość: {url}") == url  # wklejona cała linia z etykietą
    assert clean_dsn(f'"{url}"') == url
    assert clean_dsn(f"DATABASE_URL={url}") == url
    assert clean_dsn("postgres://u@h/db") == "postgres://u@h/db"
    assert clean_dsn("  host=localhost dbname=x ") == "host=localhost dbname=x"


def test_migrate_needs_no_create_privilege_when_nothing_is_pending(db_url):
    """Pipeline działa na roli bez prawa CREATE: gdy wszystko zastosowane, migrate nie robi żadnego DDL."""
    import uuid

    import psycopg
    from conftest import ADMIN_URL
    from psycopg.conninfo import make_conninfo

    from katalog_worker.db import connect

    role = f"katalog_role_{uuid.uuid4().hex[:8]}"
    admin = psycopg.connect(ADMIN_URL, autocommit=True)
    owner = psycopg.connect(db_url, autocommit=True)
    try:
        admin.execute(f'create role "{role}" login')
        owner.execute(f'grant usage on schema public to "{role}"')
        owner.execute(f'grant select, insert, update, delete on all tables in schema public to "{role}"')
        owner.execute("revoke create on schema public from public")
        with connect(make_conninfo(db_url, user=role)) as conn:
            assert migrate(conn) == []
    finally:
        owner.execute(f'drop owned by "{role}"')
        owner.close()
        admin.execute(f'drop role if exists "{role}"')
        admin.close()


def test_clean_dsn_adds_missing_scheme():
    from katalog_worker.db import clean_dsn

    assert clean_dsn("katalog_app:tajne123@ep-x.example.tech/katalog?sslmode=require") == (
        "postgresql://katalog_app:tajne123@ep-x.example.tech/katalog?sslmode=require"
    )
    assert clean_dsn("DATABASE_URL: katalog_app:tajne123@host/db") == "postgresql://katalog_app:tajne123@host/db"


def test_connect_reports_bad_dsn_shape_without_leaking_it(monkeypatch):
    import pytest as _p

    from katalog_worker.db import connect

    secret = "Wartosc tajne-haslo-12345 bez adresu"
    monkeypatch.setenv("DATABASE_URL", secret)
    with _p.raises(RuntimeError) as info:
        connect()
    message = str(info.value)
    assert "niepoprawny format" in message and "zawiera postgresql://: nie" in message
    assert "tajne-haslo-12345" not in message and secret not in message
