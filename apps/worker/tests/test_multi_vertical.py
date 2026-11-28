"""Robot wielobranżowy: dwie branże (nieruchomości i biura rachunkowe) w jednej bazie nie mieszają danych."""

import json

import httpx
import pytest
from test_pipeline import AGENCY, FakeFetcher, FakeProvider, make_fetcher, make_krs, make_mf

from katalog_worker.fetch import FetchResult
from katalog_worker.pipeline import (
    Context,
    cities_to_search,
    stage_bundle,
    stage_cities_sync,
    stage_crawl_deep,
    stage_discover,
    stage_discover_queue,
    stage_extra_cities,
    stage_import,
    stage_offers,
    stage_probe,
    stage_publish_ready,
    stage_requeue_lost,
    stage_verify,
)
from katalog_worker.registry import MfVatClient
from katalog_worker.repo import Repo
from katalog_worker.search.base import SearchResult
from katalog_worker.verticals import load_vertical


def valid_nip(prefix: str) -> str:
    weights = (6, 5, 7, 2, 3, 4, 5, 6, 7)
    check = sum(int(d) * w for d, w in zip(prefix, weights)) % 11
    assert check != 10
    return prefix + str(check)


RA_NIP = valid_nip("526025099")
RA_HOME = "https://biuro-ksiega-test.pl/"
RA_OTHER = "https://rachunkowe-inne-test.pl/"

RA_HTML = (
    "<html><head><title>Biuro Rachunkowe Księga | księgowość i kadry we Wrocławiu</title>"
    '<meta name="description" content="Biuro rachunkowe: księgowość, kadry i płace dla firm we Wrocławiu."></head>'
    '<body><nav><a href="/kontakt">Kontakt</a><a href="/cennik">Cennik</a></nav>'
    "<p>Biuro rachunkowe Księga prowadzi księgowość, kadry i płace.</p></body></html>"
)
RA_CONTACT = (
    "<html><head><title>Kontakt</title></head><body>Kontakt. Księga Sp. z o.o., ul. Świdnicka 12, "
    f"50-067 Wrocław. NIP: {RA_NIP}. Tel. 71 555 44 33</body></html>"
)
RA_PRICING = "<html><body><h1>Cennik</h1><p>Księgowość od 300 zł miesięcznie, kadry i płace od 40 zł za pracownika.</p></body></html>"


class RaProvider:
    name = "fake"
    cost_per_query_usd = 0.005

    def __init__(self):
        self.queries: list[str] = []

    def search(self, query, *, country="pl", lang="pl", count=10):
        self.queries.append(query)
        return [SearchResult(u, "t", "s", i) for i, u in enumerate([RA_HOME, RA_OTHER], start=1)]


def make_ra_mf() -> MfVatClient:
    subject = {
        "name": "KSIĘGA SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ", "nip": RA_NIP, "statusVat": "Czynny",
        "regon": "123456785", "krs": None, "workingAddress": None,
        "residenceAddress": "ŚWIDNICKA 12, 50-067 WROCŁAW", "registrationLegalDate": "2015-05-01", "removalDate": None,
    }

    def handler(request):
        nips = request.url.path.rsplit("/", 1)[1].split(",")
        entries = [{"identifier": n, "subjects": [subject] if n == RA_NIP else []} for n in nips]
        return httpx.Response(200, json={"result": {"entries": entries}})

    return MfVatClient(client=httpx.Client(transport=httpx.MockTransport(handler)))


def both_fetcher() -> FakeFetcher:
    fetcher = make_fetcher()
    fetcher.pages.update({RA_HOME: RA_HTML, RA_HOME + "kontakt": RA_CONTACT, RA_HOME + "cennik": RA_PRICING})
    return fetcher


@pytest.fixture
def re_ctx(db, tmp_path):
    return Context(Repo(db), load_vertical("nieruchomosci"), tmp_path / "snapshots", tmp_path / "queue")


@pytest.fixture
def ra_ctx(db, tmp_path):
    return Context(Repo(db), load_vertical("rachunkowe"), tmp_path / "snapshots", tmp_path / "queue")


@pytest.fixture
def discovered(re_ctx, ra_ctx):
    stage_discover(re_ctx, FakeProvider(), "Wrocław", max_queries=1)
    stage_discover(ra_ctx, RaProvider(), "Wrocław", max_queries=1)
    return re_ctx, ra_ctx


def domain_rows(ctx) -> dict[str, dict]:
    rows = ctx.repo.conn.execute(
        """select d.host, d.vertical_id, d.classification, d.verification_status, v.slug
           from domains d left join verticals v on v.id = d.vertical_id"""
    ).fetchall()
    return {r["host"]: r for r in rows}


def test_new_domains_get_the_vertical_of_the_search_that_found_them(discovered):
    re_ctx, _ = discovered
    rows = domain_rows(re_ctx)
    assert rows["przyklad-nieruchomosci.pl"]["slug"] == "nieruchomosci"
    assert rows["opony-hurt-test.pl"]["slug"] == "nieruchomosci"
    assert rows["biuro-ksiega-test.pl"]["slug"] == "rachunkowe"
    assert rows["rachunkowe-inne-test.pl"]["slug"] == "rachunkowe"
    slugs = {r["slug"] for r in re_ctx.repo.conn.execute("select slug from verticals").fetchall()}
    assert slugs == {"nieruchomosci", "rachunkowe"}


def test_domain_already_known_in_another_vertical_is_not_added_twice(discovered):
    _, ra_ctx = discovered

    class Overlap(RaProvider):
        def search(self, query, **kwargs):
            return [SearchResult("https://przyklad-nieruchomosci.pl/", "t", "s", 1)]

    counts = stage_discover(ra_ctx, Overlap(), "Kraków", max_queries=1)
    assert counts["new_domains"] == 0
    assert domain_rows(ra_ctx)["przyklad-nieruchomosci.pl"]["slug"] == "nieruchomosci"


def test_probe_of_one_vertical_does_not_touch_the_other(discovered):
    re_ctx, ra_ctx = discovered
    fetcher = both_fetcher()
    counts = stage_probe(ra_ctx, fetcher, 50)
    assert sum(counts.values()) == 2  # dwie domeny rachunkowe (jedna z błędem pobrania)
    assert all("biuro-ksiega" in u or "rachunkowe-inne" in u for u in fetcher.requested)
    rows = domain_rows(ra_ctx)
    assert rows["biuro-ksiega-test.pl"]["classification"] == "official"  # słowa kluczowe branży rachunkowej
    assert rows["przyklad-nieruchomosci.pl"]["classification"] == "unknown"
    assert rows["opony-hurt-test.pl"]["classification"] == "unknown"

    fetcher = both_fetcher()
    stage_probe(re_ctx, fetcher, 50)
    assert not any("ksiega" in u or "rachunkowe-inne" in u for u in fetcher.requested)
    rows = domain_rows(re_ctx)
    assert rows["przyklad-nieruchomosci.pl"]["classification"] == "official"
    assert rows["opony-hurt-test.pl"]["classification"] == "irrelevant"


def test_accounting_domain_is_not_rejected_by_real_estate_probe(discovered):
    re_ctx, ra_ctx = discovered
    stage_probe(re_ctx, both_fetcher(), 50)
    row = domain_rows(re_ctx)["biuro-ksiega-test.pl"]
    assert (row["classification"], row["verification_status"]) == ("unknown", "candidate")  # nietknięta
    stage_probe(ra_ctx, both_fetcher(), 50)
    assert domain_rows(re_ctx)["biuro-ksiega-test.pl"]["classification"] == "official"


def test_domain_without_vertical_belongs_to_real_estate(discovered):
    re_ctx, ra_ctx = discovered
    repo = re_ctx.repo
    repo.conn.execute(
        "insert into domains (host, canonical_url) values ('stary-wpis-test.pl', 'https://stary-wpis-test.pl/')"
    )
    re_hosts = {r["host"] for r in repo.domains_to_probe(50, re_ctx.vertical_id)}
    ra_hosts = {r["host"] for r in repo.domains_to_probe(50, ra_ctx.vertical_id)}
    assert "stary-wpis-test.pl" in re_hosts and "stary-wpis-test.pl" not in ra_hosts
    assert "biuro-ksiega-test.pl" in ra_hosts and "biuro-ksiega-test.pl" not in re_hosts
    assert len(repo.domains_to_probe(50)) == len(re_hosts) + len(ra_hosts)  # bez branży: wszystkie, jak dotąd


def run_both_to_bundles(re_ctx, ra_ctx):
    fetcher = both_fetcher()
    for ctx in (re_ctx, ra_ctx):
        stage_probe(ctx, fetcher, 50)
    # Każda branża ma własny rejestr (ten sam adres klienta, inny NIP w odpowiedzi).
    stage_verify(ra_ctx, make_ra_mf(), make_krs(), 50)
    return fetcher


def test_verify_crawl_and_bundle_stay_inside_the_vertical(discovered):
    re_ctx, ra_ctx = discovered
    fetcher = run_both_to_bundles(re_ctx, ra_ctx)
    conn = re_ctx.repo.conn
    assert domain_rows(re_ctx)["przyklad-nieruchomosci.pl"]["verification_status"] == "candidate"  # RE jeszcze nie weryfikowane
    listings = conn.execute("select v.slug from listings l join verticals v on v.id = l.vertical_id").fetchall()
    assert [r["slug"] for r in listings] == ["rachunkowe"]

    stage_verify(re_ctx, make_mf(), make_krs(), 50)
    listings = conn.execute("select v.slug from listings l join verticals v on v.id = l.vertical_id order by 1").fetchall()
    assert [r["slug"] for r in listings] == ["nieruchomosci", "rachunkowe"]

    requested_before = len(fetcher.requested)
    deep = stage_crawl_deep(ra_ctx, fetcher, 10)
    assert deep.get("domains", 0) >= 1
    assert not any("przyklad-nieruchomosci" in u for u in fetcher.requested[requested_before:])
    stage_crawl_deep(re_ctx, fetcher, 10)

    ra_counts = stage_bundle(ra_ctx, 10)
    assert ra_counts.get("describe") == 1
    re_counts = stage_bundle(re_ctx, 10)
    assert re_counts.get("describe") == 1

    queue = re_ctx.queue_dir
    ra_brand = conn.execute(
        "select brand_id from listings l join verticals v on v.id = l.vertical_id where v.slug = 'rachunkowe'"
    ).fetchone()["brand_id"]
    re_brand = conn.execute(
        "select brand_id from listings l join verticals v on v.id = l.vertical_id where v.slug = 'nieruchomosci'"
    ).fetchone()["brand_id"]
    # Nieruchomości: ścieżka bez zmian. Inna branża: prefiks z nazwą branży, więc sesja nieruchomości jej nie zobaczy.
    assert (queue / "pending" / "describe" / f"{re_brand}.json").is_file()
    assert (queue / "pending" / "rachunkowe" / "describe" / f"{ra_brand}.json").is_file()
    assert not (queue / "pending" / "describe" / f"{ra_brand}.json").exists()
    bundle = json.loads((queue / "pending" / "rachunkowe" / "describe" / f"{ra_brand}.json").read_text(encoding="utf-8"))
    assert bundle["vertical"] == "rachunkowe"

    ra_items = {str(r["brand_id"]) for r in re_ctx.repo.pending_queue_items(vertical_id=ra_ctx.vertical_id)}
    re_items = {str(r["brand_id"]) for r in re_ctx.repo.pending_queue_items(vertical_id=re_ctx.vertical_id)}
    assert ra_items == {str(ra_brand)} and re_items == {str(re_brand)}
    assert len(re_ctx.repo.pending_queue_items()) == 2  # bez branży: wszystkie, jak dotąd


def test_import_reads_results_from_the_vertical_directory_only(discovered):
    re_ctx, ra_ctx = discovered
    ra_brand, re_brand = run_both_to_bundles_and_bundle(re_ctx, ra_ctx)
    # Wynik "pominięty" w katalogu rachunkowych zamyka tylko zadanie rachunkowe.
    skip = ra_ctx.queue_dir / "results" / "rachunkowe" / "skipped" / "describe" / f"{ra_brand}.json"
    skip.parent.mkdir(parents=True)
    skip.write_text(json.dumps({"reason": "nie biuro rachunkowe"}), encoding="utf-8")
    # Plik o tej samej nazwie w katalogu nieruchomości (inny identyfikator) nie wpływa na rachunkowe.
    assert stage_import(re_ctx) == {"waiting": 1}
    assert stage_import(ra_ctx) == {"skipped": 1}
    states = {
        str(r["brand_id"]): r["status"]
        for r in re_ctx.repo.conn.execute("select brand_id, status from queue_items").fetchall()
    }
    assert states == {str(ra_brand): "rejected", str(re_brand): "pending"}


def run_both_to_bundles_and_bundle(re_ctx, ra_ctx):
    fetcher = run_both_to_bundles(re_ctx, ra_ctx)
    stage_verify(re_ctx, make_mf(), make_krs(), 50)
    stage_crawl_deep(re_ctx, fetcher, 10)
    stage_crawl_deep(ra_ctx, fetcher, 10)
    stage_bundle(re_ctx, 10)
    stage_bundle(ra_ctx, 10)
    conn = re_ctx.repo.conn
    ids = {
        r["slug"]: r["brand_id"]
        for r in conn.execute(
            "select v.slug, l.brand_id from listings l join verticals v on v.id = l.vertical_id"
        ).fetchall()
    }
    return ids["rachunkowe"], ids["nieruchomosci"]


def test_requeue_lost_only_touches_own_vertical(discovered):
    re_ctx, ra_ctx = discovered
    run_both_to_bundles_and_bundle(re_ctx, ra_ctx)
    for path in re_ctx.queue_dir.rglob("*.json"):
        path.unlink()  # zgubione pliki paczek obu branż
    assert stage_requeue_lost(ra_ctx) == {"requeued_lost": 1}
    statuses = sorted(
        (r["status"] for r in re_ctx.repo.conn.execute("select status from queue_items").fetchall())
    )
    assert statuses == ["failed", "pending"]
    assert stage_requeue_lost(re_ctx) == {"requeued_lost": 1}


def test_offers_and_extra_cities_are_real_estate_only(discovered):
    _, ra_ctx = discovered
    assert "skipped" in stage_offers(ra_ctx, both_fetcher(), 10)
    assert "skipped" in stage_extra_cities(ra_ctx)


def test_publishing_other_vertical_needs_its_own_switch(discovered):
    re_ctx, ra_ctx = discovered
    conn = re_ctx.repo.conn
    conn.execute("insert into settings (key, value) values ('auto_publish', 'true') on conflict (key) do update set value = 'true'")
    conn.commit()
    assert stage_publish_ready(ra_ctx) == {"auto_publish_rachunkowe": "wyłączone"}
    assert stage_publish_ready(re_ctx) == {}  # nieruchomości: dotychczasowy wyłącznik


def test_city_queue_state_is_per_vertical(discovered):
    re_ctx, ra_ctx = discovered
    repo = re_ctx.repo
    stage_cities_sync(re_ctx, ["Wrocław", "Kraków", "Gdańsk"])
    stage_cities_sync(ra_ctx, ["Wrocław", "Kraków", "Poznań"])
    assert [c["name"] for c in cities_to_search(re_ctx, 10)] == ["Wrocław", "Kraków", "Gdańsk"]
    assert [c["name"] for c in cities_to_search(ra_ctx, 10)] == ["Wrocław", "Kraków", "Poznań"]
    # Poznań znany tylko rachunkowym: w tabeli miast z wyłączonym szukaniem, więc nie wchodzi do kolejki nieruchomości.
    assert repo.conn.execute("select search_enabled from cities where name = 'Poznań'").fetchone()["search_enabled"] is False

    provider = RaProvider()
    result = stage_discover_queue(ra_ctx, provider, 2, {}, 1)
    assert result["cities"] == 2
    assert any(q.startswith("biuro rachunkowe") for q in provider.queries)
    assert not any("nieruchomości" in q for q in provider.queries)
    # Przeszukane miasta rachunkowych znikają z ich kolejki, a kolejka nieruchomości stoi w miejscu.
    assert [c["name"] for c in cities_to_search(ra_ctx, 10)] == ["Poznań"]
    assert [c["name"] for c in cities_to_search(re_ctx, 10)] == ["Wrocław", "Kraków", "Gdańsk"]
    assert repo.conn.execute("select count(*) as n from cities where last_searched_at is not null").fetchone()["n"] == 0
    # Zlecenie dokładnego przeszukania w jednej branży nie dotyczy drugiej.
    repo.conn.execute(
        "update vertical_cities set deep_requested_at = now() + interval '1 minute' where vertical_id = %s",
        (ra_ctx.vertical_id,),
    )
    assert all(c["deep"] for c in cities_to_search(ra_ctx, 10))


def test_default_vertical_keeps_panel_columns_for_city_queue(re_ctx):
    stage_cities_sync(re_ctx, ["Wrocław", "Kraków"])
    assert [c["name"] for c in cities_to_search(re_ctx, 10)] == ["Wrocław", "Kraków"]
    re_ctx.repo.conn.execute("update cities set search_enabled = false where name = 'Kraków'")
    assert [c["name"] for c in cities_to_search(re_ctx, 10)] == ["Wrocław"]
    assert re_ctx.repo.conn.execute("select count(*) as n from vertical_cities").fetchone()["n"] == 0


def test_status_counts_are_per_vertical(discovered):
    re_ctx, ra_ctx = discovered
    repo = re_ctx.repo
    assert sum(repo.status_counts(re_ctx.vertical_id)["domains_by_status"].values()) == 3
    assert sum(repo.status_counts(ra_ctx.vertical_id)["domains_by_status"].values()) == 2
    assert sum(repo.status_counts()["domains_by_status"].values()) == 5


def test_guard_state_is_per_vertical(discovered):
    from katalog_worker.guard import publishing_blocked, run_guard

    re_ctx, ra_ctx = discovered
    repo = re_ctx.repo
    run_guard(repo, vertical_id=re_ctx.vertical_id)
    run_guard(repo, vertical="rachunkowe", vertical_id=ra_ctx.vertical_id)
    assert repo.setting("guard_snapshot", None) is not None
    assert repo.setting("guard_snapshot:rachunkowe", None) is not None
    repo.set_setting("guard_block:rachunkowe", {"problems": ["x"]})
    assert publishing_blocked(repo, "rachunkowe") == ["x"]
    assert publishing_blocked(repo) is None


def test_litescrape_run_budget_from_environment(monkeypatch):
    from katalog_worker.litescrape import open_client

    class FakeRepo:
        def __init__(self, limit):
            self.limit = limit

        def setting(self, key, default):
            return default

        def api_usage_status(self, service):
            return 100, self.limit

    monkeypatch.setenv("LITESCRAPE_API_KEY", "test-key")
    monkeypatch.delenv("LITESCRAPE_RUN_BUDGET", raising=False)
    client, _ = open_client(FakeRepo(None))
    assert client._budget is None  # bez zmiennej: dotychczasowe zachowanie
    client, _ = open_client(FakeRepo(1000))
    assert client._budget == 900
    monkeypatch.setenv("LITESCRAPE_RUN_BUDGET", "3000")
    client, _ = open_client(FakeRepo(None))
    assert client._budget == 3000
    client, _ = open_client(FakeRepo(1000))
    assert client._budget == 900  # mniejszy z dwóch limitów
    monkeypatch.setenv("LITESCRAPE_RUN_BUDGET", "50")
    client, _ = open_client(FakeRepo(1000))
    assert client._budget == 50
    monkeypatch.setenv("LITESCRAPE_RUN_BUDGET", "bzdura")
    client, _ = open_client(FakeRepo(None))
    assert client._budget == 0 and not client.available


def test_run_budget_is_shared_between_commands_through_the_budget_file(monkeypatch, tmp_path):
    from katalog_worker.litescrape import open_client, record_run_usage, run_budget_remaining

    class FakeRepo:
        def setting(self, key, default):
            return default

        def api_usage_status(self, service):
            return 0, None

    budget_file = tmp_path / "budget.json"
    monkeypatch.setenv("LITESCRAPE_API_KEY", "test-key")
    monkeypatch.setenv("LITESCRAPE_RUN_BUDGET", "100")
    monkeypatch.setenv("LITESCRAPE_BUDGET_FILE", str(budget_file))
    assert run_budget_remaining() == 100
    record_run_usage(60)  # pierwsze polecenie
    record_run_usage(25)  # drugie
    assert run_budget_remaining() == 15
    client, _ = open_client(FakeRepo())
    assert client._budget == 15
    record_run_usage(500)
    assert run_budget_remaining() == 0
    client, _ = open_client(FakeRepo())
    assert not client.available  # budżet wyczerpany: klient nic nie wyśle
    budget_file.write_text("nie json", encoding="utf-8")
    assert run_budget_remaining() == 100  # uszkodzony plik liczy się jak brak zużycia


def test_backlog_and_status_commands_take_the_vertical(discovered, db_url, monkeypatch, capsys):
    from katalog_worker.cli import main

    re_ctx, ra_ctx = discovered
    re_ctx.repo.conn.commit()
    monkeypatch.setenv("DATABASE_URL", db_url)
    assert main(["backlog"]) == 0
    default = json.loads(capsys.readouterr().out)
    assert default["probe"] == 3  # domyślnie nieruchomości, jak dotąd
    assert main(["backlog", "--vertical", "rachunkowe"]) == 0
    assert json.loads(capsys.readouterr().out)["probe"] == 2
    assert main(["status", "--vertical", "rachunkowe"]) == 0
    assert sum(json.loads(capsys.readouterr().out)["domains_by_status"].values()) == 2
    assert main(["status", "--vertical", "ksiegowosc-bez-wiersza"]) == 0
    assert "brak wiersza branży" in capsys.readouterr().out
    assert main(["indexnow", "--vertical", "rachunkowe"]) == 0
    assert "skipped" in capsys.readouterr().out
