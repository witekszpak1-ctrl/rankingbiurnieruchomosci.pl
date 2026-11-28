import json

from katalog_worker.ai_check import ai_endpoints, query_param, run, summarize


SPEC = {"paths": {
    "/api/google/search": {"get": {"summary": "Google search", "parameters": [{"name": "q", "in": "query", "required": True}]}},
    "/api/google/ai_mode": {"get": {"summary": "Google AI Mode", "parameters": [
        {"name": "q", "in": "query", "required": True}, {"name": "gl", "in": "query"}, {"name": "hl", "in": "query"}]}},
}}


class FakeHttp:
    def get(self, url):
        class R:
            def json(self_inner):
                return SPEC
        return R()


class FakeClient:
    def __init__(self):
        self.n = 0
        self.available = True
        self.params = []

    def _get(self, kind, path, params, **kw):
        self.n += 1
        self.params.append((path, params))
        return {"text_blocks": [{"snippet": "Polecane biura w Katowicach to Alfa i Beta, według opinii klientów..."}],
                "references": [{"link": "https://www.rankingbiurnieruchomosci.pl/katowice", "title": "Ranking"}]}

    def search(self, q, gl="pl", hl="pl"):
        self.n += 1
        return {"organic_results": [], "ai_overview": {"snippet": "Krótka odpowiedź AI o biurach nieruchomości w mieście.", "link": "https://otodom.pl/x"}}

    def usage(self):
        return {"litescrape": self.n}


def test_wykrywa_endpoint_ai_i_parametr():
    eps = ai_endpoints(SPEC)
    assert [e["path"] for e in eps] == ["/api/google/ai_mode"]
    assert query_param(eps[0]["params"]) == "q"


def test_streszczenie_bez_calej_odpowiedzi():
    s = summarize({"a": {"snippet": "x" * 1000}, "links": ["https://www.otodom.pl/a"]})
    assert len(s["text_excerpt"]) == 600 and s["domains"] == ["otodom.pl"]


def test_przebieg_mieści_się_w_limicie(tmp_path):
    client = FakeClient()
    report = run(client, tmp_path, max_calls=15, http=FakeHttp())
    assert client.n <= 15
    assert report["endpoint_used"] == ["/api/google/ai_mode"]
    assert all(p[1]["gl"] == "pl" and p[1]["hl"] == "pl" for p in client.params)
    assert report["ai_tests"][0]["domains"] == ["rankingbiurnieruchomosci.pl"]
    assert report["search_ai_overview"][0]["ai_keys"] == ["ai_overview"]
    assert json.loads(next(tmp_path.glob("ai-check-*.json")).read_text())["calls"] == {"litescrape": client.n}
