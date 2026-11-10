import csv
import json

import httpx
import pytest

from katalog_worker.ab_search import Entity, load_entities_csv, run_ab
from katalog_worker.discovery import discover
from katalog_worker.queries import build_queries, entity_queries
from katalog_worker.search import BraveSearch, SearchError, SerperSearch, make_provider
from katalog_worker.search.base import SearchResult
from katalog_worker.verticals import load_vertical


class FakeProvider:
    cost_per_query_usd = 0.01

    def __init__(self, name: str, table: dict[str, list[str]]):
        self.name = name
        self._table = table
        self.calls: list[str] = []

    def search(self, query, *, country="pl", lang="pl", count=10):
        self.calls.append(query)
        urls = self._table.get(query, [])
        return [SearchResult(u, "t", "s", i) for i, u in enumerate(urls, start=1)]


# ------------------------------------------------------------------ adaptery


def _brave_transport(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_brave_request_and_parsing():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["token"] = request.headers["X-Subscription-Token"]
        seen["params"] = dict(request.url.params)
        payload = {
            "web": {
                "results": [
                    {"url": "https://a.pl/", "title": "A", "description": "opis A"},
                    {"title": "bez adresu"},
                    {"url": "https://b.pl/", "title": "B"},
                ]
            }
        }
        return httpx.Response(200, json=payload)

    provider = BraveSearch("KLUCZ", client=_brave_transport(handler))
    results = provider.search("biuro nieruchomości Wrocław", count=50)
    assert seen["token"] == "KLUCZ"
    assert seen["params"]["country"] == "PL"
    assert seen["params"]["search_lang"] == "pl"
    assert seen["params"]["count"] == "20"  # limit Brave
    assert [r.url for r in results] == ["https://a.pl/", "https://b.pl/"]
    # pozycja odzwierciedla miejsce w wynikach, także gdy wcześniejszy wynik został pominięty
    assert results[0].snippet == "opis A" and results[1].rank == 3


def test_serper_request_and_parsing():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["key"] = request.headers["X-API-KEY"]
        seen["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={"organic": [{"title": "A", "link": "https://a.pl/", "snippet": "s", "position": 1}, {"title": "x"}]},
        )

    provider = SerperSearch("KLUCZ", client=_brave_transport(handler))
    results = provider.search("agencja nieruchomości Kraków", count=30)
    assert seen["key"] == "KLUCZ"
    assert seen["body"] == {"q": "agencja nieruchomości Kraków", "gl": "pl", "hl": "pl", "num": 10}
    assert [r.url for r in results] == ["https://a.pl/"]


def test_retry_on_429_then_success_and_sleep_backoff():
    calls = {"n": 0}
    sleeps: list[float] = []

    def handler(request):
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(429, text="slow down")
        return httpx.Response(200, json={"web": {"results": [{"url": "https://a.pl/"}]}})

    provider = BraveSearch("K", client=_brave_transport(handler), sleep=sleeps.append)
    assert len(provider.search("x")) == 1
    assert calls["n"] == 2 and sleeps == [1.0]


def test_error_does_not_leak_key_and_gives_up_after_retries():
    def handler(request):
        return httpx.Response(500, text="boom")

    provider = SerperSearch("SEKRET-123", client=_brave_transport(handler), sleep=lambda s: None)
    with pytest.raises(SearchError) as info:
        provider.search("x")
    assert "SEKRET-123" not in str(info.value)
    assert "500" in str(info.value)


def test_missing_key_and_unknown_provider():
    with pytest.raises(SearchError):
        BraveSearch("")
    with pytest.raises(SearchError):
        make_provider("bing")


# ------------------------------------------------------------------ zapytania


def test_build_queries_from_real_vertical_config():
    vertical = load_vertical("nieruchomosci")
    queries = build_queries(vertical.search, "Wrocław")
    assert "biuro nieruchomości Wrocław" in queries
    assert "sprzedaż mieszkań Wrocław" in queries
    assert len(queries) == len({q.casefold() for q in queries})
    assert len(queries) <= vertical.search.max_queries_per_city
    assert all("Wrocław" in q for q in queries)
    assert len(build_queries(vertical.search, "Wrocław", limit=3)) == 3


def test_entity_queries():
    queries = entity_queries("Przykład Nieruchomości Sp. z o.o.", "Wrocław")
    assert queries[0] == '"Przykład Nieruchomości Sp. z o.o." Wrocław'
    assert len(queries) == 2


def test_vertical_config_loads_expected_fields():
    vertical = load_vertical("nieruchomosci")
    assert vertical.slug == "nieruchomosci"
    assert vertical.registry.pkd == ["68.31.Z"]
    assert "nieruchomo" in vertical.keywords
    assert sum(vertical.ranking.weights.values()) == 100
    with pytest.raises(FileNotFoundError):
        load_vertical("nie-ma-takiej")


# ------------------------------------------------------------------ discovery


def test_discover_dedupes_filters_blocklist_and_tracks_new():
    provider = FakeProvider(
        "fake",
        {
            "q1": ["https://www.oferteo.pl/biura", "https://alfa.pl/", "https://beta.com.pl/oferta"],
            "q2": ["https://alfa.pl/kontakt", "https://gamma.pl/", "https://pl.facebook.com/x"],
        },
    )
    candidates, stats = discover(provider, ["q1", "q2"], known_hosts={"gamma.pl"})
    hosts = [c.host for c in candidates]
    assert hosts == ["alfa.pl", "beta.com.pl", "gamma.pl"] or hosts == ["alfa.pl", "gamma.pl", "beta.com.pl"]
    assert "oferteo.pl" not in hosts and "facebook.com" not in hosts
    alfa = next(c for c in candidates if c.host == "alfa.pl")
    assert alfa.best_rank == 1 and alfa.queries == ["q1", "q2"]
    assert alfa.url == "https://alfa.pl/kontakt"  # najwyżej sklasyfikowany wynik
    assert alfa.home_url == "https://alfa.pl/"
    assert [s.new_candidates for s in stats] == [2, 0]  # gamma jest już znana
    assert [s.blocked for s in stats] == [1, 1]


# ------------------------------------------------------------------ A/B


def test_ab_compares_providers_on_labeled_entities(tmp_path):
    entities = [
        Entity("Firma Alfa", "Wrocław", "alfa.pl"),
        Entity("Firma Beta", "Wrocław", "beta.pl"),
        Entity("Firma Bez Etykiety", "Wrocław", None),
    ]
    good = FakeProvider(
        "dobry",
        {
            '"Firma Alfa" Wrocław': ["https://alfa.pl/"],
            '"Firma Beta" Wrocław': ["https://katalog.oferteo.pl/b", "https://beta.pl/"],
        },
    )
    weak = FakeProvider("slaby", {'"Firma Alfa" Wrocław': ["https://inna.pl/", "https://alfa.pl/x"]})
    stats = {s.provider: s for s in run_ab(entities, [good, weak], k=10, queries_per_entity=1)}

    assert stats["dobry"].labeled == 2 and stats["dobry"].hits == 2
    assert stats["dobry"].hit_rate == 1.0
    assert stats["dobry"].mrr == 1.0  # blocklista nie psuje pozycji
    assert stats["slaby"].hits == 1 and stats["slaby"].mrr == pytest.approx(0.25)
    assert stats["dobry"].queries == 3
    assert stats["dobry"].cost_usd == pytest.approx(0.03)


def test_load_entities_csv(tmp_path):
    path = tmp_path / "entities.csv"
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["name", "city", "expected_domain"])
        writer.writerow(["Firma Alfa", "Wrocław", "https://www.alfa.pl/kontakt"])
        writer.writerow(["Firma Beta", "Kraków", ""])
        writer.writerow(["", "Poznań", "x.pl"])
    entities = load_entities_csv(path)
    assert entities == [Entity("Firma Alfa", "Wrocław", "alfa.pl"), Entity("Firma Beta", "Kraków", None)]


# ----------------------------------------------------------------------------- dostawca z pliku


def _file_data(**overrides):
    data = {
        "city": "Wrocław",
        "collected_at": "2026-11-10",
        "queries": [
            {
                "query": "biuro nieruchomości Wrocław",
                "results": [
                    {"url": "https://alfa-nieruchomosci.pl/", "title": "Alfa", "snippet": "Biuro"},
                    {"url": "https://www.beta.pl/oferty", "title": "Beta"},
                ],
            },
            {"query": "pośrednik wynajem Wrocław", "results": []},
        ],
    }
    data.update(overrides)
    return data


def test_file_search_returns_results_with_rank_from_order():
    from katalog_worker.search import FileSearch

    provider = FileSearch(_file_data())
    results = provider.search("Biuro Nieruchomości Wrocław")  # wielkość liter nie ma znaczenia
    assert [r.url for r in results] == ["https://alfa-nieruchomosci.pl/", "https://www.beta.pl/oferty"]
    assert [r.rank for r in results] == [1, 2]
    assert provider.search("nieznane zapytanie") == []
    assert provider.queries == ["biuro nieruchomości Wrocław", "pośrednik wynajem Wrocław"]
    assert provider.city == "Wrocław"
    assert provider.cost_per_query_usd == 0.0


def test_file_search_respects_count_and_explicit_rank():
    from katalog_worker.search import FileSearch

    data = _file_data()
    data["queries"][0]["results"][0]["rank"] = 3
    provider = FileSearch(data)
    assert provider.search("biuro nieruchomości Wrocław", count=1)[0].rank == 3
    assert len(provider.search("biuro nieruchomości Wrocław", count=1)) == 1


@pytest.mark.parametrize(
    "mutate",
    [
        lambda d: d.pop("city"),
        lambda d: d.update(queries=[]),
        lambda d: d["queries"][0].update(results="nie lista"),
        lambda d: d["queries"][0]["results"][0].update(url="ftp://alfa.pl/"),
        lambda d: d["queries"][0]["results"][0].update(url="alfa.pl"),
        lambda d: d["queries"].append({"query": "BIURO nieruchomości wrocław", "results": []}),
    ],
)
def test_file_search_rejects_malformed_data(mutate):
    from katalog_worker.search import FileSearch, SearchError

    data = _file_data()
    mutate(data)
    with pytest.raises(SearchError):
        FileSearch(data)


def test_file_search_from_path_hashes_content(tmp_path):
    import hashlib
    import json

    from katalog_worker.search import FileSearch, SearchError

    path = tmp_path / "kandydaci.json"
    raw = json.dumps(_file_data(), ensure_ascii=False).encode("utf-8")
    path.write_bytes(raw)
    provider = FileSearch.from_path(path)
    assert provider.source_sha256 == hashlib.sha256(raw).hexdigest()
    bad = tmp_path / "zly.json"
    bad.write_text("{nie json", encoding="utf-8")
    with pytest.raises(SearchError):
        FileSearch.from_path(bad)
