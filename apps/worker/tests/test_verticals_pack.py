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
