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


def test_import_closes_item_skipped_by_model(flow):
    path = flow["ctx"].queue_dir / "results" / "skipped" / "describe" / f"{flow['brand_id']}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"reason": "deweloper, nie biuro nieruchomości"}, ensure_ascii=False), encoding="utf-8")
    assert stage_import(flow["ctx"]) == {"skipped": 1}
    item = flow["ctx"].repo.conn.execute("select status, validator_report from queue_items").fetchone()
    assert item["status"] == "rejected"
    assert item["validator_report"]["errors"][0] == {"code": "skipped", "message": "deweloper, nie biuro nieruchomości"}
    assert stage_import(flow["ctx"]) == {}  # zadanie zamknięte, nie wraca


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
    # siedziba w rejestrze we wsi pod miastem, strona wymienia miasto z wyszukiwania
    assert listing_city("KIEŁCZÓW", "Wrocław", "Biuro nieruchomości we Wrocławiu") == "Wrocław"
    assert listing_city("ŻAGAŃ", "Wrocław", "Oferty w Żaganiu") == "Żagań"
    assert listing_city(None, "Wrocław", "") == "Wrocław"


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
