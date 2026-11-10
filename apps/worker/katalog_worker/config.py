"""Konfiguracja z zmiennych środowiskowych. Żadnych sekretów w kodzie."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    return float(raw) if raw else default


@dataclass(frozen=True)
class Settings:
    database_url: str | None = field(default_factory=lambda: os.environ.get("DATABASE_URL"))
    brave_api_key: str | None = field(default_factory=lambda: os.environ.get("BRAVE_API_KEY") or None)
    serper_api_key: str | None = field(default_factory=lambda: os.environ.get("SERPER_API_KEY") or None)
    mf_vat_base_url: str = field(
        default_factory=lambda: os.environ.get("MF_VAT_BASE_URL", "https://wl-api.mf.gov.pl")
    )
    krs_base_url: str = field(
        default_factory=lambda: os.environ.get("KRS_BASE_URL", "https://api-krs.ms.gov.pl")
    )
    crawler_user_agent: str = field(
        default_factory=lambda: os.environ.get(
            "CRAWLER_USER_AGENT", "KatalogBot/0.1 (+kontakt: ustaw-adres-kontaktowy)"
        )
    )
    crawler_min_delay_seconds: float = field(
        default_factory=lambda: _float("CRAWLER_MIN_DELAY_SECONDS", 2.0)
    )
    queue_dir: Path = field(default_factory=lambda: Path(os.environ.get("QUEUE_DIR", "./queue")))
    snapshots_dir: Path = field(default_factory=lambda: Path(os.environ.get("SNAPSHOTS_DIR", "./snapshots")))


def repo_root() -> Path:
    """Katalog główny repozytorium (apps/worker/katalog_worker/config.py -> ../../..)."""
    return Path(__file__).resolve().parents[3]
