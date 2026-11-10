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
