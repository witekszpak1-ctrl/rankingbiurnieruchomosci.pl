"""Odkrywanie domen kandydatów z wyników wyszukiwania: dedup po domenie, filtr blocklisty."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from urllib.parse import urlsplit

from .classify import DEFAULT_BLOCKLIST
from .search.base import SearchProvider, SearchResult
from .urls import canonical_url, is_blocklisted, is_public_institution, registrable_domain


@dataclass
class Candidate:
    host: str  # domena rejestrowalna
    url: str  # kanoniczny adres najwyżej sklasyfikowanego wyniku (może być podstroną)
    best_rank: int
    queries: list[str] = field(default_factory=list)

    @property
    def home_url(self) -> str:
        """Strona główna domeny, od niej zaczyna się sprawdzanie kandydata."""
        parts = urlsplit(self.url)
        return f"https://{parts.netloc}/"


@dataclass
class QueryStat:
    query: str
    results: int
    new_candidates: int
    blocked: int
    cost_usd: float


def discover(
    provider: SearchProvider,
    queries: list[str],
    blocklist: dict[str, str] | None = None,
    *,
    country: str = "pl",
    lang: str = "pl",
    count: int = 10,
    known_hosts: set[str] | None = None,
    on_query: Callable[[str, list[SearchResult], QueryStat], None] | None = None,
) -> tuple[list[Candidate], list[QueryStat]]:
    """Uruchamia zapytania i zwraca unikalne domeny kandydatów oraz statystyki każdego zapytania.

    known_hosts: domeny już znane w bazie. Nie liczą się jako nowe, ale nadal są zwracane z pozycją.
    """
    blocklist = DEFAULT_BLOCKLIST if blocklist is None else blocklist
    blocked_domains = set(blocklist)
    known = known_hosts or set()
    candidates: dict[str, Candidate] = {}
    stats: list[QueryStat] = []
    for query in queries:
        results = provider.search(query, country=country, lang=lang, count=count)
        new_here = 0
        blocked_here = 0
        for result in results:
            host = registrable_domain(result.url)
            if not host:
                continue
            if is_blocklisted(result.url, blocked_domains) or is_public_institution(result.url):
                blocked_here += 1
                continue
            existing = candidates.get(host)
            if existing is None:
                candidates[host] = Candidate(host, canonical_url(result.url), result.rank, [query])
                if host not in known:
                    new_here += 1
            else:
                if result.rank < existing.best_rank:
                    existing.best_rank = result.rank
                    existing.url = canonical_url(result.url)
                if query not in existing.queries:
                    existing.queries.append(query)
        stat = QueryStat(query, len(results), new_here, blocked_here, provider.cost_per_query_usd)
        stats.append(stat)
        if on_query:
            on_query(query, results, stat)
    ordered = sorted(candidates.values(), key=lambda c: (c.best_rank, c.host))
    return ordered, stats
