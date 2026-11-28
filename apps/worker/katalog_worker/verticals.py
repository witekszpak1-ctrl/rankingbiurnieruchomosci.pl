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
    # Frazy wyszukiwania miasta w kolejce panelu (discover-queue); {city} i {district} podstawia kod.
    # Puste = trzy pierwsze synonimy w postaci "{synonym} {city}".
    city_phrases: list[str] = Field(default_factory=list)
    # Frazy dokładnego przeszukania dużego miasta (więcej stron wyników). Puste = city_phrases.
    deep_phrases: list[str] = Field(default_factory=list)
    # Fraza na dzielnicę przy dokładnym przeszukaniu, np. "biuro nieruchomości {city} {district}". Puste = bez dzielnic.
    district_phrase: str | None = None
    # Fraza branży dopisywana do nazwy firmy w zapytaniu do Map Google. Puste = pierwszy synonim.
    maps_phrase: str | None = None

    def core_phrases(self) -> list[str]:
        return self.city_phrases or [f"{s} {{city}}" for s in self.synonyms[:3]]

    def deep_core_phrases(self) -> list[str]:
        return self.deep_phrases or self.core_phrases()

    def maps_label(self) -> str:
        return self.maps_phrase or (self.synonyms[0] if self.synonyms else "")


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
    # Domeny branżowe, które nigdy nie są stroną jednej firmy (domena -> etykieta), dokładane do DEFAULT_BLOCKLIST.
    blocklist: dict[str, str] = Field(default_factory=dict)


def verticals_dir() -> Path:
    return repo_root() / "packages" / "verticals"


def vertical_path(slug: str, name: str, base_dir: Path | None = None) -> Path:
    """Plik z pakietu branży (cities.txt, districts.json, prompts/...): packages/verticals/<slug>/<name>."""
    return (base_dir or verticals_dir()) / slug / name


def load_vertical(slug: str, base_dir: Path | None = None) -> VerticalConfig:
    path = (base_dir or verticals_dir()) / slug / "vertical.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Brak konfiguracji branży: {path}")
    return VerticalConfig.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))
