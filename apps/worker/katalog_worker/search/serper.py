"""Adapter Serper (wyniki Google przez pośrednika).

KONTRAKT API ZAPISANY Z PAMIĘCI (nie zweryfikowany w tej sesji, bo sandbox nie ma dostępu do sieci):
POST https://google.serper.dev/search, nagłówek X-API-KEY, JSON {"q", "gl", "hl", "num"},
odpowiedź: {"organic": [{"title", "link", "snippet", "position"}]}.
Przy pierwszym żywym wywołaniu porównaj z dokumentacją Serper i zapisz prawdziwą odpowiedź jako fixture.

Uwaga prawna: to scraping Google przez dostawcę. Zobacz sekcję o ryzykach w docs/PLAN.md.
"""

from __future__ import annotations

import re
import time
from collections.abc import Callable

import httpx

from .base import SearchError, SearchResult

BASE_URL = "https://google.serper.dev/search"
RETRY_STATUSES = {429, 500, 502, 503, 504}
# "biuro nieruchomości Gdynia (strona 2)" = to samo zapytanie, kolejna strona wyników Google
PAGE_SUFFIX = re.compile(r"\s*\(strona (\d+)\)\s*$")


class SerperSearch:
    name = "serper"
    cost_per_query_usd = 0.001  # ok. $1 za 1000 zapytań w pakiecie startowym wg agregatorów

    def __init__(
        self,
        api_key: str,
        client: httpx.Client | None = None,
        base_url: str = BASE_URL,
        max_retries: int = 2,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        if not api_key:
            raise SearchError("Brak SERPER_API_KEY.")
        self._api_key = api_key
        self._client = client or httpx.Client(timeout=20.0)
        self._base_url = base_url
        self._max_retries = max_retries
        self._sleep = sleep

    def search(
        self, query: str, *, country: str = "pl", lang: str = "pl", count: int = 10
    ) -> list[SearchResult]:
        page = 1
        if match := PAGE_SUFFIX.search(query):
            page = int(match.group(1))
            query = query[: match.start()]
        body = {"q": query, "gl": country.lower(), "hl": lang.lower(), "num": min(max(count, 1), 10)}
        if page > 1:
            body["page"] = page
        headers = {"X-API-KEY": self._api_key, "Content-Type": "application/json"}
        response = None
        for attempt in range(self._max_retries + 1):
            response = self._client.post(self._base_url, json=body, headers=headers)
            if response.status_code not in RETRY_STATUSES or attempt == self._max_retries:
                break
            self._sleep(2.0**attempt)
        assert response is not None
        if response.status_code != 200:
            raise SearchError(f"Serper: HTTP {response.status_code}: {response.text[:200]}")
        try:
            payload = response.json()
        except ValueError as exc:
            raise SearchError("Serper: odpowiedź nie jest poprawnym JSON.") from exc
        results = []
        for index, item in enumerate(payload.get("organic") or [], start=1):
            url = item.get("link")
            if not url:
                continue
            results.append(
                SearchResult(url, item.get("title") or "", item.get("snippet") or "", item.get("position") or index)
            )
        return results
