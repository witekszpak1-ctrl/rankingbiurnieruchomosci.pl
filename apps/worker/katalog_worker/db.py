"""Połączenie z bazą i prosty runner migracji (tylko w przód, z kontrolą sum kontrolnych)."""

from __future__ import annotations

import hashlib
import os
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

from .config import repo_root


class MigrationError(RuntimeError):
    pass


def connect(url: str | None = None) -> psycopg.Connection:
    dsn = url or os.environ.get("DATABASE_URL")
    if not dsn:
        raise RuntimeError("Brak DATABASE_URL (ustaw zmienną środowiskową lub podaj url).")
    return psycopg.connect(dsn, row_factory=dict_row)


def default_migrations_dir() -> Path:
    return repo_root() / "db" / "migrations"


def migration_files(migrations_dir: Path | None = None) -> list[Path]:
    directory = migrations_dir or default_migrations_dir()
    return sorted(directory.glob("*.sql"))


def _checksum(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def migrate(conn: psycopg.Connection, migrations_dir: Path | None = None) -> list[str]:
    """Stosuje brakujące migracje po kolei, każdą w osobnej transakcji.

    Zwraca listę właśnie zastosowanych wersji. Zmiana już zastosowanej migracji jest błędem.
    """
    with conn.transaction():
        conn.execute(
            """
            create table if not exists schema_migrations (
              version    text primary key,
              checksum   text not null,
              applied_at timestamptz not null default now()
            )
            """
        )
    applied = {
        row["version"]: row["checksum"]
        for row in conn.execute("select version, checksum from schema_migrations").fetchall()
    }
    newly_applied: list[str] = []
    for path in migration_files(migrations_dir):
        version = path.stem
        checksum = _checksum(path)
        if version in applied:
            if applied[version] != checksum:
                raise MigrationError(
                    f"Migracja {version} została zmieniona po zastosowaniu. "
                    "Dodaj nową migrację zamiast edytować starą."
                )
            continue
        with conn.transaction():
            conn.execute(path.read_text(encoding="utf-8"))
            conn.execute(
                "insert into schema_migrations (version, checksum) values (%s, %s)",
                (version, checksum),
            )
        newly_applied.append(version)
    return newly_applied
