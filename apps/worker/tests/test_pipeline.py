"""Test integracyjny całego przepływu S1-S7 na lokalnej bazie, z atrapami wyszukiwarki, stron i rejestrów."""

import json
from pathlib import Path

import httpx
import pytest
from conftest import fixture_text

from katalog_worker.bundle import contains_contacts
from katalog_worker.fetch import FetchResult
from katalog_worker.pipeline import (
    Context,
    stage_bundle,
    stage_crawl_deep,
    stage_discover,
    stage_import,
    stage_probe,
    stage_verify,
)
from katalog_worker.registry import KrsClient, MfVatClient
from katalog_worker.repo import DbCache, Repo
from katalog_worker.search.base import SearchResult
from katalog_worker.verticals import load_vertical

AGENCY = "https://przyklad-nieruchomosci.pl/"
NIP = "1234563218"

CONTACT_HTML = (
    "<html><head><title>Kontakt</title></head><body>Kontakt. Przykład Nieruchomości Sp. z o.o., "
    "ul. Świdnicka 10, 50-067 Wrocław. NIP: 123-456-32-18. Tel. 71 123 45 67</body></html>"
)
PRICING_HTML = "<html><body><h1>Cennik</h1><p>Prowizja za pośrednictwo w wynajmie: 50% czynszu netto.</p></body></html>"
SMALL_HTML = "<html><body><p>Pośrednictwo nieruchomości we Wrocławiu.</p></body></html>"
IRRELEVANT_HTML = (
    "<html><head><title>Hurtownia opon</title></head><body><p>Opony letnie i zimowe. Tel. 600 100 200</p></body></html>"
)


class FakeProvider:
    name = "fake"
    cost_per_query_usd = 0.005

    def search(self, query, *, country="pl", lang="pl", count=10):
        urls = [
            "https://www.oferteo.pl/biura-wroclaw",
            "https://przyklad-nieruchomosci.pl/",
            "https://katalog-firm-test.pl/firmy/wroclaw",
            "https://opony-hurt-test.pl/",
        ]
        return [SearchResult(u, "t", "s", i) for i, u in enumerate(urls, start=1)]


class FakeFetcher:
    def __init__(self, pages: dict[str, str]):
        self.pages = pages
        self.requested: list[str] = []

    def fetch(self, url):
        self.requested.append(url)
        if url.endswith(".pdf"):
            return FetchResult(url, url, 200, "application/pdf", "", 0, True, "not_html")
        html = self.pages.get(url)
        if html is None:
            return FetchResult(url, url, 404, "text/html", "", 0, True, "http_404")
        return FetchResult(url, url, 200, "text/html", html, len(html.encode()), True)


def make_fetcher() -> FakeFetcher:
    return FakeFetcher(
        {
            AGENCY: fixture_text("agency_official.html"),
            AGENCY + "kontakt": CONTACT_HTML,
            AGENCY + "cennik": PRICING_HTML,
            AGENCY + "o-nas/": SMALL_HTML,
            AGENCY + "oferta/sprzedaz-mieszkan": SMALL_HTML,
            "https://katalog-firm-test.pl/": fixture_text("directory_listing.html"),
            "https://opony-hurt-test.pl/": IRRELEVANT_HTML,
        }
    )


def make_mf() -> MfVatClient:
    subject = {
        "name": "PRZYKŁAD NIERUCHOMOŚCI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ", "nip": NIP,
        "statusVat": "Czynny", "regon": "123456785", "krs": "0000123456", "workingAddress": None,
        "residenceAddress": "ŚWIDNICKA 10, 50-067 WROCŁAW", "registrationLegalDate": "2011-03-01",
        "removalDate": None,
    }

    def handler(request):
        nips = request.url.path.rsplit("/", 1)[1].split(",")
        entries = [
            {"identifier": n, "subjects": [subject] if n == NIP else []} for n in nips
        ]
        return httpx.Response(200, json={"result": {"entries": entries}})

    return MfVatClient(client=httpx.Client(transport=httpx.MockTransport(handler)))


def make_krs() -> KrsClient:
    payload = json.loads(fixture_text("registry/krs_orlen.json"))
    dane = payload["odpis"]["dane"]
    payload["odpis"]["naglowekA"]["numerKRS"] = "0000123456"
    dane["dzial1"]["danePodmiotu"]["nazwa"] = "PRZYKŁAD NIERUCHOMOŚCI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ"
    dane["dzial1"]["danePodmiotu"]["identyfikatory"] = {"nip": NIP, "regon": "12345678500000"}
    dane["dzial1"]["siedzibaIAdres"]["adres"].update(
        {"ulica": "ŚWIDNICKA", "nrDomu": "10", "miejscowosc": "WROCŁAW", "kodPocztowy": "50-067"}
    )
    dane["dzial1"]["siedzibaIAdres"]["adresStronyInternetowej"] = "WWW.PRZYKLAD-NIERUCHOMOSCI.PL"
    dane["dzial3"]["przedmiotDzialalnosci"]["przedmiotPrzewazajacejDzialalnosci"] = [
        {"opis": "POŚREDNICTWO W OBROCIE NIERUCHOMOŚCIAMI", "kodDzial": "68", "kodKlasa": "31", "kodPodklasa": "Z"}
    ]

    def handler(request):
        return httpx.Response(200, json=payload)

    return KrsClient(client=httpx.Client(transport=httpx.MockTransport(handler)))


@pytest.fixture
def ctx(db, tmp_path):
    return Context(Repo(db), load_vertical("nieruchomosci"), tmp_path / "snapshots", tmp_path / "queue")


@pytest.fixture
def flow(ctx):
    """Uruchamia S1-S6 i zwraca stan potrzebny do testów importu."""
    fetcher = make_fetcher()
    mf = make_mf()
    krs = make_krs()
    discover_counts = stage_discover(ctx, FakeProvider(), "Wrocław", max_queries=3)
    probe_counts = stage_probe(ctx, fetcher, 50)
    verify_counts = stage_verify(ctx, mf, krs, 50)
    deep_counts = stage_crawl_deep(ctx, fetcher, 10)
    bundle_counts = stage_bundle(ctx, 10)
    brand_id = str(ctx.repo.conn.execute("select id from brands").fetchone()["id"])
    bundle_path = ctx.queue_dir / "pending" / "describe" / f"{brand_id}.json"
    return {
        "ctx": ctx, "fetcher": fetcher, "mf": mf, "brand_id": brand_id, "bundle_path": bundle_path,
        "counts": {
            "discover": discover_counts, "probe": probe_counts, "verify": verify_counts,
            "deep": deep_counts, "bundle": bundle_counts,
        },
    }


def write_result(flow, mutate=None) -> dict:
    bundle = json.loads(flow["bundle_path"].read_text(encoding="utf-8"))

    def fact_id(type_):
        return next(f["fact_id"] for f in bundle["facts"] if f["type"] == type_)

    candidate = next(c for c in bundle["price_candidates"] if 2.5 in c["percents"])
    result = {
        "schema_version": 1,
        "firm_id": flow["brand_id"],
        "bundle_sha256": bundle["bundle_sha256"],
        "description": {
            "text": (
                "Biuro wpisane do rejestru w 2011 roku obsługuje klientów z Wrocławia. "
                "Zajmuje się sprzedażą oraz wynajmem mieszkań, domów i lokali."
            ),
            "claims": [
                {
                    "text": "Biuro wpisane do rejestru w 2011 roku obsługuje klientów z Wrocławia.",
                    "fact_ids": [fact_id("registry_start_date"), fact_id("address")],
                },
                {
                    "text": "Zajmuje się sprzedażą oraz wynajmem mieszkań, domów i lokali.",
                    "fact_ids": [fact_id("meta_description")],
                },
            ],
        },
        "services": [
            {"name": "sprzedaż mieszkań", "quote": "pomagamy w sprzedaży i wynajmie mieszkań", "source_url": AGENCY}
        ],
        "prices": [
            {
                "candidate_id": candidate["candidate_id"], "service": "pośrednictwo w sprzedaży",
                "unit": "percent", "amount_min": 2.5, "tax_mode": "plus_vat",
                "quote": "od 2,5% + VAT", "source_url": AGENCY,
            }
        ],
    }
    if mutate:
        mutate(result)
    path = flow["ctx"].queue_dir / "results" / "describe" / f"{flow['brand_id']}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    return result


# ------------------------------------------------------------------ etapy


def test_discover_records_queries_and_filters_blocklist(flow):
    counts = flow["counts"]["discover"]
    assert counts["queries"] == 3
    assert counts["candidates"] == 3  # oferteo odpada na blockliście
    assert counts["new_domains"] == 3 and counts["blocked_results"] == 3
    conn = flow["ctx"].repo.conn
    assert conn.execute("select count(*)::int as n from search_queries").fetchone()["n"] == 3
    # logujemy wszystkie wyniki (także z blocklisty): to audyt tego, co zwróciła wyszukiwarka
    assert conn.execute("select count(*)::int as n from search_results").fetchone()["n"] == 12
    cost = conn.execute("select cost_usd from pipeline_runs where stage = 'discover'").fetchone()["cost_usd"]
    assert float(cost) == pytest.approx(0.015)
    assert conn.execute("select count(*)::int as n from domains where city_hint = 'Wrocław'").fetchone()["n"] == 3


def test_probe_classifies_and_rejects_non_official(flow):
    assert flow["counts"]["probe"] == {"official": 1, "directory": 1, "irrelevant": 1}
    conn = flow["ctx"].repo.conn
    rows = {r["host"]: r for r in conn.execute("select host, classification, verification_status from domains")}
    assert rows["przyklad-nieruchomosci.pl"]["classification"] == "official"
    assert rows["katalog-firm-test.pl"]["verification_status"] == "rejected"
    assert rows["opony-hurt-test.pl"]["classification"] == "irrelevant"
    snapshots = list((flow["ctx"].snapshots_dir / "przyklad-nieruchomosci.pl").glob("*.html"))
    assert len(snapshots) >= 2  # strona główna i kontakt


def test_probe_does_not_repeat_checked_domains(flow):
    assert stage_probe(flow["ctx"], flow["fetcher"], 50) == {}


def test_verify_links_entity_brand_and_listing(flow):
    assert flow["counts"]["verify"]["verified"] == 1
    assert flow["mf"].requests_made == 1
    conn = flow["ctx"].repo.conn
    domain = conn.execute("select * from domains where host = 'przyklad-nieruchomosci.pl'").fetchone()
    assert domain["verification_status"] == "verified" and domain["verification_score"] >= 75
    assert "NIP ze strony zgodny z rejestrem" in domain["verification_reasons"]
    entity = conn.execute("select * from legal_entities").fetchone()
    assert entity["nip"] == NIP and entity["krs"] == "0000123456" and "68.31.Z" in entity["pkd_codes"]
    assert entity["registry_source"] == "krs"
    brand = conn.execute("select * from brands").fetchone()
    assert brand["name"] == "Przykład Nieruchomości"
    listing = conn.execute(
        "select l.status, c.name from listings l join cities c on c.id = l.city_id"
    ).fetchone()
    assert (listing["status"], listing["name"]) == ("verified", "Wrocław")
    cache_rows = conn.execute("select source from registry_cache order by source").fetchall()
    assert [r["source"] for r in cache_rows] == []  # klient w teście używa pamięci, nie bazy


def test_db_cache_roundtrip(ctx):
    cache = DbCache(ctx.repo.conn)
    assert cache.get("mf_vat", NIP, 7) is None
    cache.put("mf_vat", NIP, {"subject": {"name": "X"}})
    assert cache.get("mf_vat", NIP, 7) == {"subject": {"name": "X"}}
    cache.put("mf_vat", NIP, {"subject": None})
    assert cache.get("mf_vat", NIP, 7) == {"subject": None}


def test_deep_crawl_adds_pages_and_skips_pdf(flow):
    deep = flow["counts"]["deep"]
    assert deep["pages"] >= 2 and deep.get("skipped_not_html", 0) >= 1
    conn = flow["ctx"].repo.conn
    urls = {r["url"] for r in conn.execute("select url from crawl_pages")}
    assert AGENCY + "cennik" in urls


def test_bundle_is_clean_and_queued(flow):
    assert flow["counts"]["bundle"] == {"describe": 1, "describe_new": 1}
    path = flow["bundle_path"]
    assert path.exists()
    bundle = json.loads(path.read_text(encoding="utf-8"))
    assert not contains_contacts("\n".join(s["text"] for s in bundle["source_text"]))
    assert all(f["db_id"] for f in bundle["facts"])
    assert any(c["percents"] == [50.0] for c in bundle["price_candidates"])  # z podstrony /cennik
    queue = flow["ctx"].repo.pending_queue_items("describe")
    assert len(queue) == 1 and queue[0]["bundle_sha256"] == bundle["bundle_sha256"]
    assert stage_bundle(flow["ctx"], 10) == {}  # nie tworzy duplikatów


# ------------------------------------------------------------------ import


def test_import_waits_when_no_result(flow):
    assert stage_import(flow["ctx"]) == {"waiting": 1}


def test_import_closes_item_skipped_by_model(flow):
    path = flow["ctx"].queue_dir / "results" / "skipped" / "describe" / f"{flow['brand_id']}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"reason": "deweloper, nie biuro nieruchomości"}, ensure_ascii=False), encoding="utf-8")
    assert stage_import(flow["ctx"]) == {"skipped": 1}
    item = flow["ctx"].repo.conn.execute("select status, validator_report from queue_items").fetchone()
    assert item["status"] == "rejected"
    assert item["validator_report"]["errors"][0] == {"code": "skipped", "message": "deweloper, nie biuro nieruchomości"}
    assert stage_import(flow["ctx"]) == {}  # zadanie zamknięte, nie wraca
    assert stage_bundle(flow["ctx"], 10) == {}  # pominiętej firmy nie pakujemy od nowa w każdym przebiegu


def test_deep_crawl_marks_domain_and_skips_it_for_a_week(flow):
    conn = flow["ctx"].repo.conn
    marked = conn.execute("select count(*) as n from domains where deep_crawled_at is not null").fetchone()["n"]
    assert marked >= 1
    assert flow["ctx"].repo.domains_for_deep_crawl(50) == []


def test_import_valid_result_saves_description_facts_and_prices(flow):
    write_result(flow)
    assert stage_import(flow["ctx"]) == {"done": 1}
    conn = flow["ctx"].repo.conn
    description = conn.execute("select * from descriptions").fetchone()
    assert description["status"] == "validated" and description["author"] == "claude_code"
    assert len(description["fact_ids"]) == 3
    assert description["validator_report"]["ok"] is True
    price = conn.execute("select * from price_items where is_current").fetchone()
    assert (price["unit"], float(price["amount_min"]), price["tax_mode"]) == ("percent", 2.5, "plus_vat")
    assert conn.execute("select count(*)::int as n from facts where type = 'service'").fetchone()["n"] == 1
    assert conn.execute("select status from queue_items").fetchone()["status"] == "done"
    assert stage_import(flow["ctx"]) == {}  # nic nie czeka


def test_import_rejects_invalid_result_and_saves_nothing(flow):
    def bad(result):
        result["description"]["claims"][0]["fact_ids"] = ["f999"]

    write_result(flow, bad)
    assert stage_import(flow["ctx"]) == {"rejected": 1}
    conn = flow["ctx"].repo.conn
    assert conn.execute("select count(*)::int as n from descriptions").fetchone()["n"] == 0
    item = conn.execute("select status, validator_report, attempts from queue_items").fetchone()
    assert item["status"] == "rejected" and item["attempts"] == 1
    assert item["validator_report"]["errors"][0]["code"] == "unknown_fact_id"


def test_import_rejects_stale_bundle_and_bad_json(flow):
    write_result(flow)
    bundle = json.loads(flow["bundle_path"].read_text(encoding="utf-8"))
    bundle["name"] = "Zmienione po wygenerowaniu"
    bundle["bundle_sha256"] = "0" * 64
    flow["bundle_path"].write_text(json.dumps(bundle, ensure_ascii=False), encoding="utf-8")
    assert stage_import(flow["ctx"]) == {"rejected": 1}
    item = flow["ctx"].repo.conn.execute("select validator_report from queue_items").fetchone()
    assert item["validator_report"]["errors"][0]["code"] == "stale_bundle"


def test_import_rejects_unparseable_result(flow):
    path = flow["ctx"].queue_dir / "results" / "describe" / f"{flow['brand_id']}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("{nie json", encoding="utf-8")
    assert stage_import(flow["ctx"]) == {"rejected": 1}


def test_new_price_supersedes_old_one(flow):
    write_result(flow)
    stage_import(flow["ctx"])
    repo = flow["ctx"].repo
    repo.replace_price_items(
        flow["brand_id"],
        [{"service": "pośrednictwo w sprzedaży", "unit": "percent", "amount_min": 3.0, "amount_max": None,
          "tax_mode": "net", "conditions": None, "quote": "3% netto", "source_url": AGENCY}],
    )
    rows = repo.conn.execute("select amount_min, is_current from price_items order by created_at").fetchall()
    assert [(float(r["amount_min"]), r["is_current"]) for r in rows] == [(2.5, False), (3.0, True)]


def test_status_counts(flow):
    status = flow["ctx"].repo.status_counts()
    assert status["domains_by_status"] == {"rejected": 2, "verified": 1}
    assert status["listings_by_status"] == {"verified": 1}
    assert status["queue_by_status"] == {"describe:pending": 1}


def test_discover_from_file_imports_candidates_once(ctx, tmp_path):
    """Dostawca z pliku (wyniki zebrane przez Claude Code): kandydaci trafiają do bazy, ten sam plik tylko raz."""
    from katalog_worker.search import FileSearch

    data = {
        "city": "Wrocław",
        "queries": [
            {
                "query": "biuro nieruchomości Wrocław",
                "results": [
                    {"url": "https://www.oferteo.pl/biura-wroclaw", "title": "katalog"},
                    {"url": "https://przyklad-nieruchomosci.pl/oferty", "title": "Przykład"},
                ],
            },
            {"query": "pośrednik wynajem Wrocław", "results": [{"url": "https://przyklad-nieruchomosci.pl/", "title": "x"}]},
        ],
    }
    path = tmp_path / "wroclaw.json"
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    provider = FileSearch.from_path(path)

    counts = stage_discover(
        ctx, provider, provider.city, queries=provider.queries, source_sha256=provider.source_sha256
    )
    assert counts["queries"] == 2
    assert counts["new_domains"] == 1  # oferteo to katalog z blocklisty
    assert counts["blocked_results"] == 1
    hosts = [r["host"] for r in ctx.repo.conn.execute("select host from domains").fetchall()]
    assert hosts == ["przyklad-nieruchomosci.pl"]
    row = ctx.repo.conn.execute("select city_hint from domains").fetchone()
    assert row["city_hint"] == "Wrocław"
    logged = ctx.repo.conn.execute(
        "select provider, cost_usd::float8 as cost from search_queries order by created_at"
    ).fetchall()
    assert {r["provider"] for r in logged} == {"claude_websearch"} and all(r["cost"] == 0 for r in logged)

    again = stage_discover(
        ctx, provider, provider.city, queries=provider.queries, source_sha256=provider.source_sha256
    )
    assert again == {"skipped_already_imported": 1}
    assert ctx.repo.conn.execute("select count(*) as n from search_queries").fetchone()["n"] == 2


def _agency_without_nip_pages():
    import re

    home = fixture_text("agency_official.html")
    home = re.sub(r"<p>NIP:[^<]*</p>", "<p>Biuro nieruchomości we Wrocławiu.</p>", home)
    home = re.sub(r'\s*"taxID": "[^"]*",', "", home)  # NIP także z JSON-LD, żeby strona go nie zawierała
    assert "123-456-32-18" not in home
    home = home.replace(
        '<a href="/kontakt">Kontakt</a>',
        '<a href="/kontakt">Kontakt</a>\n    <a href="/polityka-prywatnosci">Polityka prywatności</a>',
    )
    contact = (
        "<html><head><title>Kontakt</title></head><body>Kontakt. ul. Świdnicka 10, 50-067 Wrocław. "
        "Tel. 71 123 45 67</body></html>"
    )
    privacy = (
        "<html><head><title>Polityka prywatności</title></head><body><h1>Polityka prywatności</h1>"
        "<p>Administratorem danych jest Przykład Nieruchomości Sp. z o.o., NIP: 123-456-32-18. "
        "Inspektor: Anna Nowak, anna.nowak@przyklad-nieruchomosci.pl</p></body></html>"
    )
    return {
        AGENCY: home,
        AGENCY + "kontakt": contact,
        AGENCY + "polityka-prywatnosci": privacy,
        AGENCY + "cennik": PRICING_HTML,
        AGENCY + "o-nas/": SMALL_HTML,
        AGENCY + "oferta/sprzedaz-mieszkan": SMALL_HTML,
    }


def test_probe_falls_back_to_privacy_policy_for_nip_and_keeps_it_out_of_bundles(ctx):
    fetcher = FakeFetcher(_agency_without_nip_pages())
    stage_discover(ctx, FakeProvider(), "Wrocław", max_queries=1)
    stage_probe(ctx, fetcher, 50)
    # kontakt jest pobierany mimo niższej punktacji niż cennik i "o nas"
    assert AGENCY + "kontakt" in fetcher.requested
    assert AGENCY + "polityka-prywatnosci" in fetcher.requested

    verify = stage_verify(ctx, make_mf(), make_krs(), 50)
    assert verify["verified"] == 1  # NIP znaleziony dopiero w polityce prywatności

    stage_crawl_deep(ctx, fetcher, 10)
    stage_bundle(ctx, 10)
    brand_id = str(ctx.repo.conn.execute("select id from brands").fetchone()["id"])
    raw = (ctx.queue_dir / "pending" / "describe" / f"{brand_id}.json").read_text(encoding="utf-8")
    assert "polityka-prywatnosci" not in raw and "Anna Nowak" not in raw
    assert "anna.nowak" not in raw


def test_probe_skips_privacy_policy_when_nip_is_already_found(ctx):
    pages = _agency_without_nip_pages()
    pages[AGENCY + "kontakt"] = CONTACT_HTML  # kontakt ma NIP
    fetcher = FakeFetcher(pages)
    stage_discover(ctx, FakeProvider(), "Wrocław", max_queries=1)
    stage_probe(ctx, fetcher, 50)
    assert AGENCY + "polityka-prywatnosci" not in fetcher.requested


def test_bundle_skips_leaking_brand_without_stopping_and_rolls_back_its_facts(ctx, monkeypatch):
    import katalog_worker.pipeline as pipeline_module
    from katalog_worker.bundle import ContactLeakError

    fetcher = make_fetcher()
    stage_discover(ctx, FakeProvider(), "Wrocław", max_queries=1)
    stage_probe(ctx, fetcher, 50)
    stage_verify(ctx, make_mf(), make_krs(), 50)
    stage_crawl_deep(ctx, fetcher, 10)

    def leaking(bundle, queue_dir):
        raise ContactLeakError(["facts[f1:site_title].value"])

    monkeypatch.setattr(pipeline_module, "write_bundle", leaking)
    counts = stage_bundle(ctx, 10)
    assert counts.get("blocked_contacts") == 1 and "describe" not in counts
    assert ctx.repo.conn.execute("select count(*) as n from facts").fetchone()["n"] == 0
    assert ctx.repo.conn.execute("select count(*) as n from queue_items").fetchone()["n"] == 0


def test_lost_snapshots_and_bundles_are_recovered_on_next_run(flow):
    import shutil

    ctx = flow["ctx"]
    assert flow["bundle_path"].exists()
    # nowy runner: brak zrzutów stron i brak pliku paczki, a w bazie zostało zadanie 'pending'
    shutil.rmtree(ctx.snapshots_dir)
    flow["bundle_path"].unlink()

    from katalog_worker.pipeline import stage_requeue_lost

    assert stage_requeue_lost(ctx) == {"requeued_lost": 1}
    deep = stage_crawl_deep(ctx, flow["fetcher"], 10)
    assert deep.get("refetched_home") == 1

    counts = stage_bundle(ctx, 10)
    assert counts.get("describe") == 1
    assert flow["bundle_path"].exists()
    statuses = [r["status"] for r in ctx.repo.conn.execute("select status from queue_items").fetchall()]
    assert statuses == ["pending"]  # to samo zadanie wróciło do kolejki z nowym plikiem paczki


def test_mentions_city_handles_polish_inflection_and_listing_city_rule():
    from katalog_worker.pipeline import listing_city, mentions_city

    assert mentions_city("Biuro działa we Wrocławiu i okolicach", "Wrocław")
    assert mentions_city("Mieszkania w Krakowie", "Kraków")
    assert mentions_city("Oferty z Łodzi", "Łódź")
    assert not mentions_city("Oferty z Poznania", "Wrocław")
    # całe słowa, nie początek nazwy (etap 2 planu poprawy)
    assert not mentions_city("Biuro przy ul. Warszawskiej", "Warszawa")
    assert not mentions_city("Oddział w Lublińcu", "Lublin")
    assert not mentions_city("Apartament ze szczytem", "Szczyrk")
    from katalog_worker.city import AddressHit

    office = [AddressHit("50-001", "Wrocław", "Biuro: ul. Rynek 1, 50-001 Wrocław")]
    # siedziba w rejestrze we wsi pod miastem, adres biura na stronie w mieście z wyszukiwania
    assert listing_city("KIEŁCZÓW", "Wrocław", "Biuro nieruchomości we Wrocławiu", office) == "Wrocław"
    # bez adresu biura na stronie wygrywa rejestr (sama wzmianka nie wystarcza)
    assert listing_city("KIEŁCZÓW", "Wrocław", "Biuro nieruchomości we Wrocławiu") == "Kiełczów"
    assert listing_city("ŻAGAŃ", "Wrocław", "Oferty w Żaganiu") == "Żagań"
    # bez rejestru i adresu: miasto z wyszukiwania tylko, gdy strona je wymienia
    assert listing_city(None, "Wrocław", "Działamy we Wrocławiu") == "Wrocław"
    assert listing_city(None, "Wrocław", "") is None


def test_decide_city_on_audit_examples():
    from katalog_worker.city import AddressHit, decide_city, known_cities

    known = known_cities(["Kraków", "Warszawa", "Jasło", "Elbląg", "Szczyrk", "Szczecin", "Olkusz"])

    def d(registry, hint, text, hits, name="", host=""):
        return decide_city(registry, hint, text, hits, known, name, host)

    # Krakowski Metraż: adres biura w Krakowie (miasto wyszukiwania), właściciel serwisu w Warszawie
    r = d("WARSZAWA", "Kraków", "", [AddressHit("30-102", "Kraków Polska E-mail", "ul. Morawskiego 5/127 30-102 Kraków"),
                                     AddressHit("00-511", "Warszawa", "właścicielem serwisu jest INFINITI ESTATE")])
    assert (r.city, r.source) == ("Kraków", "adres_wyszukiwanie")
    # Biuro z Jasła wyszukane w Warszawie: adres firmy przetwarzającej dane i "ul. Warszawska" nie dają Warszawy
    r = d("JASŁO", "Warszawa", "ul. Warszawska 5",
          [AddressHit("00-382", "Warszawa", "danych przetwarzanych przez CBJ sp z.o.o., ul. Solec 81B, 00-382 Warszawa"),
           AddressHit("38-200", "Jasło", "Siedziba ul. Lwowska 24J 38-200 Jasło")])
    assert (r.city, r.source) == ("Jasło", "rejestr_adres")
    # Firma ze Szczecina wyszukana w Szczyrku: adres w Szczecinie
    r = d(None, "Szczyrk", "szczyt formy", [AddressHit("70-001", "Szczecin", "biuro: ul. X, 70-001 Szczecin")])
    assert (r.city, r.source) == ("Szczecin", "adres")
    # Sam adres UODO z polityki prywatności nie jest adresem biura
    r = d(None, "Warszawa", "", [AddressHit("00-193", "Warszawa", "Prezes UODO, ul. Stawki 2, 00-193 Warszawa")])
    assert r.city is None and r.source == "brak"
    # Sygnały do przeglądu: inne miasto w nazwie biura lub domenie, zagraniczna domena
    r = d("WARSZAWA", "Warszawa", "", [], name="WGN Nieruchomości Elbląg", host="nieruchomosci-olkusz.pl")
    assert any("Elbląg" in w for w in r.warnings) and any("Olkusz" in w for w in r.warnings)
    r = d("WARSZAWA", "Warszawa", "", [], name="Immobi", host="immobi.co.za")
    assert any("zagraniczna domena" in w for w in r.warnings)


def test_cities_report_dry_run_and_apply_with_redirect(flow, tmp_path):
    import csv

    from katalog_worker.pipeline import stage_cities_report, stage_publish_ready

    ctx, brand_id = flow["ctx"], flow["brand_id"]
    conn = ctx.repo.conn
    conn.execute("insert into settings (key, value) values ('auto_publish', 'true') on conflict (key) do update set value = 'true'")
    conn.execute("update settings set value = '3' where key = 'publish_min_facts'")
    write_result(flow)
    stage_import(ctx)
    stage_publish_ready(ctx)
    row = conn.execute(
        "select l.id, l.slug, c.slug as city_slug, c.name as city from listings l join cities c on c.id = l.city_id "
        "where l.brand_id = %s and l.status = 'published'", (brand_id,)).fetchone()
    # Wpis stoi w złym mieście (jak biura ze Szczecina w Szczyrku), a strona podaje adres biura w Szczecinie.
    wrong = ctx.repo.ensure_city("Szczyrk")
    conn.execute("update listings set city_id = %s where id = %s", (wrong, row["id"]))
    conn.execute("update legal_entities set registered_address = null")
    conn.execute("update domains set city_hint = 'Szczyrk' where brand_id = %s", (brand_id,))
    conn.execute("update facts set is_current = false where brand_id = %s and type in ('address', 'address_hint')",
                 (brand_id,))
    ctx.repo.add_fact(brand_id, "address_hint", "70-001 Szczecin", "Biuro: ul. Wały Chrobrego 1, 70-001 Szczecin",
                      AGENCY, "regex", 0.9)
    conn.commit()
    old_path = f"/szczyrk/{row['slug']}"

    counts = stage_cities_report(ctx, str(tmp_path / "raport"))
    assert counts.get("przeniesienie") == 1
    report = list(csv.DictReader((tmp_path / "raport" / "raport-miasta.csv").open(encoding="utf-8")))
    assert report[0]["stare_miasto"] == "Szczyrk" and report[0]["nowe_miasto"] == "Szczecin"
    assert "Szczyrk: 1 -> 0" in (tmp_path / "raport" / "raport-miasta-podsumowanie.md").read_text(encoding="utf-8")
    city_now = conn.execute("select c.name from listings l join cities c on c.id = l.city_id where l.id = %s",
                            (row["id"],)).fetchone()["name"]
    assert city_now == "Szczyrk"  # na sucho nic się nie zmienia

    counts = stage_cities_report(ctx, str(tmp_path / "raport"), apply=True)
    assert counts.get("moved") == 1
    moved = conn.execute("select c.name, l.city_source from listings l join cities c on c.id = l.city_id where l.id = %s",
                         (row["id"],)).fetchone()
    assert moved["name"] == "Szczecin" and moved["city_source"] == "adres"
    redirect = conn.execute("select listing_id from listing_redirects where from_path = %s", (old_path,)).fetchone()
    assert str(redirect["listing_id"]) == str(row["id"])


def test_import_applies_brand_name_from_result(flow):
    def add_brand(result):
        bundle = json.loads(flow["bundle_path"].read_text(encoding="utf-8"))
        source = bundle["source_text"][0]
        words = source["text"].split()
        quote = " ".join(words[:6])
        result["brand"] = {"name": " ".join(words[:2]), "quote": quote, "source_url": source["source_url"]}

    write_result(flow, add_brand)
    assert stage_import(flow["ctx"]) == {"done": 1}
    name = flow["ctx"].repo.conn.execute("select name from brands").fetchone()["name"]
    bundle = json.loads(flow["bundle_path"].read_text(encoding="utf-8"))
    assert name == " ".join(bundle["source_text"][0]["text"].split()[:2])


def test_import_rejects_brand_name_missing_from_quote(flow):
    def bad_brand(result):
        bundle = json.loads(flow["bundle_path"].read_text(encoding="utf-8"))
        source = bundle["source_text"][0]
        result["brand"] = {"name": "Zmyślona Marka", "quote": " ".join(source["text"].split()[:6]),
                           "source_url": source["source_url"]}

    write_result(flow, bad_brand)
    assert stage_import(flow["ctx"]) == {"rejected": 1}


def test_publish_ready_publishes_gated_listing_with_slug_and_audit(flow):
    from katalog_worker.pipeline import stage_publish_ready

    ctx = flow["ctx"]
    conn = ctx.repo.conn
    conn.execute("insert into settings (key, value) values ('auto_publish', 'true') on conflict (key) do update set value = 'true'")
    conn.execute("update settings set value = '3' where key = 'publish_min_facts'")
    conn.commit()
    assert stage_publish_ready(ctx) == {}  # brak opisu: nic do publikacji

    write_result(flow)
    stage_import(ctx)
    counts = stage_publish_ready(ctx)
    assert counts.get("published") == 1
    listing = conn.execute("select status, slug, noindex, published_at from listings").fetchone()
    assert listing["status"] == "published" and listing["noindex"] is False and listing["published_at"]
    assert listing["slug"]
    assert conn.execute("select status from descriptions").fetchone()["status"] == "published"
    audit = conn.execute("select actor, action from audit_log").fetchone()
    assert (audit["actor"], audit["action"]) == ("pipeline", "listing.publish")
    assert stage_publish_ready(ctx) == {}  # drugi raz nic


def test_publish_ready_respects_switch(flow):
    from katalog_worker.pipeline import stage_publish_ready

    conn = flow["ctx"].repo.conn
    conn.execute("update settings set value = 'false' where key = 'auto_publish'")
    conn.commit()
    write_result(flow)
    stage_import(flow["ctx"])
    assert stage_publish_ready(flow["ctx"]) == {"auto_publish": "wyłączone"}
    assert conn.execute("select status from listings").fetchone()["status"] == "verified"


# ------------------------------------------------------------------ oferty


def offers_page(ids) -> str:
    cards = "".join(
        f'<div class="o"><h3><a href="/oferta/mieszkanie-{i}-pokoje-{1000 + i}">Mieszkanie {i} pokoje, Wrocław</a></h3></div>'
        for i in ids
    )
    return f"<html><body><main>{cards}</main></body></html>"


def test_offers_saved_refreshed_and_kept_when_read_fails(flow, capsys):
    from katalog_worker.pipeline import stage_offers

    ctx = flow["ctx"]
    conn = ctx.repo.conn
    fetcher = make_fetcher()
    assert stage_offers(ctx, fetcher) == {}  # brak opublikowanych wpisów
    conn.execute("update listings set status = 'published'")
    conn.execute("update domains set offers_url = %s where verification_status = 'verified'", (AGENCY + "oferty",))
    conn.commit()

    fetcher.pages[AGENCY + "oferty"] = offers_page([1, 2, 3, 4])
    assert stage_offers(ctx, fetcher, dry_run=True) == {"domains": 1, "with_offers": 1}
    assert conn.execute("select count(*)::int as n from offers").fetchone()["n"] == 0  # dry-run nic nie zapisuje
    assert '"offers": 4' in capsys.readouterr().err

    assert stage_offers(ctx, fetcher) == {"domains": 1, "with_offers": 1, "offers_new": 4}
    rows = conn.execute("select title, url, position, is_active from offers order by position").fetchall()
    assert [r["title"] for r in rows] == [f"Mieszkanie {i} pokoje, Wrocław" for i in (1, 2, 3, 4)]
    assert rows[0]["url"] == AGENCY + "oferta/mieszkanie-1-pokoje-1001"
    checked = conn.execute("select offers_url, offers_checked_at from domains where offers_url is not null").fetchone()
    assert checked["offers_url"] == AGENCY + "oferty" and checked["offers_checked_at"]

    fetcher.pages[AGENCY + "oferty"] = offers_page([3, 4, 5])
    counts = stage_offers(ctx, fetcher)
    assert counts == {"domains": 1, "with_offers": 1, "offers_new": 1, "offers_updated": 2, "offers_deactivated": 2}
    active = conn.execute("select title, position from offers where is_active order by position").fetchall()
    assert [r["title"] for r in active] == [f"Mieszkanie {i} pokoje, Wrocław" for i in (3, 4, 5)]

    del fetcher.pages[AGENCY + "oferty"]  # strona z ofertami nie działa: poprzednie oferty zostają
    assert stage_offers(ctx, fetcher) == {"domains": 1, "without_offers": 1}
    assert conn.execute("select count(*)::int as n from offers where is_active").fetchone()["n"] == 3
    assert conn.execute("select offers_url from domains where offers_url is not null").fetchone()["offers_url"] == AGENCY + "oferty"


def test_pick_contacts_prefers_tel_links_and_skips_personal_and_foreign_emails():
    from katalog_worker.extract import extract_page
    from katalog_worker.pipeline import contact_page_urls, pick_contacts

    html = """<html><body>
      <a href="/kontakt">Kontakt</a><a href="/o-nas">O nas</a><a href="/oferty">Oferty</a>
      <a href="tel:+48600100200">600 100 200</a>
      <a href="mailto:biuro@przyklad.pl">biuro@przyklad.pl</a>
      <a href="mailto:jan.kowalski@przyklad.pl">Jan</a>
      <a href="mailto:kontakt@innafirma.pl">x</a>
      <a href="https://www.facebook.com/przyklad.nieruchomosci">FB</a>
      <a href="https://www.instagram.com/przyklad_nieruchomosci/">IG</a>
    </body></html>"""
    page = extract_page(html, "https://przyklad.pl/")
    assert contact_page_urls(page.links, "https://przyklad.pl/")[0].endswith("/kontakt")
    found = pick_contacts([page], "przyklad.pl")
    assert [v for v, _ in found["phones"]] == ["+48600100200"]
    assert [v for v, _ in found["emails"]] == ["biuro@przyklad.pl"]
    assert {n for n, _, _ in found["socials"]} == {"facebook", "instagram"}


def test_pick_image_prefers_og_then_logo_then_icon_and_skips_svg():
    from katalog_worker.pipeline import pick_image

    base = "https://przyklad.pl/"
    og = '<html><head><meta property="og:image" content="/img/share.jpg"></head></html>'
    assert pick_image(og, base) == ("https://przyklad.pl/img/share.jpg", "og")
    logo = ('<html><head><meta property="og:image" content="/a.svg"><script type="application/ld+json">'
            '{"@type": "RealEstateAgent", "logo": {"url": "https://cdn.przyklad.pl/logo.png"}}</script></head></html>')
    assert pick_image(logo, base) == ("https://cdn.przyklad.pl/logo.png", "logo")
    icon = '<html><head><link rel="apple-touch-icon" href="/apple.png"></head></html>'
    assert pick_image(icon, base) == ("https://przyklad.pl/apple.png", "icon")
    assert pick_image('<html><head><meta property="og:image" content="http://x.pl/a.jpg"></head></html>', base) is None


def test_google_place_is_matched_by_website_domain_or_name_and_reviews_are_parsed():
    import httpx

    from katalog_worker.google_places import fetch_place

    def handler(request):
        assert request.headers["X-Goog-Api-Key"] == "test"
        return httpx.Response(200, json={"places": [
            {"id": "other", "displayName": {"text": "Inna firma"}, "websiteUri": "https://inna.pl/"},
            {"id": "ours", "displayName": {"text": "Przykład Nieruchomości"}, "websiteUri": "https://www.przyklad.pl/kontakt",
             "rating": 4.7, "userRatingCount": 31, "googleMapsUri": "https://maps.google.com/?cid=1",
             "reviews": [{"rating": 5, "text": {"text": "Bardzo pomocni."},
                          "authorAttribution": {"displayName": "Anna K."}, "relativePublishTimeDescription": "miesiąc temu"}]},
        ]})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    result = fetch_place("Przykład Nieruchomości", "Wrocław", "https://przyklad.pl/", lambda n: False, client, "test")
    assert (result.place_id, result.rating, result.rating_count) == ("ours", 4.7, 31)
    assert result.reviews[0]["author"] == "Anna K." and result.reviews[0]["rating"] == 5

    empty = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200, json={"places": [
        {"id": "x", "displayName": {"text": "Zupełnie inna"}, "websiteUri": "https://inna.pl/"}]})))
    assert fetch_place("Przykład", "Wrocław", "https://przyklad.pl/", lambda n: False, empty, "test").status == "not_found"


def test_pick_images_separates_logo_from_cover_photo():
    from katalog_worker.pipeline import pick_images

    base = "https://przyklad.pl/"
    html = """<html><head>
      <meta property="og:image" content="/wp-content/uploads/logo-przyklad.png">
    </head><body>
      <header class="site-header"><a class="navbar-brand"><img src="/img/logo.png" alt="Przykład"></a></header>
      <section class="hero-slider"><img src="/uploads/salon-z-oknem.jpg" alt=""></section>
      <img src="/uploads/ikona-telefon.png" width="24">
    </body></html>"""
    assert pick_images(html, base) == {
        "logo": "https://przyklad.pl/wp-content/uploads/logo-przyklad.png",
        "cover": "https://przyklad.pl/uploads/salon-z-oknem.jpg",
    }
    photo_og = '<html><head><meta property="og:image" content="/share/biuro.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"></head></html>'
    assert pick_images(photo_og, base)["cover"] == "https://przyklad.pl/share/biuro.jpg"
    square_og = '<html><head><meta property="og:image" content="/share/x.png"><meta property="og:image:width" content="500"><meta property="og:image:height" content="500"></head></html>'
    assert pick_images(square_og, base) == {"logo": "https://przyklad.pl/share/x.png", "cover": None}


def test_agency_without_any_nip_gets_unconfirmed_brand_listing_and_bundle(ctx):
    pages = _agency_without_nip_pages()
    pages[AGENCY + "polityka-prywatnosci"] = "<html><body><h1>Polityka prywatności</h1><p>Dane są bezpieczne.</p></body></html>"
    fetcher = FakeFetcher(pages)
    stage_discover(ctx, FakeProvider(), "Wrocław", max_queries=1)
    stage_probe(ctx, fetcher, 50)
    verify = stage_verify(ctx, make_mf(), make_krs(), 50)
    assert verify.get("needs_review") == 1
    brand = ctx.repo.conn.execute("select id, legal_entity_id, name from brands").fetchone()
    assert brand["legal_entity_id"] is None and brand["name"]
    listing = ctx.repo.conn.execute("select status from listings where brand_id = %s", (brand["id"],)).fetchone()
    assert listing["status"] == "needs_review"
    # drugi przebieg nie zakłada drugiej marki
    stage_verify(ctx, make_mf(), make_krs(), 50)
    assert ctx.repo.conn.execute("select count(*) as n from brands").fetchone()["n"] == 1
    stage_crawl_deep(ctx, fetcher, 10)
    assert stage_bundle(ctx, 10).get("describe") == 1


def test_fetch_parallel_uses_clones_and_returns_every_item(monkeypatch):
    import threading

    from katalog_worker.pipeline import _fetch_parallel

    class Fake:
        clones = 0
        lock = threading.Lock()

        def clone(self):
            with Fake.lock:
                Fake.clones += 1
            return Fake()

    monkeypatch.setenv("CRAWLER_WORKERS", "4")
    items = list(range(20))
    seen = dict(_fetch_parallel(Fake(), items, lambda f, i: (type(f).__name__, i * 2)))
    assert sorted(seen) == items
    assert all(v == ("Fake", k * 2) for k, v in seen.items())
    assert 1 <= Fake.clones <= 4

    monkeypatch.setenv("CRAWLER_WORKERS", "1")
    Fake.clones = 0
    assert [i for i, _ in _fetch_parallel(Fake(), items, lambda f, i: i)] == items
    assert Fake.clones == 0


def test_reverify_confirms_unconfirmed_agency_from_later_subpage(ctx):
    from katalog_worker.pipeline import stage_reverify

    pages = _agency_without_nip_pages()
    pages[AGENCY + "polityka-prywatnosci"] = "<html><body><h1>Polityka prywatności</h1><p>Dane są bezpieczne.</p></body></html>"
    # NIP jest dopiero na podstronie "O nas", którą pobiera crawl-deep, a nie pierwsza weryfikacja.
    pages[AGENCY + "o-nas/"] = (
        "<html><head><title>O nas</title></head><body><h1>O nas</h1><p>Przykład Nieruchomości Sp. z o.o., "
        "pośrednictwo w obrocie nieruchomościami we Wrocławiu. NIP: 123-456-32-18.</p></body></html>"
    )
    fetcher = FakeFetcher(pages)
    stage_discover(ctx, FakeProvider(), "Wrocław", max_queries=1)
    stage_probe(ctx, fetcher, 50)
    assert stage_verify(ctx, make_mf(), make_krs(), 50).get("needs_review") == 1
    stage_crawl_deep(ctx, fetcher, 10)
    conn = ctx.repo.conn
    brand_before = conn.execute("select id, legal_entity_id from brands").fetchone()
    assert brand_before["legal_entity_id"] is None

    counts = stage_reverify(ctx, make_mf(), make_krs(), 50)
    assert sum(v for k, v in counts.items() if k.startswith("confirmed_")) == 1
    brand = conn.execute("select id, legal_entity_id from brands").fetchone()
    assert brand["id"] == brand_before["id"] and brand["legal_entity_id"] is not None  # ta sama marka, z podmiotem
    assert conn.execute("select count(*) as n from brands").fetchone()["n"] == 1
    # drugi raz w ciągu 30 dni tej domeny nie sprawdza
    assert stage_reverify(ctx, make_mf(), make_krs(), 50) == {"mf_requests": 0}


def test_publish_ready_keeps_city_when_brand_already_has_listing_in_hinted_city(flow):
    from katalog_worker.pipeline import stage_publish_ready

    ctx, brand_id = flow["ctx"], flow["brand_id"]
    conn = ctx.repo.conn
    conn.execute("insert into settings (key, value) values ('auto_publish', 'true') on conflict (key) do update set value = 'true'")
    conn.execute("update settings set value = '3' where key = 'publish_min_facts'")
    write_result(flow)
    stage_import(ctx)
    # Wyszukiwanie znalazło firmę w Oławie, fakty o niej wymieniają Oławę, a marka ma już tam osobny wpis.
    conn.execute("update domains set city_hint = 'Oława' where brand_id = %s", (brand_id,))
    ctx.repo.add_fact(brand_id, "address_hint", "55-200 Oława", "ul. Rynek 1, 55-200 Oława", AGENCY, "regex", 0.9)
    listing = conn.execute("select id, vertical_id, city_id from listings where brand_id = %s", (brand_id,)).fetchone()
    olawa = ctx.repo.ensure_city("Oława")
    conn.execute(
        "insert into listings (brand_id, vertical_id, city_id, status) values (%s, %s, %s, 'needs_review')",
        (brand_id, listing["vertical_id"], olawa),
    )
    conn.commit()
    counts = stage_publish_ready(ctx)  # wcześniej: UniqueViolation i przerwany krok
    assert counts.get("city_kept_duplicate", 0) >= 1 and counts.get("published", 0) >= 1
    kept = conn.execute("select status, city_id from listings where id = %s", (listing["id"],)).fetchone()
    assert kept["status"] == "published" and kept["city_id"] == listing["city_id"]


def test_extra_cities_office_address_needs_an_offer_in_that_city(flow):
    from katalog_worker.pipeline import stage_extra_cities, stage_publish_ready

    ctx, brand_id = flow["ctx"], flow["brand_id"]
    conn = ctx.repo.conn
    conn.execute("insert into settings (key, value) values ('auto_publish', 'true') on conflict (key) do update set value = 'true'")
    conn.execute("update settings set value = '3' where key = 'publish_min_facts'")
    write_result(flow)
    stage_import(ctx)
    stage_publish_ready(ctx)
    warszawa = ctx.repo.ensure_city("Warszawa")
    torun = ctx.repo.ensure_city("Toruń")
    # Z produkcji: adres UODO z polityki prywatności i adres firmy przetwarzającej dane dawały biuru wpis w Warszawie.
    ctx.repo.add_fact(brand_id, "address_hint", "00-193 Warszawa", "Prezes UODO, ul. Stawki 2, 00-193 Warszawa", AGENCY, "regex", 0.9)
    ctx.repo.add_fact(brand_id, "address_hint", "87-100 Toruń", "Oddział: ul. Szeroka 1, 87-100 Toruń", AGENCY, "regex", 0.9)
    domain_id = conn.execute("select id from domains where brand_id = %s", (brand_id,)).fetchone()["id"]
    conn.execute(
        """insert into offers (brand_id, domain_id, url, url_key, title, position, is_active, last_seen_at)
           values (%s, %s, %s, 'k1', 'Mieszkanie w Toruniu, 2 pokoje', 1, true, now())""",
        (brand_id, domain_id, f"{AGENCY}oferta/1"),
    )
    conn.commit()
    stage_extra_cities(ctx)
    status = lambda city: conn.execute(  # noqa: E731
        "select status from listings where brand_id = %s and city_id = %s", (brand_id, city)).fetchone()
    assert status(warszawa) is None  # sam adres bez oferty nie wystarcza
    assert status(torun)["status"] == "published"  # adres oddziału i oferta w tym mieście


def test_offer_mentions_city_handles_inflection_and_skips_street_names():
    from katalog_worker.pipeline import _tokens, offer_mentions_city

    def m(text, city):
        return offer_mentions_city(_tokens(text), _tokens(city))

    assert m("Apartament na sprzedaż, Karpacz, 45 m2", "Karpacz")
    assert m("Mieszkanie w Karpaczu z widokiem", "Karpacz")
    assert m("Dom w Jeleniej Górze", "Jelenia Góra")
    assert m("Działka Łódź Bałuty", "Łódź")
    assert not m("Mieszkanie, ul. Warszawska 5, Piaseczno", "Warszawa")
    assert not m("Lokal przy Krakowskim Przedmieściu", "Kraków")
    assert not m("Mieszkanie w Szklarskiej Porębie", "Karpacz")


def test_extra_cities_adds_published_listing_where_firm_has_offers(flow):
    from katalog_worker.pipeline import stage_extra_cities, stage_publish_ready

    ctx, brand_id = flow["ctx"], flow["brand_id"]
    conn = ctx.repo.conn
    conn.execute("insert into settings (key, value) values ('auto_publish', 'true') on conflict (key) do update set value = 'true'")
    conn.execute("update settings set value = '3' where key = 'publish_min_facts'")
    write_result(flow)
    stage_import(ctx)
    stage_publish_ready(ctx)
    olawa = ctx.repo.ensure_city("Oława")
    ctx.repo.ensure_city("Koło")  # nazwa-słowo: "koło lasu" nie dodaje firmy do miasta Koło
    domain_id = conn.execute("select id from domains where brand_id = %s", (brand_id,)).fetchone()["id"]
    titles = ["Mieszkanie w Oławie, 3 pokoje", "Dom Oława, koło lasu", "Działka w Oławie", "Lokal Wrocław, koło lasu",
              "Dom koło lasu"]
    for i, title in enumerate(titles):
        conn.execute(
            """insert into offers (brand_id, domain_id, url, url_key, title, position, is_active, last_seen_at)
               values (%s, %s, %s, %s, %s, %s, true, now())""",
            (brand_id, domain_id, f"{AGENCY}oferta/{i}", f"k{i}", title, i),
        )
    conn.commit()
    counts = stage_extra_cities(ctx)
    assert counts.get("extra_listings") == 1
    extra = conn.execute(
        "select status, slug from listings where brand_id = %s and city_id = %s", (brand_id, olawa)
    ).fetchone()
    assert extra["status"] == "published" and extra["slug"]
    assert stage_extra_cities(ctx) == {}  # drugi raz nic


def test_offer_mentions_city_does_not_confuse_cities_sharing_a_prefix():
    from katalog_worker.pipeline import _tokens, offer_mentions_city

    others = frozenset({"lublin", "lubliniec", "chelm", "chelmno", "wieliczka", "wielun"})

    def m(text, city):
        t = _tokens(city)
        return offer_mentions_city(_tokens(text), t, others - {t[0]})

    assert m("mieszkanie sprzedaż w lublin kośminek", "Lublin")
    assert not m("mieszkanie sprzedaż w lublin kośminek", "Lubliniec")
    assert not m("dom w Lublińcu", "Lublin")
    assert not m("mieszkanie Chełm centrum", "Chełmno")
    assert not m("mieszkanie Chełmno rynek", "Chełm")
    assert not m("Dom w Wieliczce", "Wieluń")
    assert m("Dom w Wieluniu", "Wieluń")


def test_offer_mentions_city_picks_the_closest_city_name():
    from katalog_worker.pipeline import _tokens, offer_mentions_city

    cities = frozenset("szczecin szczecinek lublin lubliniec chelm chelmno kartuzy wieliczka wielun warszawa".split())

    def m(text, city):
        return offer_mentions_city(_tokens(text), _tokens(city), cities)

    # Z produkcji: "w Szczecinie" dawało Szczecinek (a nie Szczecin), "karta" dawała Kartuzy.
    assert m("Mieszkanie w Szczecinie", "Szczecin") and not m("Mieszkanie w Szczecinie", "Szczecinek")
    assert m("Dom w Lublinie", "Lublin") and not m("Dom w Lublinie", "Lubliniec")
    assert m("Dom w Lublińcu", "Lubliniec") and not m("Dom w Lublińcu", "Lublin")
    assert m("Działka w Chełmie", "Chełm") and not m("Działka w Chełmie", "Chełmno")
    assert m("Działka w Chełmnie", "Chełmno") and not m("Działka w Chełmnie", "Chełm")
    assert not m("Karta oferty, mieszkanie", "Kartuzy") and m("Dom w Kartuzach", "Kartuzy")
    assert m("Dom w Wieliczce", "Wieliczka") and not m("Dom w Wieliczce", "Wieluń")


def test_offer_mentions_city_ignores_ordinary_words_and_own_name_in_city_set():
    from katalog_worker.pipeline import _tokens, offer_mentions_city

    # Z produkcji: "Szczegóły oferty" i ".../szczegoly/183" dawały Szczecin i Szczyrk, "Świdnica" dawała Świdnik.
    cities = frozenset({"szczecin", "szczyrk", "swidnica", "swidnik", "swidwin"})
    for text in ("Szczegóły oferty mieszkanie na sprzedaż", "https://bb-nieruchomosci.pl/mieszkania/szczegoly/183"):
        assert not offer_mentions_city(_tokens(text), ["szczecin"], cities)
        assert not offer_mentions_city(_tokens(text), ["szczyrk"], cities)
    text = _tokens("IZY-MS-6599 - Mieszkanie - /Świdnica (gw) - Sprzedaż")
    assert offer_mentions_city(text, ["swidnica"], cities)  # własna nazwa w zbiorze miast nie przeszkadza
    assert not offer_mentions_city(text, ["swidnik"], cities)
    assert not offer_mentions_city(text, ["swidwin"], cities)


def test_city_prefix_is_shared_by_every_inflection():
    from katalog_worker.pipeline import _CITY_ENDINGS, _city_prefix, _inflects

    # Szybki filtr w stage_extra_cities pomija miasto, gdy żadne słowo oferty nie zaczyna się jak _city_prefix.
    words = ["lodz", "gora", "hel", "nysa", "karpacz", "krakow", "olawa", "gliwice", "wieliczka", "sopot", "zakopane"]
    for word in words:
        for cut in range(0, 4):
            for ending in _CITY_ENDINGS:
                token = word[: len(word) - cut] + ending
                if token and _inflects(token, word):
                    assert token.startswith(_city_prefix(word)), (word, token)


def test_extra_cities_withdraws_listing_when_offers_disappear(flow):
    from katalog_worker.pipeline import stage_extra_cities, stage_publish_ready

    ctx, brand_id = flow["ctx"], flow["brand_id"]
    conn = ctx.repo.conn
    conn.execute("insert into settings (key, value) values ('auto_publish', 'true') on conflict (key) do update set value = 'true'")
    conn.execute("update settings set value = '3' where key = 'publish_min_facts'")
    write_result(flow)
    stage_import(ctx)
    stage_publish_ready(ctx)
    olawa = ctx.repo.ensure_city("Oława")
    domain_id = conn.execute("select id from domains where brand_id = %s", (brand_id,)).fetchone()["id"]
    for i in range(3):
        conn.execute(
            """insert into offers (brand_id, domain_id, url, url_key, title, position, is_active, last_seen_at)
               values (%s, %s, %s, %s, %s, %s, true, now())""",
            (brand_id, domain_id, f"{AGENCY}oferta/{i}", f"k{i}", f"Mieszkanie w Oławie {i}", i),
        )
    conn.commit()
    assert stage_extra_cities(ctx).get("extra_listings") == 1
    conn.execute("update offers set is_active = false where brand_id = %s", (brand_id,))
    conn.commit()
    assert stage_extra_cities(ctx).get("extra_removed") == 1
    status = conn.execute("select status from listings where brand_id = %s and city_id = %s", (brand_id, olawa)).fetchone()
    assert status["status"] == "removed"
    conn.execute("update offers set is_active = true where brand_id = %s", (brand_id,))
    conn.commit()
    assert stage_extra_cities(ctx).get("extra_listings") == 1  # oferty wróciły: wpis też
