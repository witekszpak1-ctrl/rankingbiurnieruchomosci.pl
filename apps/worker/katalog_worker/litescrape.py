"""Klient LiteScrape (https://litescrape.com): wyniki Google, Mapy Google z opiniami i pobieranie stron biur.

Klucz wpisuje się w panelu (/admin/koszty), zapis w settings.litescrape ({"apiKey": ..., ustawienia}). Zmienna
LITESCRAPE_API_KEY działa jako zapas, gdy w panelu nie ma klucza. Klucz nigdy nie trafia do logów ani komunikatów.

Kontrakt z dokumentacji i specyfikacji OpenAPI (https://litescrape.com/api/openapi.json, stan z 27.11.2026):
- adres https://api.litescrape.com, nagłówek Authorization: Bearer <klucz>,
- GET /api/google/search (q, gl, hl, num 1-10, start, page_token, fast_mode) -> organic_results[], pagination,
- GET /api/google/maps (q, type=search, hl, gl) -> local_results[] (title, place_id, data_id, rating, reviews,
  website, address, phone, permanently_closed),
- GET /api/google/reviews (place_id, num 1-100, sort_by qualityScore|newestFirst, hl, gl) -> place_info, reviews[]
  (snippet, extracted_snippet.original, rating, iso_date, date, user.name, response.snippet),
- GET /api/web/fetch (url, respond_with=html, robots_txt, user_agent, assert_status_code, timeout do 90 s),
- GET /api/keys/status -> remaining_calls, concurrency_limit, status (bez kosztu).
Udane zapytanie to jedno wywołanie z przedpłaconego salda (0,15 USD za 1000). Błędy 400, 404 i 503 nie są liczone.
401 (zły klucz), 403 (klucz wyłączony) i 402 (brak salda albo miesięcznego przydziału) wyłączają klienta do końca
przebiegu: wyszukiwarka przechodzi wtedy na zapas (Serper), a pobieranie stron na własny crawler.
"""

from __future__ import annotations

import json
import os
import threading
import time
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass
from urllib.parse import urlsplit

import httpx

from .fetch import FetchResult, PoliteFetcher

SETTINGS_KEY = "litescrape"
BASE_URL = "https://api.litescrape.com"
COST_PER_CALL_USD = 0.00015
DEFAULT_SEARCH_RESULTS = 30  # wyników Google na frazę: 3 strony po 10
MAX_SEARCH_RESULTS = 300
DEFAULT_REVIEWS = 50  # opinii na firmę w jednym zapytaniu (API zwraca do 100)
FATAL_STATUSES = {401, 402, 403}
RETRY_STATUSES = {429, 500, 502, 503, 504}


@dataclass(frozen=True)
class LiteScrapeConfig:
    api_key: str | None = None
    search_results: int = DEFAULT_SEARCH_RESULTS
    use_search: bool = True
    use_maps: bool = True
    use_fetch: bool = True
    reviews_per_place: int = DEFAULT_REVIEWS

    @property
    def search_pages(self) -> int:
        """Ile stron wyników Google (po 10) pobrać na jedną frazę."""
        return max(1, -(-self.search_results // 10))


def _int(raw, default: int, low: int, high: int) -> int:
    try:
        return max(low, min(high, int(raw)))
    except (TypeError, ValueError):
        return default


def config_from_value(value: dict | None, env_key: str | None = None) -> LiteScrapeConfig:
    """Ustawienia z settings.litescrape. Klucz z panelu ma pierwszeństwo przed zmienną środowiskową."""
    value = value if isinstance(value, dict) else {}
    key = value.get("apiKey") if isinstance(value.get("apiKey"), str) else None
    key = (key or env_key or "").strip() or None
    return LiteScrapeConfig(
        api_key=key,
        search_results=_int(value.get("searchResults"), DEFAULT_SEARCH_RESULTS, 10, MAX_SEARCH_RESULTS),
        use_search=value.get("useSearch") is not False,
        use_maps=value.get("useMaps") is not False,
        use_fetch=value.get("useFetch") is not False,
        reviews_per_place=_int(value.get("reviewsPerPlace"), DEFAULT_REVIEWS, 1, 100),
    )


def load_config(repo) -> LiteScrapeConfig:
    return config_from_value(repo.setting(SETTINGS_KEY, {}), os.environ.get("LITESCRAPE_API_KEY"))


class LiteScrapeError(RuntimeError):
    """Błąd zapytania do LiteScrape. Komunikat nigdy nie zawiera klucza."""

    def __init__(self, message: str, status: int | None = None, code: str | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.code = code


class LiteScrapeUnavailable(LiteScrapeError):
    """Klient wyłączony do końca przebiegu (zły klucz, brak salda, limit miesięczny z panelu)."""


class LiteScrapeClient:
    """Wspólny dla wątków klient z licznikiem udanych (płatnych) zapytań według rodzaju."""

    def __init__(
        self,
        api_key: str,
        *,
        http: httpx.Client | None = None,
        base_url: str = BASE_URL,
        budget: int | None = None,
        max_retries: int = 2,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        if not api_key:
            raise LiteScrapeError("Brak klucza LiteScrape.")
        self._key = api_key
        self._http = http or httpx.Client(timeout=120.0)
        self._base = base_url.rstrip("/")
        self._budget = budget
        self._max_retries = max_retries
        self._sleep = sleep
        self._lock = threading.Lock()
        self.calls: Counter = Counter()  # rodzaj (search, maps, reviews, fetch) -> udane zapytania
        self.failures: Counter = Counter()
        self.disabled: str | None = None

    @property
    def total(self) -> int:
        return sum(self.calls.values())

    @property
    def available(self) -> bool:
        return self.disabled is None and (self._budget is None or self.total < self._budget)

    def usage(self) -> dict[str, int]:
        """Zużycie do licznika miesiąca: suma i podział na rodzaje zapytań."""
        out = {f"litescrape:{kind}": n for kind, n in self.calls.items() if n}
        if out:
            out["litescrape"] = self.total
        return out

    def _disable(self, reason: str) -> None:
        with self._lock:
            if self.disabled is None:
                self.disabled = reason

    def _get(self, kind: str, path: str, params: dict, *, retries: int | None = None, timeout: float = 70.0) -> dict:
        with self._lock:
            if self.disabled:
                raise LiteScrapeUnavailable(self.disabled)
            if self._budget is not None and self.total >= self._budget:
                self.disabled = "osiągnięty miesięczny limit zapytań LiteScrape z panelu"
                raise LiteScrapeUnavailable(self.disabled)
        clean = {k: v for k, v in params.items() if v is not None}
        headers = {"Authorization": f"Bearer {self._key}", "Accept": "application/json"}
        retries = self._max_retries if retries is None else retries
        for attempt in range(retries + 1):
            try:
                response = self._http.get(self._base + path, params=clean, headers=headers, timeout=timeout)
            except httpx.HTTPError as exc:
                if attempt < retries:
                    self._sleep(2.0**attempt)
                    continue
                self.failures[kind] += 1
                raise LiteScrapeError(f"LiteScrape {kind}: błąd sieci ({type(exc).__name__})") from None
            status = response.status_code
            if status == 200:
                try:
                    data = response.json()
                except ValueError:
                    self.failures[kind] += 1
                    raise LiteScrapeError(f"LiteScrape {kind}: odpowiedź nie jest JSON", status) from None
                with self._lock:
                    self.calls[kind] += 1
                return data if isinstance(data, dict) else {}
            code = _error_code(response)
            if status in FATAL_STATUSES:
                reason = {401: "klucz LiteScrape odrzucony (sprawdź klucz w panelu)",
                          403: "klucz LiteScrape wyłączony",
                          402: "brak salda albo wyczerpany przydział LiteScrape"}[status]
                self._disable(f"{reason} ({code or status})")
                self.failures[kind] += 1
                raise LiteScrapeUnavailable(self.disabled or reason, status, code)
            if status in RETRY_STATUSES and attempt < retries:
                self._sleep(2.0**attempt)
                continue
            self.failures[kind] += 1
            raise LiteScrapeError(f"LiteScrape {kind}: HTTP {status} {code or ''}".strip(), status, code)
        raise LiteScrapeError(f"LiteScrape {kind}: brak odpowiedzi")  # pragma: no cover

    # ------------------------------------------------------------------ zapytania

    def search(self, q: str | None = None, *, gl: str = "pl", hl: str = "pl", start: int = 0,
               page_token: str | None = None) -> dict:
        if page_token:
            # Token kolejnej strony wysyła się sam: pamięta parametry pierwszego zapytania.
            return self._get("search", "/api/google/search", {"page_token": page_token, "timeout": 60})
        return self._get("search", "/api/google/search", {
            "q": q, "gl": gl, "hl": hl, "num": 10, "start": start or None, "fast_mode": "true", "timeout": 60,
        })

    def maps_search(self, q: str, *, gl: str = "pl", hl: str = "pl") -> dict:
        return self._get("maps", "/api/google/maps", {"q": q, "type": "search", "gl": gl, "hl": hl, "timeout": 60})

    def reviews(self, place_id: str, *, num: int = DEFAULT_REVIEWS, sort_by: str = "qualityScore",
                gl: str = "pl", hl: str = "pl") -> dict:
        return self._get("reviews", "/api/google/reviews", {
            "place_id": place_id, "num": max(1, min(100, num)), "sort_by": sort_by, "gl": gl, "hl": hl, "timeout": 90,
        })

    def fetch(self, url: str, *, user_agent: str | None = None, robots_token: str | None = None) -> dict:
        # Bez ponowień: nieudane pobranie od razu idzie na własny crawler.
        return self._get("fetch", "/api/web/fetch", {
            "url": url, "respond_with": "html", "robots_txt": robots_token, "user_agent": user_agent,
            "assert_status_code": 200, "timeout": 60,
        }, retries=0, timeout=80.0)

    def key_status(self) -> dict:
        """Saldo i stan klucza (nie zużywa zapytań)."""
        response = self._http.get(self._base + "/api/keys/status", headers={"Authorization": f"Bearer {self._key}"},
                                  timeout=20.0)
        if response.status_code != 200:
            raise LiteScrapeError(f"LiteScrape status: HTTP {response.status_code} {_error_code(response) or ''}".strip(),
                                  response.status_code)
        data = response.json()
        return data if isinstance(data, dict) else {}


def _error_code(response: httpx.Response) -> str | None:
    try:
        data = response.json()
    except ValueError:
        return None
    if isinstance(data, dict):
        code = data.get("error_code") or (data.get("detail") if isinstance(data.get("detail"), str) else None)
        details = data.get("details") or data.get("errors") or (data.get("detail") if not isinstance(data.get("detail"), str) else None)
        text = str(code) if code else ""
        if details:
            text += f" {json.dumps(details, ensure_ascii=False)[:300]}"
        return text.strip()[:400] or None
    return None


def open_client(repo, *, budget_for: str = "litescrape") -> tuple[LiteScrapeClient | None, LiteScrapeConfig]:
    """Klient z kluczem z panelu i budżetem z miesięcznego limitu (/admin/koszty). Bez klucza: (None, ustawienia)."""
    config = load_config(repo)
    if not config.api_key:
        return None, config
    used, limit = repo.api_usage_status(budget_for)
    budget = None if limit is None else max(0, limit - used)
    return LiteScrapeClient(config.api_key, budget=budget), config


# ----------------------------------------------------------------------------- pobieranie stron


def robots_token(user_agent: str) -> str:
    """Nazwa robota do sprawdzenia w robots.txt ("KatalogBot/0.1 (+...)" -> "KatalogBot")."""
    token = user_agent.split("/")[0].split()[0] if user_agent.strip() else ""
    return token or "KatalogBot"


class LiteScrapeFetcher:
    """Pobiera strony biur przez LiteScrape, a gdy się nie uda, własnym fetcherem (zapas, ten sam serwer co dotąd).

    Zasady zostają: LiteScrape sprawdza robots.txt dla naszego robota (robots_txt) i przedstawia się naszym
    User-Agentem, a odstęp między zapytaniami do jednego hosta pilnuje ten sam licznik co we własnym fetcherze.
    """

    def __init__(self, client: LiteScrapeClient, fallback: PoliteFetcher, user_agent: str, max_bytes: int = 2_000_000):
        self._client = client
        self._fallback = fallback
        self._ua = user_agent
        self._robots = robots_token(user_agent)
        self._max_bytes = max_bytes

    def clone(self) -> "LiteScrapeFetcher":
        return LiteScrapeFetcher(self._client, self._fallback.clone(), self._ua, self._max_bytes)

    def fetch(self, url: str) -> FetchResult:
        if self._client.available:
            self._fallback._wait(urlsplit(url).netloc)
            try:
                data = self._client.fetch(url, user_agent=self._ua, robots_token=self._robots)
            except LiteScrapeError:
                data = None
            result = result_from_fetch(url, data, self._max_bytes) if data else None
            if result:
                return result
        return self._fallback.fetch(url)

    def allowed(self, url: str) -> bool:
        return self._fallback.allowed(url)

    def robots_problem(self, url: str) -> str | None:
        return self._fallback.robots_problem(url)

    def robots_unreachable(self, url: str) -> bool:
        return self._fallback.robots_unreachable(url)


def result_from_fetch(url: str, data: dict, max_bytes: int = 2_000_000) -> FetchResult | None:
    """Wynik /api/web/fetch jako FetchResult. Pusta albo nie-HTML odpowiedź = None (wtedy własny fetcher)."""
    html = data.get("html")
    if not isinstance(html, str) or len(html) < 50 or "<" not in html:
        return None
    meta = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
    final = next((v for v in (meta.get("final_url"), meta.get("url"), data.get("url")) if isinstance(v, str) and v.startswith("http")), url)
    content = html.encode("utf-8")[:max_bytes]
    return FetchResult(url, final, 200, "text/html", content.decode("utf-8", "ignore"), len(content), True, via="litescrape")
