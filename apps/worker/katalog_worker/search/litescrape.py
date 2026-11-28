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
        results, self.skipped = self.search_ex(query, country=country, lang=lang)
        return results

    def search_ex(self, query: str, *, country: str = "pl", lang: str = "pl", count: int = 10) -> tuple[list[SearchResult], bool]:
        """Jak search, ale zwraca (wyniki, pominięta). Bezpieczne w wątkach: różne frazy idą równolegle."""
        page = 1
        if match := PAGE_SUFFIX.search(query):
            page = int(match.group(1))
            query = query[: match.start()]
        last = self._last_page.get(query)
        if last is not None and page > last:
            return [], True
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
        return results, False


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
        results, _ = self.search_ex(query, **kwargs)
        return results

    def search_ex(self, query: str, **kwargs) -> tuple[list[SearchResult], bool]:
        if self._current is self._primary:
            try:
                return self._primary.search_ex(query, **kwargs)
            except SearchError as exc:
                if self._backup is None:
                    raise
                self.switched = str(exc)[:200]
                self._current = self._backup
        return self._backup.search(query, **kwargs), False


class PrefetchSearch:
    """Pobiera wyniki wielu fraz naraz (różne frazy równolegle, kolejne strony jednej frazy po kolei, bo następna
    strona potrzebuje tokenu z poprzedniej), a potem oddaje je z pamięci tak jak zwykły dostawca.

    Jedno wyszukiwanie w LiteScrape trwa około minuty (rozwijanie linków Google), więc po kolei 15 miast to ok. 2 godziny.
    """

    def __init__(self, provider, workers: int = 12) -> None:
        self._provider = provider
        self._workers = workers
        self._cache: dict[str, tuple[list[SearchResult], bool] | SearchError] = {}
        self.skipped = False

    @property
    def name(self) -> str:
        return self._provider.name

    @property
    def cost_per_query_usd(self) -> float:
        return self._provider.cost_per_query_usd

    @property
    def switched(self):
        return getattr(self._provider, "switched", None)

    def prefetch(self, queries: list[str], *, country: str = "pl", lang: str = "pl") -> None:
        from concurrent.futures import ThreadPoolExecutor

        chains: dict[str, list[str]] = {}
        for query in queries:
            base = PAGE_SUFFIX.sub("", query)
            chains.setdefault(base, []).append(query)

        def run(chain: list[str]) -> None:
            for query in chain:
                if query in self._cache:
                    continue
                try:
                    self._cache[query] = self._provider.search_ex(query, country=country, lang=lang)
                except SearchError as exc:
                    self._cache[query] = exc

        with ThreadPoolExecutor(max_workers=self._workers) as pool:
            list(pool.map(run, chains.values()))

    def search(self, query: str, *, country: str = "pl", lang: str = "pl", count: int = 10) -> list[SearchResult]:
        cached = self._cache.pop(query, None)
        if cached is None:
            cached = self._provider.search_ex(query, country=country, lang=lang)
        if isinstance(cached, SearchError):
            raise cached
        results, self.skipped = cached
        return results
