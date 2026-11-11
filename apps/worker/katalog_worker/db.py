"""Połączenie z bazą i prosty runner migracji (tylko w przód, z kontrolą sum kontrolnych)."""

from __future__ import annotations

import hashlib
import os
import re
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

from .config import repo_root


class MigrationError(RuntimeError):
    pass


_URL_IN_TEXT = re.compile(r"postgres(?:ql)?://[^\s\"']+")
_URL_WITHOUT_SCHEME = re.compile(r"[^\s\"'@/:]+:[^\s\"'@/]+@[^\s\"'/]+/[^\s\"']+")


def clean_dsn(raw: str) -> str:
    """Wyciąga adres postgresql://... z tekstu wklejonego do sekretu (z etykietą, cudzysłowami albo białymi znakami).

    Adres bez schematu (użytkownik:hasło@host/baza) uzupełniamy o postgresql://. Tekst bez adresu (np. klasyczny napis
    host=... dbname=...) zwracamy bez zmian, tylko obcięty z brzegów.
    """
    found = _URL_IN_TEXT.search(raw)
    if found:
        return found.group(0)
    bare = _URL_WITHOUT_SCHEME.search(raw)
    if bare:
        return "postgresql://" + bare.group(0)
    return raw.strip()


def describe_dsn_problem(raw: str) -> str:
    """Opis kształtu błędnego DATABASE_URL bez ujawniania jego treści (logi mogą być czytane przez innych)."""
    yes = lambda cond: "tak" if cond else "nie"  # noqa: E731
    return (
        f"DATABASE_URL ma niepoprawny format ({len(raw)} znaków; zawiera postgresql://: {yes('postgres' in raw and '://' in raw)}; "
        f"zawiera @: {yes('@' in raw)}; zawiera =: {yes('=' in raw)}; zawiera odstępy: {yes(any(c.isspace() for c in raw.strip()))}; "
        f"wiele linii: {yes(len(raw.strip().splitlines()) > 1)}). "
        "Oczekiwany format to jedna linia: postgresql://użytkownik:hasło@host/baza?sslmode=require, bez etykiety."
    )


def connect(url: str | None = None) -> psycopg.Connection:
    dsn = url or os.environ.get("DATABASE_URL")
    if not dsn:
        raise RuntimeError("Brak DATABASE_URL (ustaw zmienną środowiskową lub podaj url).")
    try:
        return psycopg.connect(clean_dsn(dsn), row_factory=dict_row)
    except psycopg.ProgrammingError as exc:
        if "connection info string" in str(exc):
            raise RuntimeError(describe_dsn_problem(dsn)) from None
        raise


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
    # "create table if not exists" wymaga prawa CREATE w schemacie nawet wtedy, gdy tabela już jest, a rola aplikacji
    # (pipeline na GitHub Actions) nie ma tego prawa. Dlatego DDL tylko wtedy, gdy tabeli naprawdę brakuje.
    exists = conn.execute("select to_regclass('schema_migrations') is not null as present").fetchone()["present"]
    if not exists:
        with conn.transaction():
            conn.execute(
                """
                create table schema_migrations (
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
