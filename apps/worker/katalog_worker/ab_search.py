"""Porównanie dostawców wyszukiwania na zestawie podmiotów z rejestru (test A/B Brave vs Serper).

Wejście: CSV z kolumnami name, city oraz (opcjonalnie) expected_domain z ręcznie potwierdzoną domeną.
Wyjście: statystyki per dostawca: trafność (hit@k), MRR, liczba zapytań i szacowany koszt.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

from .classify import DEFAULT_BLOCKLIST
from .queries import entity_queries
from .search.base import SearchProvider
from .urls import is_blocklisted, registrable_domain


@dataclass(frozen=True)
class Entity:
    name: str
    city: str
    expected_domain: str | None = None


@dataclass
class ProviderStats:
    provider: str
    entities: int
    labeled: int
    hits: int
    mrr: float
    queries: int
    cost_usd: float
    avg_domains_per_entity: float

    @property
    def hit_rate(self) -> float:
        return self.hits / self.labeled if self.labeled else 0.0


def load_entities_csv(path: Path) -> list[Entity]:
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        entities = []
        for row in reader:
            name = (row.get("name") or "").strip()
            city = (row.get("city") or "").strip()
            if not name or not city:
                continue
            expected = (row.get("expected_domain") or "").strip()
            entities.append(Entity(name, city, registrable_domain(expected) if expected else None))
        return entities


def run_ab(
    entities: list[Entity],
    providers: list[SearchProvider],
    *,
    k: int = 10,
    queries_per_entity: int = 2,
    blocklist: dict[str, str] | None = None,
) -> list[ProviderStats]:
    blocklist = DEFAULT_BLOCKLIST if blocklist is None else blocklist
    blocked = set(blocklist)
    stats: list[ProviderStats] = []
    for provider in providers:
        hits = 0
        labeled = 0
        reciprocal_sum = 0.0
        queries_run = 0
        domain_count = 0
        for entity in entities:
            domains: list[str] = []
            for query in entity_queries(entity.name, entity.city)[:queries_per_entity]:
                queries_run += 1
                for result in provider.search(query, count=k):
                    if is_blocklisted(result.url, blocked):
                        continue
                    domain = registrable_domain(result.url)
                    if domain and domain not in domains:
                        domains.append(domain)
            domain_count += len(domains)
            if entity.expected_domain:
                labeled += 1
                if entity.expected_domain in domains[:k]:
                    hits += 1
                    reciprocal_sum += 1.0 / (domains.index(entity.expected_domain) + 1)
        stats.append(
            ProviderStats(
                provider=provider.name,
                entities=len(entities),
                labeled=labeled,
                hits=hits,
                mrr=reciprocal_sum / labeled if labeled else 0.0,
                queries=queries_run,
                cost_usd=round(queries_run * provider.cost_per_query_usd, 4),
                avg_domains_per_entity=domain_count / len(entities) if entities else 0.0,
            )
        )
    return stats
