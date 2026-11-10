"""Wspólne fixture'y. Testy bazy używają lokalnego Postgresa (TEST_ADMIN_URL) i bazy szablonowej."""

from __future__ import annotations

import os
import uuid
from pathlib import Path

import psycopg
import pytest
from psycopg.conninfo import make_conninfo

from katalog_worker.db import connect, migrate

FIXTURES = Path(__file__).parent / "fixtures"
ADMIN_URL = os.environ.get("TEST_ADMIN_URL", "postgresql://postgres@127.0.0.1:54329/postgres")


def fixture_text(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


def _admin() -> psycopg.Connection:
    return psycopg.connect(ADMIN_URL, autocommit=True)


@pytest.fixture(scope="session")
def template_db():
    try:
        admin = _admin()
    except Exception:  # pragma: no cover - zależy od środowiska
        pytest.skip("Brak lokalnego Postgresa do testów bazy (ustaw TEST_ADMIN_URL)")
    name = f"katalog_tpl_{uuid.uuid4().hex[:8]}"
    admin.execute(f'create database "{name}"')
    url = make_conninfo(ADMIN_URL, dbname=name)
    with connect(url) as conn:
        migrate(conn)
    yield name
    admin.execute(f'drop database if exists "{name}" with (force)')
    admin.close()


@pytest.fixture
def db_url(template_db):
    admin = _admin()
    name = f"katalog_t_{uuid.uuid4().hex[:10]}"
    admin.execute(f'create database "{name}" template "{template_db}"')
    yield make_conninfo(ADMIN_URL, dbname=name)
    admin.execute(f'drop database if exists "{name}" with (force)')
    admin.close()


@pytest.fixture
def db(db_url):
    with connect(db_url) as conn:
        yield conn
