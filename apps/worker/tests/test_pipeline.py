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
    assert flow["counts"]["bundle"] == {"describe": 1}
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
