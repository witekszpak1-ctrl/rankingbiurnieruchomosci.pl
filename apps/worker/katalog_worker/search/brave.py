"""Adapter Brave Search API.

KONTRAKT API ZAPISANY Z PAMIĘCI (nie zweryfikowany w tej sesji, bo sandbox nie ma dostępu do sieci):
GET /res/v1/web/search?q=&country=&search_lang=&count= z nagłówkiem X-Subscription-Token,
odpowiedź: {"web": {"results": [{"url", "title", "description"}]}}.
Przy pierwszym żywym wywołaniu porównaj z dokumentacją Brave i zapisz prawdziwą odpowiedź jako fixture.

Warunki: zapisywanie wyników wymaga planu z prawem do przechowywania. Zapisujemy tylko adres i pozycję.
"""

from __future__ import annotations

import time
from collections.abc import Callable

import httpx

from .base import SearchError, SearchResult

BASE_URL = "https://api.search.brave.com/res/v1/web/search"
RETRY_STATUSES = {429, 500, 502, 503, 504}


class BraveSearch:
    name = "brave"
    cost_per_query_usd = 0.005  # ok. $5 za 1000 zapytań wg agregatorów, do potwierdzenia na stronie Brave

    def __init__(
        self,
        api_key: str,
        client: httpx.Client | None = None,
        base_url: str = BASE_URL,
        max_retries: int = 2,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        if not api_key:
            raise SearchError("Brak BRAVE_API_KEY.")
        self._api_key = api_key
        self._client = client or httpx.Client(timeout=20.0)
        self._base_url = base_url
        self._max_retries = max_retries
        self._sleep = sleep

    def search(
        self, query: str, *, country: str = "pl", lang: str = "pl", count: int = 10
    ) -> list[SearchResult]:
        params = {
            "q": query,
            "country": country.upper(),
            "search_lang": lang.lower(),
            "count": min(max(count, 1), 20),
        }
        headers = {"X-Subscription-Token": self._api_key, "Accept": "application/json"}
        response = None
        for attempt in range(self._max_retries + 1):
            response = self._client.get(self._base_url, params=params, headers=headers)
            if response.status_code not in RETRY_STATUSES or attempt == self._max_retries:
                break
            self._sleep(2.0**attempt)
        assert response is not None
        if response.status_code != 200:
            raise SearchError(f"Brave: HTTP {response.status_code}: {response.text[:200]}")
        try:
            payload = response.json()
        except ValueError as exc:
            raise SearchError("Brave: odpowiedź nie jest poprawnym JSON.") from exc
        items = (payload.get("web") or {}).get("results") or []
        results = []
        for index, item in enumerate(items, start=1):
            url = item.get("url")
            if not url:
                continue
            results.append(SearchResult(url, item.get("title") or "", item.get("description") or "", index))
        return results
