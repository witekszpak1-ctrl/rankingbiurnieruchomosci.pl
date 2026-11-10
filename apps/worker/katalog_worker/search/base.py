"""Wspólny interfejs dostawców wyszukiwania. Dostawca jest wymienny (adapter)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


class SearchError(RuntimeError):
    """Błąd wyszukiwania. Komunikat nigdy nie zawiera klucza API."""


@dataclass(frozen=True)
class SearchResult:
    url: str
    title: str
    snippet: str
    rank: int  # 1 = pierwszy wynik


class SearchProvider(Protocol):
    name: str
    cost_per_query_usd: float

    def search(
        self, query: str, *, country: str = "pl", lang: str = "pl", count: int = 10
    ) -> list[SearchResult]: ...
