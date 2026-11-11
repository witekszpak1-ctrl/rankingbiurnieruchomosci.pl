"""Przebiegi widoczne w panelu: raporty sesji Claude i zapis każdego polecenia CLI."""

import json

from katalog_worker import cli
from katalog_worker.pipeline import Context, import_sessions
from katalog_worker.repo import Repo
from katalog_worker.verticals import load_vertical


def test_import_sessions_saves_each_report_once(db, tmp_path):
    ctx = Context(Repo(db), load_vertical("nieruchomosci"), tmp_path / "snap", tmp_path / "queue")
    folder = tmp_path / "queue" / "results" / "sessions"
    folder.mkdir(parents=True)
    (folder / "2026-11-11T0641.json").write_text(json.dumps({
        "started_at": "2026-11-11T05:41:00Z",
        "finished_at": "2026-11-11T06:30:00Z",
        "described": 42,
        "skipped": 3,
        "cities": [{"name": "Kraków", "deep": True, "domains": 120}, {"name": "Tarnów", "domains": 15}],
    }), encoding="utf-8")
    (folder / "broken.json").write_text("{nie json", encoding="utf-8")

    assert import_sessions(ctx) == 1
    assert import_sessions(ctx) == 0
    row = db.execute("select status, counts, finished_at - started_at as took from pipeline_runs where stage = 'claude_session'").fetchone()
    assert row["status"] == "ok"
    assert row["counts"]["described"] == 42
    assert row["counts"]["new_domains"] == 135
    assert row["counts"]["city_list"] == "Kraków (dokładnie), Tarnów"
    assert row["took"].total_seconds() == 49 * 60


def test_cli_logs_start_and_result_of_command(db, db_url, monkeypatch, tmp_path):
    monkeypatch.setenv("DATABASE_URL", db_url)
    monkeypatch.setenv("QUEUE_DIR", str(tmp_path / "queue"))
    monkeypatch.setenv("SNAPSHOTS_DIR", str(tmp_path / "snap"))
    assert cli.main(["publish-ready"]) == 0
    db.commit()
    row = db.execute("select stage, status, finished_at from pipeline_runs where stage = 'publish'").fetchone()
    assert row["status"] == "ok" and row["finished_at"] is not None


def test_cli_marks_failed_command(db, db_url, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", db_url)

    def boom(args):
        raise RuntimeError("awaria")

    monkeypatch.setattr(cli, "cmd_bundle", boom)
    parser_main = cli.build_parser
    monkeypatch.setattr(cli, "build_parser", lambda: _with_func(parser_main(), "bundle", boom))
    try:
        cli.main(["bundle"])
    except RuntimeError:
        pass
    db.commit()
    row = db.execute("select status, errors from pipeline_runs where stage = 'bundle'").fetchone()
    assert row["status"] == "failed"
    assert row["errors"][0]["message"] == "awaria"


def _with_func(parser, name, func):
    for action in parser._subparsers._group_actions:
        action.choices[name].set_defaults(func=func)
    return parser


def test_spaced_mobile_without_keyword_is_a_phone_but_regon_is_not():
    from katalog_worker.extract import extract_page

    html = "<html><body><h2>Biuro w centrum miasta, zapraszamy</h2><div><i class='icon-phone'></i> 600 123 456</div><p>REGON 123456785</p></body></html>"
    page = extract_page(html, "https://biuro.pl/kontakt")
    assert [h.e164 for h in page.phones] == ["+48600123456"]


class _Provider:
    name = "serper"
    cost_per_query_usd = 0.001

    def __init__(self, fail_after=None):
        self.queries = []
        self.fail_after = fail_after

    def search(self, query, *, country="pl", lang="pl", count=10):
        from katalog_worker.search.base import SearchError, SearchResult

        if self.fail_after is not None and len(self.queries) >= self.fail_after:
            raise SearchError("Serper: HTTP 403: brak kredytów")
        self.queries.append(query)
        slug = abs(hash(query)) % 100000
        return [SearchResult(f"https://biuro{slug}.pl/", "Biuro", "", 1), SearchResult("https://www.otodom.pl/x", "Otodom", "", 2)]


def _cities(db, names_deep):
    for i, (name, deep) in enumerate(names_deep):
        repo = Repo(db)
        repo.ensure_city_with_priority(name, i + 1)
        if deep:
            db.execute("update cities set deep_search = true where name = %s", (name,))
    db.execute("update cities set search_priority = 50 + search_priority where not deep_search")
    db.commit()


def test_discover_queue_searches_next_cities_and_marks_them(db, tmp_path):
    from katalog_worker.pipeline import stage_discover_queue

    ctx = Context(Repo(db), load_vertical("nieruchomosci"), tmp_path / "snap", tmp_path / "queue")
    _cities(db, [("Kraków", True), ("Tarnów", False), ("Nowy Sącz", False)])
    provider = _Provider()
    result = stage_discover_queue(ctx, provider, 2, {"Kraków": ["Podgórze", "Nowa Huta"]})
    assert result["cities"] == 2
    assert "biuro nieruchomości Kraków Podgórze" in provider.queries
    assert "biuro nieruchomości Kraków (strona 5)" in provider.queries
    assert sum("Tarnów" in q for q in provider.queries) == 6
    searched = {r["name"] for r in db.execute("select name from cities where last_searched_at is not null")}
    assert searched == {"Kraków", "Tarnów"}
    # drugi przebieg bierze kolejne miasto
    provider2 = _Provider()
    stage_discover_queue(ctx, provider2, 2, {})
    assert all("Nowy Sącz" in q for q in provider2.queries) and len(provider2.queries) == 6


def test_discover_queue_stops_on_search_error(db, tmp_path):
    from katalog_worker.pipeline import stage_discover_queue

    ctx = Context(Repo(db), load_vertical("nieruchomosci"), tmp_path / "snap", tmp_path / "queue")
    _cities(db, [("Tarnów", False), ("Nowy Sącz", False)])
    result = stage_discover_queue(ctx, _Provider(fail_after=3), 5, {})
    assert result["search_errors"] == 1 and result["cities"] == 1
    assert db.execute("select count(*) as n from cities where last_searched_at is not null").fetchone()["n"] == 0


def test_prompts_export_writes_panel_prompt(db, db_url, monkeypatch, tmp_path):
    from psycopg.types.json import Jsonb

    monkeypatch.setenv("DATABASE_URL", db_url)
    out = tmp_path / "prompts" / "describe.md"
    assert cli.main(["prompts", "--export", str(out)]) == 0
    assert not out.exists()
    db.execute("insert into settings (key, value) values ('describe_prompt', %s)", (Jsonb({"text": "Pisz krótko."}),))
    db.commit()
    assert cli.main(["prompts", "--export", str(out)]) == 0
    assert out.read_text(encoding="utf-8") == "Pisz krótko.\n"


def test_serper_page_suffix_becomes_page_param():
    import httpx

    from katalog_worker.search.serper import SerperSearch

    seen = []

    def handler(request):
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={"organic": [{"link": "https://a.pl/", "title": "A"}]})

    s = SerperSearch("k", client=httpx.Client(transport=httpx.MockTransport(handler)))
    s.search("biuro nieruchomości Gdynia (strona 3)")
    s.search("biuro nieruchomości Gdynia")
    assert seen[0]["q"] == "biuro nieruchomości Gdynia" and seen[0]["page"] == 3
    assert "page" not in seen[1]


def test_implausible_prices_are_flagged():
    from katalog_worker.validate import implausible_price, price_kind

    assert price_kind("pośrednictwo w sprzedaży mieszkania") == "sale"
    assert price_kind("zarządzanie najmem - pakiet") == "management"
    assert price_kind("znalezienie najemcy") == "rent_brokerage"
    assert implausible_price("sprzedaż mieszkania", "percent", [2.5]) is None
    assert implausible_price("sprzedaż mieszkania", "percent", [92.0]) is not None
    assert implausible_price("zarządzanie najmem", "percent", [8.0, 16.0]) is None
    assert implausible_price("znalezienie najemcy", "percent", [50.0]) is None
    assert implausible_price("wycena", "pln", [544000.0]) is None
    assert implausible_price("wycena", "pln", [1_200_000.0]) is not None


def test_quote_matching_tolerates_long_dashes_and_decomposed_letters():
    from katalog_worker.validate import _quote_in, _range_starts, price_kind

    assert _quote_in("prowizja 2-3% netto", ["Nasza prowizja 2–3% netto od ceny"])
    assert _quote_in("Usługi", ["Uslugi".replace("l", "ĺ", 0) + " Usługi"])
    assert _quote_in("ćwiczenie", ["ćwiczenie"])
    assert _range_starts("od 2 do 3% brutto") == [2.0]
    assert _range_starts("2,5–3,5%") == [2.5]
    assert price_kind("zarządzanie najmem - znalezienie najemcy") == "rent_brokerage"
