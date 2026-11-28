"""Adapter LiteScrape (wyniki Google). Kontrakt w katalog_worker/litescrape.py.

Jedno zapytanie zwraca do 10 wyników, więc 30 wyników na frazę to trzy kolejne strony. Zapytania przychodzą jako
"fraza", "fraza (strona 2)", "fraza (strona 3)": kolejną stronę pobieramy tokenem z poprzedniej (tak zaleca
dokumentacja), a bez tokenu przesunięciem start. Gdy Google nie ma już kolejnej strony, dalsze strony tej frazy
pomijamy bez zapytania (skipped = True, nie trafiają do statystyk).
"""

from __future__ import annotations

import re

from ..litescrape import COST_PER_CALL_USD, LiteScrapeClient, LiteScrapeError
from .base import SearchError, SearchResult

PAGE_SUFFIX = re.compile(r"\s*\(strona (\d+)\)\s*$")


class LiteScrapeSearch:
    name = "litescrape"
    cost_per_query_usd = COST_PER_CALL_USD

    def __init__(self, client: LiteScrapeClient) -> None:
        self._client = client
        self._tokens: dict[tuple[str, int], str] = {}  # (fraza, numer strony) -> token tej strony
        self._last_page: dict[str, int] = {}  # fraza -> ostatnia strona, jaką Google ma
        self.skipped = False

    def search(self, query: str, *, country: str = "pl", lang: str = "pl", count: int = 10) -> list[SearchResult]:
        self.skipped = False
        page = 1
        if match := PAGE_SUFFIX.search(query):
            page = int(match.group(1))
            query = query[: match.start()]
        last = self._last_page.get(query)
        if last is not None and page > last:
            self.skipped = True
            return []
        token = self._tokens.pop((query, page), None) if page > 1 else None
        try:
            data = self._client.search(query, gl=country.lower(), hl=lang.lower(), start=(page - 1) * 10,
                                       page_token=token)
        except LiteScrapeError as exc:
            raise SearchError(str(exc)) from None
        organic = data.get("organic_results") if isinstance(data.get("organic_results"), list) else []
        results = []
        for index, item in enumerate(organic, start=1):
            url = item.get("link") if isinstance(item, dict) else None
            if not isinstance(url, str) or not url.startswith("http") or "google.com/goto" in url:
                continue  # nierozwinięte przekierowanie Google to nie adres strony biura
            rank = (page - 1) * 10 + index
            results.append(SearchResult(url, item.get("title") or "", item.get("snippet") or "", rank))
        pagination = data.get("pagination") if isinstance(data.get("pagination"), dict) else {}
        next_token = pagination.get("next_page_token")
        if isinstance(next_token, str) and next_token:
            self._tokens[(query, page + 1)] = next_token
        elif not pagination.get("next") or not results:
            self._last_page[query] = page
        return results


class FallbackSearch:
    """Najpierw LiteScrape, a po jego błędzie (np. brak salda) zapasowy dostawca (Serper) do końca przebiegu."""

    def __init__(self, primary, backup) -> None:
        self._primary = primary
        self._backup = backup
        self._current = primary
        self.switched: str | None = None

    @property
    def name(self) -> str:
        return self._current.name

    @property
    def cost_per_query_usd(self) -> float:
        return self._current.cost_per_query_usd

    @property
    def skipped(self) -> bool:
        return bool(getattr(self._current, "skipped", False))

    def search(self, query: str, **kwargs) -> list[SearchResult]:
        if self._current is self._primary:
            try:
                return self._primary.search(query, **kwargs)
            except SearchError as exc:
                if self._backup is None:
                    raise
                self.switched = str(exc)[:200]
                self._current = self._backup
        return self._backup.search(query, **kwargs)
