"""Ładowanie konfiguracji branży (vertical pack) z packages/verticals/<slug>/vertical.yaml."""

from __future__ import annotations

from pathlib import Path

import yaml
from pydantic import BaseModel, Field

from .config import repo_root


class RegistryConfig(BaseModel):
    pkd: list[str] = Field(default_factory=list)
    expected_pkd: list[str] = Field(default_factory=list)


class SearchConfig(BaseModel):
    country: str = "pl"
    language: str = "pl"
    synonyms: list[str]
    specializations: list[str] = Field(default_factory=list)
    templates: list[str]
    max_queries_per_city: int = 40


class PublicationConfig(BaseModel):
    min_facts: int = 6


class RankingConfig(BaseModel):
    weights: dict[str, float] = Field(default_factory=dict)


class VerticalConfig(BaseModel):
    slug: str
    name: str
    domain: str | None = None
    registry: RegistryConfig = Field(default_factory=RegistryConfig)
    keywords: list[str]
    search: SearchConfig
    publication: PublicationConfig = Field(default_factory=PublicationConfig)
    pricing: dict = Field(default_factory=dict)
    ranking: RankingConfig = Field(default_factory=RankingConfig)


def verticals_dir() -> Path:
    return repo_root() / "packages" / "verticals"


def load_vertical(slug: str, base_dir: Path | None = None) -> VerticalConfig:
    path = (base_dir or verticals_dir()) / slug / "vertical.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Brak konfiguracji branży: {path}")
    return VerticalConfig.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))
