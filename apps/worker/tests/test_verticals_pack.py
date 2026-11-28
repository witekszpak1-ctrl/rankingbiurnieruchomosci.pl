"""Pakiety branż: nieruchomości (bez zmian zachowania) i biura rachunkowe (ładowanie, zapytania, prompty). Bez sieci i bazy."""

import re
from pathlib import Path

import pytest

from katalog_worker import cli
from katalog_worker.classify import DEFAULT_BLOCKLIST
from katalog_worker.pipeline import Context, city_queries, read_city_list
from katalog_worker.queries import build_queries
from katalog_worker.verticals import load_vertical, vertical_path, verticals_dir

LONG_DASHES = ("–", "—")


def _ctx(slug: str) -> Context:
    return Context(repo=None, vertical=load_vertical(slug), snapshots_dir=Path("."), queue_dir=Path("."))  # type: ignore[arg-type]


# ------------------------------------------------------------------ nieruchomości: zachowanie sprzed uogólnienia


def test_realestate_city_queries_unchanged():
    ctx = _ctx("nieruchomosci")
    assert city_queries(ctx, "Wrocław", False, {}, pages=2) == [
        "biuro nieruchomości Wrocław", "biuro nieruchomości Wrocław (strona 2)",
        "agencja nieruchomości Wrocław", "agencja nieruchomości Wrocław (strona 2)",
        "pośrednik nieruchomości Wrocław", "pośrednik nieruchomości Wrocław (strona 2)",
    ]
    deep = city_queries(ctx, "Wrocław", True, {"Wrocław": ["Krzyki"]}, pages=1)
    assert deep == [
        "biuro nieruchomości Wrocław", "biuro nieruchomości Wrocław (strona 2)", "biuro nieruchomości Wrocław (strona 3)",
        "agencja nieruchomości Wrocław", "agencja nieruchomości Wrocław (strona 2)", "agencja nieruchomości Wrocław (strona 3)",
        "pośrednik nieruchomości Wrocław", "pośrednik nieruchomości Wrocław (strona 2)",
        "pośrednik nieruchomości Wrocław (strona 3)",
        "biura nieruchomości Wrocław", "biura nieruchomości Wrocław (strona 2)", "biura nieruchomości Wrocław (strona 3)",
        "biuro nieruchomości Wrocław Krzyki",
    ]
    assert load_vertical("nieruchomosci").search.maps_label() == "biuro nieruchomości"


def test_vertical_path_follows_slug():
    assert vertical_path("rachunkowe", "cities.txt") == verticals_dir() / "rachunkowe" / "cities.txt"
    assert vertical_path("x", "a.json", base_dir=Path("/tmp/b")) == Path("/tmp/b/x/a.json")


# ------------------------------------------------------------------ biura rachunkowe


def test_rachunkowe_pack_loads():
    vertical = load_vertical("rachunkowe")
    assert vertical.slug == "rachunkowe"
    assert vertical.name == "Biura rachunkowe"
    assert vertical.domain == "TBD"
    assert vertical.registry.pkd == ["69.20.Z"]
    assert vertical.registry.expected_pkd == ["69.20.Z"]
    assert {"rachunkow", "księgow", "ksiegow", "kadry", "płace"} <= set(vertical.keywords)
    assert "biuro rachunkowe" in vertical.search.synonyms
    assert vertical.publication.min_facts >= 1
    assert sum(vertical.ranking.weights.values()) == 100
    assert {"jawnosc_cennika", "uprawnienia", "ubezpieczenie_oc", "opinie_google"} <= set(vertical.ranking.weights)
    services = [s["name"] for s in vertical.pricing["services"]]
    assert "abonament miesięczny KPiR" in services
    allowed_units = {"percent", "pln", "pln_per_month", "other"}  # check w db/migrations/0001_init.sql
    assert {s["unit"] for s in vertical.pricing["services"]} <= allowed_units


def test_rachunkowe_queries_for_one_city_without_network():
    vertical = load_vertical("rachunkowe")
    queries = build_queries(vertical.search, "Wrocław")
    assert "biuro rachunkowe Wrocław" in queries
    assert "pełna księgowość Wrocław" in queries
    assert "kancelaria podatkowa Wrocław" in queries
    assert len(queries) == len({q.casefold() for q in queries})
    assert len(queries) <= vertical.search.max_queries_per_city
    assert all("Wrocław" in q for q in queries)
    assert not any("nieruchomo" in q for q in queries)


def test_rachunkowe_city_queries_use_pack_phrases():
    ctx = _ctx("rachunkowe")
    assert city_queries(ctx, "Opole", False, {}, pages=2) == [
        "biuro rachunkowe Opole", "biuro rachunkowe Opole (strona 2)",
        "księgowa Opole", "księgowa Opole (strona 2)",
        "usługi księgowe Opole", "usługi księgowe Opole (strona 2)",
    ]
    deep = city_queries(ctx, "Opole", True, {"Opole": ["Zaodrze"]}, pages=1)
    assert deep[0] == "biuro rachunkowe Opole"
    assert "księgowość dla firm Opole (strona 3)" in deep
    assert len(deep) == 4 * 3  # cztery frazy po trzy strony, bez fraz na dzielnice
    assert not any("Zaodrze" in q for q in deep)
    assert ctx.vertical.search.maps_label() == "biuro rachunkowe"


def test_generic_defaults_when_pack_has_no_phrases(tmp_path):
    folder = tmp_path / "test"
    folder.mkdir()
    (folder / "vertical.yaml").write_text(
        "slug: test\nname: Test\nkeywords: [x]\nsearch:\n  synonyms: [a, b, c, d]\n  templates: ['{synonym} {city}']\n",
        encoding="utf-8",
    )
    search = load_vertical("test", base_dir=tmp_path).search
    assert search.core_phrases() == ["a {city}", "b {city}", "c {city}"]
    assert search.deep_core_phrases() == search.core_phrases()
    assert search.maps_label() == "a"


def test_rachunkowe_cities_match_realestate_order():
    assert read_city_list(vertical_path("rachunkowe", "cities.txt")) == read_city_list(
        vertical_path("nieruchomosci", "cities.txt")
    )


def test_rachunkowe_prompts_present_and_clean():
    folder = verticals_dir() / "rachunkowe" / "prompts"
    for name in ("describe.md", "classify.md", "daily.md", "candidates.md"):
        text = (folder / name).read_text(encoding="utf-8")
        assert not any(d in text for d in LONG_DASHES), name
        assert "nieruchomo" not in text.replace("rankingbiurnieruchomosci.pl", "").lower(), name  # nazwa repozytorium wolno
    for path in (verticals_dir() / "rachunkowe").rglob("*"):
        if path.is_file() and path.suffix in {".md", ".yaml", ".txt"}:
            assert not any(d in path.read_text(encoding="utf-8") for d in LONG_DASHES), path


def test_rachunkowe_describe_prompt_keeps_validator_schema():
    text = (verticals_dir() / "rachunkowe" / "prompts" / "describe.md").read_text(encoding="utf-8")
    original = (verticals_dir() / "nieruchomosci" / "prompts" / "describe.md").read_text(encoding="utf-8")
    for key in ("schema_version", "bundle_sha256", "claims", "fact_ids", "candidate_id", "tax_mode"):
        assert key in text
    # ten sam kształt przykładowego wyniku co w pakiecie nieruchomości
    block = lambda t: re.search(r"```json\n(.*?)```", t, re.S).group(1)  # noqa: E731
    import json

    assert set(json.loads(block(text))) == set(json.loads(block(original)))
    classify = (verticals_dir() / "rachunkowe" / "prompts" / "classify.md").read_text(encoding="utf-8")
    assert '"label": "official"' in classify and "evidence_quote" in classify


def test_rachunkowe_blocklist_extends_default():
    vertical = load_vertical("rachunkowe")
    merged = {**DEFAULT_BLOCKLIST, **vertical.blocklist}
    assert merged["infakt.pl"] == "marketplace"
    assert "oferteo.pl" in merged
    assert load_vertical("nieruchomosci").blocklist == {}


def test_cli_context_merges_vertical_blocklist(monkeypatch):
    class Args:
        vertical = "rachunkowe"

    monkeypatch.setattr("katalog_worker.repo.Repo", lambda conn: None)
    ctx, _ = cli._context(Args(), conn=None)
    assert ctx.blocklist["wfirma.pl"] == "marketplace"
    assert ctx.blocklist["otodom.pl"] == "marketplace"
    assert ctx.vertical.slug == "rachunkowe"


def test_golden_readme_does_not_ship_fabricated_data():
    folder = verticals_dir() / "rachunkowe" / "golden"
    assert (folder / "README.md").exists()
    assert not (folder / "domains.csv").exists()
    assert not (folder / "entities.csv").exists()


@pytest.mark.parametrize("slug", ["nieruchomosci", "rachunkowe"])
def test_every_pack_has_required_files(slug):
    base = verticals_dir() / slug
    for name in ("vertical.yaml", "cities.txt", "prompts/describe.md", "prompts/classify.md", "prompts/daily.md",
                 "prompts/candidates.md"):
        assert (base / name).exists(), name


# ------------------------------------------------------------------ branże 3-8 (portale: oze, remonty, budowlane, warsztaty, przeprowadzki, weterynarze)

NEW_PACKS = {
    # slug: (kody PKD, fraza miasta, fraza Map Google, czy pakiet ma frazy na dzielnice)
    "oze": (["43.21.Z", "43.22.Z"], "fotowoltaika Wrocław", "fotowoltaika pompy ciepła klimatyzacja", False),
    "remonty": (["43.31.Z", "43.32.Z", "43.33.Z", "43.34.Z", "43.39.Z"], "firma remontowa Wrocław", "firma remontowa", False),
    "budowlane": (["41.20.Z"], "firma budowlana Wrocław", "firma budowlana", False),
    "warsztaty": (["45.20.Z"], "warsztat samochodowy Wrocław", "warsztat samochodowy", True),
    "przeprowadzki": (["49.42.Z"], "firma przeprowadzkowa Wrocław", "firma przeprowadzkowa", False),
    "weterynarze": (["75.00.Z"], "klinika weterynaryjna Wrocław", "klinika weterynaryjna", True),
}
UNITS = {"percent", "pln", "pln_per_month", "other"}  # check w db/migrations/0001_init.sql
FORBIDDEN_IN_PACKS = ("nieruchomo",)


@pytest.mark.parametrize("slug", sorted(NEW_PACKS))
def test_new_pack_loads(slug):
    pkd, _, _, _ = NEW_PACKS[slug]
    vertical = load_vertical(slug)
    assert vertical.slug == slug
    assert vertical.domain == "TBD"
    assert vertical.registry.pkd == pkd
    assert vertical.registry.expected_pkd == pkd
    assert vertical.keywords and all(k == k.lower() for k in vertical.keywords)
    assert vertical.publication.min_facts >= 1
    assert sum(vertical.ranking.weights.values()) == 100
    assert {"jawnosc_cennika", "opinie_google", "spojnosc_danych", "czas_reakcji"} <= set(vertical.ranking.weights)
    # płatność nie może wpływać na wynik: żaden parametr nie odnosi się do płatnych pozycji
    assert not any(w in name for name in vertical.ranking.weights for w in ("premium", "platn", "reklam"))
    services = vertical.pricing["services"]
    assert len(services) >= 5
    assert {s["unit"] for s in services} <= UNITS
    assert all(s["name"] for s in services)
    # blocklista zawiera typowe portale usługowe i tylko dopuszczalne etykiety
    merged = {**DEFAULT_BLOCKLIST, **vertical.blocklist}
    assert {"oferteo.pl", "fixly.pl", "zumi.pl", "panoramafirm.pl", "pkt.pl"} <= set(vertical.blocklist)
    assert set(merged.values()) <= {"directory", "marketplace", "media", "irrelevant"}


@pytest.mark.parametrize("slug", sorted(NEW_PACKS))
def test_new_pack_queries_for_one_city_without_network(slug):
    _, city_phrase, maps, districts = NEW_PACKS[slug]
    vertical = load_vertical(slug)
    queries = build_queries(vertical.search, "Wrocław")
    assert city_phrase in queries
    assert len(queries) == len({q.casefold() for q in queries})
    assert len(queries) <= vertical.search.max_queries_per_city
    assert all("Wrocław" in q for q in queries)
    assert not any("nieruchomo" in q for q in queries)

    ctx = _ctx(slug)
    base = city_queries(ctx, "Wrocław", False, {}, pages=2)
    assert len(base) == 3 * 2 and base[0] == city_phrase and base[1].endswith("(strona 2)")
    deep = city_queries(ctx, "Wrocław", True, {"Wrocław": ["Krzyki", "Psie Pole"]}, pages=1)
    main = 4 * 3  # cztery frazy po trzy strony przy pages=1 (dwie strony więcej na główne frazy)
    if districts:
        assert len(deep) == main + 2 and deep[-1].endswith("Psie Pole")
        assert vertical.search.district_phrase and "{district}" in vertical.search.district_phrase
        assert (verticals_dir() / slug / "districts.json").exists()
    else:
        assert len(deep) == main and vertical.search.district_phrase is None
    assert ctx.vertical.search.maps_label() == maps


@pytest.mark.parametrize("slug", sorted(NEW_PACKS))
def test_new_pack_files_prompts_and_schema(slug):
    import json

    base = verticals_dir() / slug
    for name in ("vertical.yaml", "cities.txt", "prompts/describe.md", "prompts/classify.md", "prompts/daily.md",
                 "prompts/candidates.md", "golden/README.md"):
        assert (base / name).exists(), name
    assert read_city_list(base / "cities.txt") == read_city_list(vertical_path("nieruchomosci", "cities.txt"))
    for path in base.rglob("*"):
        if path.is_file():
            text = path.read_text(encoding="utf-8")
            assert not any(d in text for d in LONG_DASHES), path
            if path.suffix in {".md", ".yaml"}:
                assert not any(w in text.replace("rankingbiurnieruchomosci.pl", "").lower() for w in FORBIDDEN_IN_PACKS), path
    describe = (base / "prompts" / "describe.md").read_text(encoding="utf-8")
    original = (verticals_dir() / "nieruchomosci" / "prompts" / "describe.md").read_text(encoding="utf-8")
    block = lambda t: re.search(r"```json\n(.*?)```", t, re.S).group(1)  # noqa: E731
    assert set(json.loads(block(describe))) == set(json.loads(block(original)))
    for key in ("schema_version", "bundle_sha256", "claims", "fact_ids", "candidate_id", "tax_mode"):
        assert key in describe
    assert f"queue/results/{slug}/describe/" in describe
    classify = (base / "prompts" / "classify.md").read_text(encoding="utf-8")
    assert '"label": "official"' in classify and "evidence_quote" in classify
    # zestaw wzorcowy nie zawiera wymyślonych danych
    assert not (base / "golden" / "domains.csv").exists()
    assert not (base / "golden" / "entities.csv").exists()


def test_veterinary_pack_marks_regulated_profession_and_does_not_rate_treatment():
    base = verticals_dir() / "weterynarze"
    describe = (base / "prompts" / "describe.md").read_text(encoding="utf-8")
    classify = (base / "prompts" / "classify.md").read_text(encoding="utf-8")
    assert "zawód regulowany" in describe and "zawód regulowany" in classify.lower()
    assert "Nie oceniasz jakości leczenia" in describe
    # żaden parametr rankingu nie ocenia skuteczności leczenia
    weights = load_vertical("weterynarze").ranking.weights
    assert not any(w in name for name in weights for w in ("skutecz", "jakosc_leczenia", "wyleczen"))


def test_workshops_pack_documents_missing_website_gap():
    # warsztaty często nie mają strony: pakiet ma niższy próg faktów i dzielnice, a luka jest opisana w yaml-u
    vertical = load_vertical("warsztaty")
    assert vertical.publication.min_facts == 5
    text = (verticals_dir() / "warsztaty" / "vertical.yaml").read_text(encoding="utf-8")
    assert "bez strony" in text
