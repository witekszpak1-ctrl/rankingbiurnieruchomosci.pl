"""Dostawca "z pliku": wyniki wyszukiwania zebrane poza workerem (np. przez Claude Code własnym narzędziem WebSearch).

Pozwala uruchomić pipeline bez płatnego klucza API wyszukiwarki. Plik JSON:

    {
      "city": "Wrocław",
      "collected_at": "2026-11-10",
      "queries": [
        {"query": "biuro nieruchomości Wrocław", "results": [{"url": "https://przyklad.pl/", "title": "...", "snippet": "..."}]}
      ]
    }

Pozycja wyniku wynika z kolejności na liście (od 1), chyba że podano pole "rank".
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit

from .base import SearchError, SearchResult


class FileSearch:
    name = "claude_websearch"
    cost_per_query_usd = 0.0

    def __init__(self, data: dict, *, source_sha256: str = "") -> None:
        self.source_sha256 = source_sha256
        self.city = self._text(data, "city", required=True)
        self.collected_at = str(data.get("collected_at") or "")
        raw_queries = data.get("queries")
        if not isinstance(raw_queries, list) or not raw_queries:
            raise SearchError("Plik kandydatów musi zawierać niepustą listę 'queries'.")
        self._results: dict[str, list[SearchResult]] = {}
        self.queries: list[str] = []
        for entry in raw_queries:
            if not isinstance(entry, dict):
                raise SearchError("Element listy 'queries' musi być obiektem.")
            query = self._text(entry, "query", required=True)
            raw_results = entry.get("results")
            if not isinstance(raw_results, list):
                raise SearchError(f"Zapytanie {query!r}: brak listy 'results'.")
            key = query.casefold()
            if key in self._results:
                raise SearchError(f"Zapytanie {query!r} występuje w pliku więcej niż raz.")
            self._results[key] = [self._result(query, i, item) for i, item in enumerate(raw_results, start=1)]
            self.queries.append(query)

    @staticmethod
    def _text(obj: dict, key: str, *, required: bool = False) -> str:
        value = obj.get(key)
        if not isinstance(value, str) or not value.strip():
            if required:
                raise SearchError(f"Brak pola tekstowego {key!r}.")
            return ""
        return value.strip()

    @staticmethod
    def _result(query: str, position: int, item: object) -> SearchResult:
        if not isinstance(item, dict):
            raise SearchError(f"Zapytanie {query!r}: wynik musi być obiektem.")
        url = item.get("url")
        parts = urlsplit(url) if isinstance(url, str) else None
        if not parts or parts.scheme not in ("http", "https") or not parts.netloc:
            raise SearchError(f"Zapytanie {query!r}: nieprawidłowy adres {url!r}.")
        rank = item.get("rank")
        return SearchResult(
            url=url,
            title=str(item.get("title") or ""),
            snippet=str(item.get("snippet") or ""),
            rank=rank if isinstance(rank, int) and rank > 0 else position,
        )

    @classmethod
    def from_path(cls, path: str | Path) -> "FileSearch":
        raw = Path(path).read_bytes()
        try:
            data = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise SearchError(f"Plik {path} nie jest poprawnym JSON: {exc}") from exc
        if not isinstance(data, dict):
            raise SearchError("Plik kandydatów musi być obiektem JSON.")
        return cls(data, source_sha256=hashlib.sha256(raw).hexdigest())

    def search(self, query: str, *, country: str = "pl", lang: str = "pl", count: int = 10) -> list[SearchResult]:
        return list(self._results.get(query.casefold(), []))[:count]
