from __future__ import annotations

import json
from pathlib import Path

import pytest

from katalog_worker import geo_measure as gm
from katalog_worker.geo_measure import (
    GeoStore, PlanItem, Parsed, build_plan, cache_key, extract_mentions, library_prompts, parse_ai_mode,
    parse_ai_overview, parse_gemini, platform_cache_key, prompt_hash, run,
)
from katalog_worker.litescrape import LiteScrapeError, LiteScrapeUnavailable

# Wartości policzone implementacją z apps/geo/lib/measure.ts (node:crypto, ta sama logika).
TS_PROMPT_HASH = "e2a23ff1c3afb314614a296a81eb97c5144fe7e24fe1d0febd65d455c29977e0"
TS_CACHE_KEY_CHATGPT = "601a2f630af877ba37385f930206f0256fdebc059d108b9d4ac3054d544298b1"
TS_CACHE_KEY_AI_MODE = "0f103c93003096c349b739428dfcc71a6f4c7bc488b0cc628eb3c059a71d0453"
TS_HASH_AB = "c8687a08aa5d6ed2044328fa6a697ab8e96dc34291e8c2034ae8c38e6fcc6d65"

TEXT = "Jakie biuro nieruchomości polecacie w Katowicach?"


# ----------------------------------------------------------------------------- hashe

def test_prompt_hash_collapses_whitespace():
    assert prompt_hash("a  b ") == prompt_hash("a b") == TS_HASH_AB
    assert prompt_hash("a\n\t b") == TS_HASH_AB


def test_hashes_match_typescript_vectors():
    assert prompt_hash(TEXT) == TS_PROMPT_HASH
    assert cache_key(TEXT, "chatgpt", None, "ui", True, "Poland", "pl") == TS_CACHE_KEY_CHATGPT
    assert platform_cache_key("najlepsze biuro nieruchomości Kraków", "google_ai_mode") == TS_CACHE_KEY_AI_MODE


def test_cache_key_differs_by_parameters():
    base = cache_key(TEXT, "gemini")
    assert base != cache_key(TEXT, "gemini", web_search=False)
    assert base != cache_key(TEXT, "gemini", model="x")
    assert base == cache_key(TEXT.upper().lower() and TEXT, "gemini", location="POLAND", language="PL")


# ----------------------------------------------------------------------------- parsery

GEMINI = {"text": (
    "Oto polecane biura nieruchomości w Katowicach:\n\n"
    "| Biuro | Opinie | Uwagi |\n|---|---|---|\n"
    "| **Alfa Nieruchomości** | 4,9 | Rynek wtórny |\n"
    "| [Beta Dom](https://beta.pl) | 4,7 | Wynajem |\n"
    "| Gamma Estate Sp. z o.o. | 4,5 | Inwestycje |\n\n"
    "Pamiętaj o sprawdzeniu **prowizji:** przed umową."), "billed": 1}

OVERVIEW = {"ai_overview": {"text_blocks": [
    {"type": "paragraph", "snippet": "W Katowicach wyróżnia się [Początek wyróżnienia]Delta Nieruchomości[Koniec wyróżnienia] oraz Omega."},
    {"type": "list", "list": [{"snippet": "Szybka sprzedaż"}, {"snippet": "Szybka sprzedaż"}]},
], "references": [
    {"title": "Ranking biur", "link": "https://www.rankingbiurnieruchomosci.pl/katowice", "source": "Ranking"},
    {"title": "Delta", "link": "https://delta-nieruchomosci.pl/oferta"},
]}, "billed": 1}

AI_MODE = {
    "text_blocks": [
        {"type": "paragraph", "snippet": "Najlepsze biura w Krakowie to Epsilon i Zeta."},
        {"type": "table", "table": [["Biuro", "Ocena"], ["Epsilon", "4,8"]]},
    ],
    "references": [
        {"title": "Epsilon", "link": "https://www.epsilon.pl/", "snippet": "Opis źródła, nie odpowiedzi", "source": "Epsilon"},
        {"title": "Duplikat", "link": "https://www.epsilon.pl/"},
        {"title": "Otodom", "url": "https://www.otodom.pl/x"},
        {"title": "bez linku"},
    ],
    "search_metadata": {"id": "x"}, "billed": 1,
}


def test_parse_gemini_text_and_no_citations():
    p = parse_gemini(GEMINI)
    assert p.answer_text.startswith("Oto polecane") and "Alfa" in p.answer_text
    assert p.citations == [] and p.highlighted == []
    assert parse_gemini({}).answer_text == ""


def test_parse_ai_overview_highlights_and_citations():
    p = parse_ai_overview(OVERVIEW)
    assert p.highlighted == ["Delta Nieruchomości"]
    assert "[Początek" not in p.answer_text and "Delta Nieruchomości oraz Omega" in p.answer_text
    assert p.answer_text.count("Szybka sprzedaż") == 1  # powtórzenia usunięte
    assert p.citations[0] == ("https://www.rankingbiurnieruchomosci.pl/katowice", "rankingbiurnieruchomosci.pl", "Ranking biur")
    assert p.citations[1][1] == "delta-nieruchomosci.pl"


def test_parse_ai_overview_empty():
    for data in ({"ai_overview": {}}, {"ai_overview": None}, {}, {"ai_overview": ""}):
        p = parse_ai_overview(data)
        assert p == Parsed()


def test_parse_ai_mode_text_table_and_references():
    p = parse_ai_mode(AI_MODE)
    assert "Epsilon i Zeta" in p.answer_text and "| Epsilon | 4,8 |" in p.answer_text
    assert "Opis źródła" not in p.answer_text  # snippet źródła to nie treść odpowiedzi
    assert [c[1] for c in p.citations] == ["epsilon.pl", "otodom.pl"]
    assert p.citations[0][2] == "Epsilon"


def test_domain_of():
    assert gm.domain_of("https://WWW.Przyklad.pl:8080/a?b=1") == "przyklad.pl"
    assert gm.domain_of("nie-url") == ""


# ----------------------------------------------------------------------------- wzmianki

BRANDS = [
    ("b-alfa", "Alfa Nieruchomości", ["alfa.pl"]),
    ("b-beta", "Biuro Beta Dom sp. z o.o.", ["beta.pl"]),
    ("b-zlo", "Żółć Nieruchomości", []),
    ("b-abc", "ABC Nieruchomości", ["abc-nieruchomosci.pl"]),
    ("b-ola", "Ola Biuro", []),  # istotne znaki: "ola" (3) - za krótkie
    ("b-delta", "Delta", ["delta-nieruchomosci.pl"]),
]


def test_mentions_table_names_diacritics_and_generic_words():
    p = parse_gemini(GEMINI)
    ms = extract_mentions(p.answer_text, p.highlighted, BRANDS)
    names = [(m.name, m.brand_id, m.match_method, m.recommended) for m in ms]
    assert names[0][1] == "b-alfa" and names[0][2] == "name_city" and names[0][3] is True
    assert names[1][1] == "b-beta"  # "Biuro Beta Dom sp. z o.o." -> "beta dom"
    assert names[2] == ("Gamma Estate Sp. z o.o.", None, None, True)  # kandydat z tabeli bez dopasowania
    assert [m.position for m in ms] == [1, 2, 3]
    assert all("prowizji" not in m.name.lower() for m in ms)  # pogrubiony nagłówek z dwukropkiem pominięty


def test_mentions_fold_diacritics_and_case():
    ms = extract_mentions("Warto zajrzeć do zolc nieruchomosci.", [], BRANDS)
    assert ms and ms[0].brand_id == "b-zlo"
    ms = extract_mentions("Warto zajrzeć do ŻÓŁĆ NIERUCHOMOŚCI.", [], BRANDS)
    assert ms[0].brand_id == "b-zlo"


def test_mentions_short_names_do_not_match():
    ms = extract_mentions("Ola poleciła znajomego, a kolega biuro olaboga.", [], BRANDS)
    assert ms == []
    # skrót wielkimi literami trzyma się dokładnie
    assert extract_mentions("Firma ABC jest znana.", [], BRANDS)[0].brand_id == "b-abc"
    assert extract_mentions("abecadło abc abcd", [], BRANDS) == []


def test_mentions_whole_words_only():
    assert extract_mentions("Alfabet jest długi, alfa-romeo też.", [], [("x", "Alfa", [])])[0].name.lower() == "alfa"
    assert extract_mentions("Alfabet jest długi.", [], [("x", "Alfa", [])]) == []


def test_mentions_recommended_by_words_and_bold():
    ms = extract_mentions("Gorąco polecam Alfa Nieruchomości w tej okolicy. Beta Dom też istnieje, ale daleko stąd, "
                          "naprawdę bardzo daleko od centrum miasta i wszystkich innych punktów w okolicy.", [], BRANDS)
    by = {m.brand_id: m for m in ms}
    assert by["b-alfa"].recommended is True and by["b-beta"].recommended is False
    ms = extract_mentions("Takie są **Alfa** i Delta.", [], BRANDS)
    by = {m.brand_id: m for m in ms}
    assert by["b-alfa"].recommended is True


def test_mentions_highlight_and_citation_domain():
    p = parse_ai_overview(OVERVIEW)
    ms = extract_mentions(p.answer_text, p.highlighted, BRANDS, p.citations)
    by = {m.brand_id: m for m in ms}
    delta = by["b-delta"]
    assert delta.recommended is True and delta.match_method == "domain" and delta.domain == "delta-nieruchomosci.pl"
    omega = [m for m in ms if m.name == "Omega"]
    assert omega == []  # tekst bez pogrubienia i bez dopasowania nie tworzy kandydata
    # cytowanie domeny firmy, której nie ma w tekście: osobna wzmianka na końcu
    ms = extract_mentions("Brak nazw tutaj.", [], BRANDS, [("https://www.alfa.pl/x", "alfa.pl", None)])
    assert len(ms) == 1 and ms[0].brand_id == "b-alfa" and ms[0].match_method == "domain" and ms[0].recommended is False


def test_mentions_order_by_first_occurrence():
    ms = extract_mentions("Najpierw Delta, potem Alfa Nieruchomości.", [], BRANDS)
    assert [m.brand_id for m in ms] == ["b-delta", "b-alfa"]
    assert [m.position for m in ms] == [1, 2]


def test_own_portal_domain_constant():
    assert gm.OWN_PORTAL_DOMAIN == "rankingbiurnieruchomosci.pl"


# ----------------------------------------------------------------------------- biblioteka pytań

def test_library_prompts_locative_and_fallback():
    prompts = library_prompts("nieruchomosci", ["Katowice", "Mikołów"])
    texts = [p["text"] for p in prompts]
    assert "jakie biuro nieruchomości polecacie w Katowicach" in texts
    assert "najlepsze biuro nieruchomości Katowice" in texts
    assert "ile kosztuje pośrednik nieruchomości w Katowicach" in texts
    assert "polecane biuro nieruchomości Mikołów" in texts  # miasto spoza mapy: forma bez przyimka
    assert all("{" not in t for t in texts)
    assert {p["intent"] for p in prompts} <= {"recommendation", "price", "comparison"}
    assert all(3 <= len(t) <= 500 for t in texts)


# ----------------------------------------------------------------------------- planowanie i uruchomienie (bez sieci i bazy)

class FakeStore:
    def __init__(self, cached=()):
        self.cached = set(cached)
        self.saved = []

    def top_cities(self, n):
        return [{"id": "c1", "name": "Katowice"}, {"id": "c2", "name": "Kraków"}, {"id": "c3", "name": "Gdynia"}][:n]

    def known_brands(self, city_id):
        return [("b-alfa", "Alfa Nieruchomości", ["alfa.pl"])]

    def fresh_measurement(self, key, max_age_days):
        return "m-1" if key in self.cached else None

    def save_measurement(self, item, parsed, mentions, *, status, error):
        self.saved.append((item, parsed, mentions, status, error))
        return "id"


class FakeClient:
    def __init__(self, fail_on=None, unavailable_after=None):
        self.calls = []
        self.available = True
        self.fail_on = fail_on
        self.unavailable_after = unavailable_after

    def _get(self, kind, path, params, **kw):
        self.calls.append((kind, path, params, kw))
        if self.unavailable_after is not None and len(self.calls) > self.unavailable_after:
            raise LiteScrapeUnavailable("brak salda")
        if self.fail_on == len(self.calls):
            raise LiteScrapeError("HTTP 500")
        return {"text": "Polecam **Alfa Nieruchomości** w tym mieście.", "billed": 1}


def test_dry_run_plans_without_calls():
    plan0 = build_plan(FakeStore(), FakeStore().top_cities(1), "nieruchomosci", ["gemini"], 1, 7)
    store = FakeStore(cached={plan0[0].cache_key})
    report = run(store, None, cities=2, platforms=["gemini", "google_ai_mode"], per_city=2, dry_run=True)
    assert report["planned"] == 8 and report["cache_hits"] == 1 and report["to_call"] == 7
    assert report["plan"][0]["cached"] is True and report["plan"][1]["cached"] is False
    assert store.saved == []


def test_run_calls_saves_and_respects_cap():
    store, client = FakeStore(), FakeClient()
    report = run(store, client, cities=3, per_city=2, max_calls=4, platforms=["gemini", "google_ai_mode", "google_ai_overview"])
    assert report["calls"] == 4 and len(client.calls) == 4 and report["stopped"] == "limit zapytań"
    kind, path, params, kw = client.calls[0]
    assert (kind, path) == ("gemini", "/api/google/gemini") and params["prompt"].startswith("jakie biuro") and params["hl"] == "pl"
    assert client.calls[1][2]["q"] and client.calls[1][2]["gl"] == "pl"
    item, parsed, mentions, status, error = store.saved[0]
    assert status == "done" and mentions[0].brand_id == "b-alfa"


def test_run_hard_cap_50():
    store, client = FakeStore(), FakeClient()
    report = run(store, client, cities=3, per_city=4, max_calls=500, platforms=["gemini", "google_ai_mode", "google_ai_overview"])
    assert report["cap"] == 50 and len(client.calls) == 36  # 3 miasta x 4 pytania x 3 platformy < 50


def test_run_skips_cached_and_records_failure():
    first = build_plan(FakeStore(), FakeStore().top_cities(1), "nieruchomosci", ["gemini"], 1, 7)[0]
    store, client = FakeStore(cached={first.cache_key}), FakeClient(fail_on=1)
    report = run(store, client, cities=1, per_city=2, platforms=["gemini"])
    assert report["cache_hits"] == 1 and report["calls"] == 1  # jedno pytanie z pamięci, drugie zapytanie padło
    assert report["failed"] == 1 and store.saved[0][3] == "failed" and "HTTP 500" in store.saved[0][4]


def test_run_stops_when_unavailable():
    store, client = FakeStore(), FakeClient(unavailable_after=1)
    report = run(store, client, cities=1, per_city=2, platforms=["gemini", "google_ai_mode"])
    assert report["done"] == 1 and "brak salda" in report["stopped"]


def test_run_saves_raw(tmp_path):
    store, client = FakeStore(), FakeClient()
    report = run(store, client, cities=1, per_city=1, platforms=["gemini"], save_raw=tmp_path / "raw")
    files = list((tmp_path / "raw").glob("*.json"))
    assert len(files) == 1 and report["results"][0]["raw"] == str(files[0])
    assert json.loads(files[0].read_text(encoding="utf-8"))["response"]["text"].startswith("Polecam")


def test_run_unknown_platform():
    with pytest.raises(ValueError):
        run(FakeStore(), None, platforms=["chatgpt"], dry_run=True)


# ----------------------------------------------------------------------------- baza (jak testy db: bez Postgresa pomijane)

GEO_DIR = Path(__file__).resolve().parents[3] / "db" / "geo"


@pytest.fixture
def geo_db(db):
    for name in ("0001_core.sql", "0002_measurements.sql", "0003_worker_grants.sql"):
        db.execute((GEO_DIR / name).read_text(encoding="utf-8"))
    db.commit()
    return db


def _seed(db):
    vid = db.execute("insert into verticals (slug, name) values ('nieruchomosci', 'Nieruchomości') returning id").fetchone()["id"]
    cities = {}
    for name, slug, n in (("Katowice", "katowice", 2), ("Kraków", "krakow", 1)):
        cid = db.execute("insert into cities (name, slug) values (%s, %s) returning id", (name, slug)).fetchone()["id"]
        cities[name] = cid
        for i in range(n):
            ent = db.execute("insert into legal_entities (nip, name) values (%s, %s) returning id",
                             (f"77400{len(slug)}{i:04d}"[:10], f"Firma {slug}{i}")).fetchone()["id"]
            bid = db.execute("insert into brands (legal_entity_id, name, slug) values (%s, %s, %s) returning id",
                             (ent, f"Alfa{slug}{i} Nieruchomości", f"alfa-{slug}{i}")).fetchone()["id"]
            db.execute("insert into listings (brand_id, vertical_id, city_id, status, slug) values (%s, %s, %s, 'published', %s)",
                       (bid, vid, cid, f"a{i}"))
            db.execute("insert into domains (host, brand_id) values (%s, %s)", (f"alfa{slug}{i}.pl", bid))
    db.commit()
    return cities


def test_db_top_cities_and_known_brands(geo_db):
    cities = _seed(geo_db)
    store = GeoStore(geo_db)
    top = store.top_cities(5)
    assert [c["name"] for c in top] == ["Katowice", "Kraków"] and top[0]["listings"] == 2
    brands = store.known_brands(str(cities["Katowice"]))
    assert len(brands) == 2 and brands[0][2][0].endswith(".pl")


def test_db_save_and_cache_reuse(geo_db):
    store = GeoStore(geo_db)
    item = PlanItem("Katowice", None, "jakie biuro nieruchomości polecacie w Katowicach", "recommendation",
                    "nieruchomosci", "google_ai_mode", platform_cache_key("jakie biuro nieruchomości polecacie w Katowicach", "google_ai_mode"))
    assert store.fresh_measurement(item.cache_key, 7) is None
    parsed = Parsed("Polecam **Alfa**.", [("https://www.rankingbiurnieruchomosci.pl/k", "rankingbiurnieruchomosci.pl", "R"),
                                          ("https://x.pl/", "x.pl", None)], [])
    mentions = extract_mentions(parsed.answer_text, [], [("11111111-1111-1111-1111-111111111111", "Alfa Nieruchomości", [])])
    mid = store.save_measurement(item, parsed, mentions, status="done", error=None)
    assert store.fresh_measurement(item.cache_key, 7) == mid
    row = geo_db.execute("select * from geo.measurements where id = %s", (mid,)).fetchone()
    assert row["provider"] == "litescrape" and row["model"] is None and row["location"] == "Poland" and row["cost_usd"] is None
    assert row["status"] == "done" and row["measured_at"] is not None and len(row["answer_hash"]) == 64
    cits = geo_db.execute("select domain, is_own_portal from geo.citations where measurement_id = %s order by position", (mid,)).fetchall()
    assert [(c["domain"], c["is_own_portal"]) for c in cits] == [("rankingbiurnieruchomosci.pl", True), ("x.pl", False)]
    ments = geo_db.execute("select name, brand_id, match_method, recommended from geo.mentions where measurement_id = %s", (mid,)).fetchall()
    assert len(ments) == 1 and str(ments[0]["brand_id"]) == "11111111-1111-1111-1111-111111111111" and ments[0]["recommended"]
    # to samo pytanie drugi raz: jeden wiersz geo.prompts
    store.save_measurement(item, parsed, [], status="failed", error="HTTP 500")
    assert geo_db.execute("select count(*) as n from geo.prompts").fetchone()["n"] == 1
    # nieudany pomiar nie jest używany z pamięci
    assert store.fresh_measurement(item.cache_key, 7) == mid
    assert store.fresh_measurement(item.cache_key, 0) is None


def test_db_end_to_end_run(geo_db):
    _seed(geo_db)
    store, client = GeoStore(geo_db), FakeClient()
    report = run(store, client, cities=1, per_city=1, platforms=["gemini"])
    assert report["done"] == 1
    again = run(store, client, cities=1, per_city=1, platforms=["gemini"])
    assert again["cache_hits"] == 1 and again["calls"] == 0 and len(client.calls) == 1


def test_nazwy_miejsc_nie_daja_falszywych_dopasowan():
    from katalog_worker.geo_measure import extract_mentions

    brands = [("b1", "Warszawski Pośrednik Nieruchomości", ["warszawskiposrednik.pl"]),
              ("b2", "Nieruchomości Wilanów", ["nieruchomosciwilanow.pl"]),
              ("b3", "MAXON Nieruchomości", ["maxon.pl"])]
    text = ("Na warszawskim rynku polecane jest **Maxon**. Mieszkania na Wilanowie i w Wilanów sprzedaje wiele biur.\n"
            "Warszawski rynek jest duży.")
    found = {m.brand_id for m in extract_mentions(text, [], brands, (), ["Warszawa", "Wilanów"])}
    assert found == {"b3"}
    text2 = "Polecam Warszawski Pośrednik Nieruchomości oraz biuro Nieruchomości Wilanów."
    found2 = {m.brand_id for m in extract_mentions(text2, [], brands, (), ["Warszawa", "Wilanów"])}
    assert found2 == {"b1", "b2"}


def test_srodtytuly_nie_sa_firmami():
    from katalog_worker.geo_measure import extract_mentions

    text = ("**Wysokość prowizji**: 2-3%.\n**Umowa otwarta vs. na wyłączność** to ważny wybór.\n"
            "**Konkretny agent zamiast samej marki** liczy się bardziej.\n**Bracia Strzelczyk** to znana sieć.")
    names = [m.name for m in extract_mentions(text, [], [], ())]
    assert names == ["Bracia Strzelczyk"]


def test_linki_google_nie_sa_zrodlami():
    from katalog_worker.geo_measure import collect_citations

    data = {"references": [{"link": "https://www.google.com/searchviewer/10?svid=x", "title": "Mapa"},
                           {"link": "https://immocrm.pl/ranking", "title": "Ranking"}],
            "search_metadata": {"google_url": "https://www.google.com/search?q=x", "url": "https://maps.google.pl/x"}}
    assert [c[1] for c in collect_citations(data)] == ["immocrm.pl"]
