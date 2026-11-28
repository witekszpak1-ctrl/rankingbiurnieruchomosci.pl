"""LiteScrape: klient (klucz, licznik, wyłączenie), Mapy z opiniami, wyszukiwarka z kolejnymi stronami i pobieranie
stron z zapasem na własny fetcher. Odpowiedzi w kształcie ze specyfikacji OpenAPI LiteScrape."""

import httpx
import pytest

from katalog_worker.fetch import FetchResult
from katalog_worker.google_maps import fetch_place
from katalog_worker.litescrape import (
    LiteScrapeClient, LiteScrapeError, LiteScrapeFetcher, LiteScrapeUnavailable, config_from_value, robots_token,
)
from katalog_worker.search import FallbackSearch, LiteScrapeSearch, SearchError, make_provider
from katalog_worker.search.base import SearchResult

KEY = "ls_test_key_123456"


def client_for(handler, **kw) -> LiteScrapeClient:
    return LiteScrapeClient(KEY, http=httpx.Client(transport=httpx.MockTransport(handler)), sleep=lambda s: None, **kw)


def test_config_from_panel_has_priority_and_sane_bounds():
    cfg = config_from_value({"apiKey": " abc ", "searchResults": 25, "useFetch": False}, "env")
    assert (cfg.api_key, cfg.search_results, cfg.search_pages, cfg.use_fetch, cfg.use_maps) == ("abc", 25, 3, False, True)
    assert config_from_value({}, "env").api_key == "env"
    assert config_from_value(None, None).api_key is None
    assert config_from_value({"searchResults": 5000}).search_results == 300
    assert config_from_value({"searchResults": "x"}).search_pages == 3


def test_client_sends_bearer_counts_only_successes_and_never_leaks_key():
    seen = []

    def handler(request):
        seen.append(request)
        if "fail" in str(request.url):
            return httpx.Response(503, json={"error_code": "service_unavailable"})
        return httpx.Response(200, json={"local_results": []})

    client = client_for(handler)
    client.maps_search("Alfa biuro nieruchomości Gdynia")
    with pytest.raises(LiteScrapeError) as err:
        client.maps_search("fail")
    assert KEY not in str(err.value)
    assert seen[0].headers["Authorization"] == f"Bearer {KEY}"
    assert KEY not in str(seen[0].url)
    assert client.calls["maps"] == 1 and client.usage() == {"litescrape:maps": 1, "litescrape": 1}


def test_bad_key_or_no_balance_disables_client_for_the_run():
    calls = []

    def handler(request):
        calls.append(1)
        return httpx.Response(402, json={"error_code": "allowance_exhausted"})

    client = client_for(handler)
    with pytest.raises(LiteScrapeUnavailable):
        client.search("biuro nieruchomości Gdynia")
    assert not client.available and "salda" in client.disabled
    with pytest.raises(LiteScrapeUnavailable):
        client.search("biuro nieruchomości Sopot")
    assert len(calls) == 1


def test_monthly_budget_stops_before_sending():
    client = client_for(lambda r: httpx.Response(200, json={}), budget=1)
    client.maps_search("a")
    with pytest.raises(LiteScrapeUnavailable):
        client.maps_search("b")
    assert client.total == 1


def maps_handler(reviews_status=200):
    def handler(request):
        path = request.url.path
        if path == "/api/google/maps":
            assert request.url.params["type"] == "search" and request.url.params["hl"] == "pl"
            return httpx.Response(200, json={"local_results": [
                {"title": "Inna firma", "place_id": "other", "website": "https://inna.pl/", "rating": 3.1, "reviews": 4},
                {"title": "Przykład Nieruchomości", "place_id": "ours", "website": "https://www.przyklad.pl/kontakt",
                 "rating": 4.7, "reviews": 31},
            ]})
        assert path == "/api/google/reviews" and request.url.params["place_id"] == "ours"
        assert request.url.params["num"] == "50"
        if reviews_status != 200:
            return httpx.Response(reviews_status, json={"error_code": "service_unavailable"})
        return httpx.Response(200, json={"place_info": {"rating": 4.7, "reviews": 31}, "reviews": [
            {"rating": 5, "snippet": "Bardzo pomocni (tłum.)", "extracted_snippet": {"original": "Bardzo pomocni."},
             "user": {"name": "Anna K."}, "date": "miesiąc temu", "iso_date": "2026-10-20T10:00:00Z",
             "response": {"snippet": "Dziękujemy!", "iso_date": "2026-10-21T08:00:00Z"}},
            {"rating": 4, "snippet": None, "user": {"name": "Bez treści"}},
            {"rating": 9, "snippet": "Zła ocena"},
        ]})
    return handler


def test_place_matched_by_domain_with_full_reviews_and_owner_reply():
    client = client_for(maps_handler())
    result = fetch_place(client, "Przykład Nieruchomości", "Wrocław", "https://przyklad.pl/", lambda n: False)
    assert (result.place_id, result.rating, result.rating_count, result.status) == ("ours", 4.7, 31, "ok")
    assert "query_place_id=ours" in result.maps_url
    assert result.reviews == [{
        "author": "Anna K.", "rating": 5, "text": "Bardzo pomocni.", "relative_time": "miesiąc temu",
        "published_at": "2026-10-20T10:00:00Z", "reply": "Dziękujemy!", "reply_at": "2026-10-21T08:00:00Z",
    }]
    assert client.usage() == {"litescrape:maps": 1, "litescrape:reviews": 1, "litescrape": 2}


def test_place_not_found_and_rating_kept_when_reviews_fail():
    client = client_for(lambda r: httpx.Response(200, json={"local_results": [
        {"title": "Zupełnie inna", "place_id": "x", "website": "https://inna.pl/"}]}))
    assert fetch_place(client, "Przykład", "Wrocław", "https://przyklad.pl/", lambda n: False).status == "not_found"
    partial = fetch_place(client_for(maps_handler(503)), "Przykład", "Wrocław", "https://przyklad.pl/", lambda n: False)
    assert partial.status == "ok" and partial.rating == 4.7 and partial.reviews == []


def test_search_pages_use_token_then_stop_when_google_has_no_more():
    requests = []

    def handler(request):
        params = dict(request.url.params)
        requests.append(params)
        if "page_token" in params:
            assert set(params) == {"page_token", "timeout"}
            return httpx.Response(200, json={"organic_results": [{"link": "https://b.pl/", "title": "B"}],
                                             "pagination": {}})
        assert params["num"] == "10" and params["gl"] == "pl" and params["resolve_all_links"] == "true"
        return httpx.Response(200, json={"organic_results": [{"link": "https://a.pl/", "title": "A"}, {"link": "x"},
                                                             {"link": "https://www.google.com/goto?url=abc"}],
                                         "pagination": {"next_page_token": "tok2", "next": "..."}})

    provider = LiteScrapeSearch(client_for(handler))
    first = provider.search("biuro nieruchomości Gdynia")
    second = provider.search("biuro nieruchomości Gdynia (strona 2)")
    third = provider.search("biuro nieruchomości Gdynia (strona 3)")
    assert [r.url for r in first] == ["https://a.pl/"] and first[0].rank == 1
    assert [(r.url, r.rank) for r in second] == [("https://b.pl/", 11)]
    assert third == [] and provider.skipped and len(requests) == 2


def test_auto_provider_falls_back_to_serper_after_litescrape_error():
    class Backup:
        name, cost_per_query_usd = "serper", 0.001

        def search(self, query, **kw):
            return [SearchResult("https://z.pl/", "Z", "", 1)]

    dead = LiteScrapeSearch(client_for(lambda r: httpx.Response(401, json={"error_code": "invalid_key"})))
    provider = FallbackSearch(dead, Backup())
    assert provider.name == "litescrape"
    assert [r.url for r in provider.search("q")] == ["https://z.pl/"]
    assert provider.name == "serper" and provider.switched
    with pytest.raises(SearchError):
        make_provider("litescrape", litescrape=None)


class OwnFetcher:
    def __init__(self):
        self.urls = []

    def _wait(self, host):
        pass

    def clone(self):
        return self

    def fetch(self, url):
        self.urls.append(url)
        return FetchResult(url, url, 200, "text/html", "<html>own</html>", 16, True)


def test_fetcher_uses_litescrape_html_and_falls_back_to_own_server():
    def handler(request):
        import json

        assert request.method == "POST"
        params = json.loads(request.content)
        assert params["respond_with"] == "html" and params["robots_txt"] == "KatalogBot"
        assert params["user_agent"].startswith("KatalogBot/") and params["assert_status_code"] == 200
        if "broken" in params["url"]:
            return httpx.Response(503, json={"error_code": "service_unavailable"})
        return httpx.Response(200, json={"url": "https://www.przyklad.pl/", "html": "<html><body>" + "x" * 60 + "</body></html>"})

    own = OwnFetcher()
    fetcher = LiteScrapeFetcher(client_for(handler), own, "KatalogBot/0.1 (+https://rankingbiurnieruchomosci.pl/bot)")
    ok = fetcher.fetch("https://przyklad.pl/")
    assert ok.ok and ok.via == "litescrape" and ok.final_url == "https://www.przyklad.pl/" and own.urls == []
    backup = fetcher.fetch("https://broken.pl/")
    assert backup.via == "httpx" and own.urls == ["https://broken.pl/"]
    assert robots_token("") == "KatalogBot"


def test_exact_place_from_place_results_is_used():
    def handler(request):
        if request.url.path == "/api/google/maps":
            return httpx.Response(200, json={"place_results": {"title": "LDK Nieruchomości", "place_id": "ldk",
                                                               "website": "https://ldknieruchomosci.pl/", "rating": 4.9,
                                                               "reviews": 0}})
        raise AssertionError("bez opinii nie ma drugiego zapytania")

    result = fetch_place(client_for(handler), "LDK Nieruchomości", "Gdynia", "https://ldknieruchomosci.pl/", lambda n: False)
    assert (result.status, result.place_id, result.rating) == ("ok", "ldk", 4.9)
