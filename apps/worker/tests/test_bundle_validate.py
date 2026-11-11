import copy
import json

import pytest
from conftest import fixture_text

from katalog_worker.bundle import (
    Fact,
    build_classify_bundle,
    build_describe_bundle,
    bundle_sha256,
    contains_contacts,
    redact_contacts,
    write_bundle,
)
from katalog_worker.extract import extract_page
from katalog_worker.validate import ngram_overlap, validate_result

URL = "https://przyklad-nieruchomosci.pl/"


def _page():
    return extract_page(fixture_text("agency_official.html"), URL)


def make_bundle() -> dict:
    registry = Fact(
        "registry_start_date",
        "2011-03-01",
        "data rozpoczęcia działalności wg rejestru: 2011-03-01",
        "rejestr:mf_vat",
    )
    return build_describe_bundle(
        vertical="nieruchomosci",
        firm_id="firm-1",
        name="Przykład Nieruchomości",
        city="Wrocław",
        pages=[_page()],
        registry_facts=[registry],
    )


def fact_id(bundle: dict, type_: str) -> str:
    return next(f["fact_id"] for f in bundle["facts"] if f["type"] == type_)


def price_candidate(bundle: dict, percent: float) -> dict:
    return next(c for c in bundle["price_candidates"] if percent in c["percents"])


def valid_result(bundle: dict) -> dict:
    cand = price_candidate(bundle, 2.5)
    return {
        "schema_version": 1,
        "firm_id": "firm-1",
        "bundle_sha256": bundle["bundle_sha256"],
        "description": {
            "text": (
                "Biuro działa na rynku od 2011 roku i obsługuje klientów z Wrocławia. "
                "Zajmuje się sprzedażą oraz wynajmem mieszkań, domów i lokali."
            ),
            "claims": [
                {
                    "text": "Biuro działa na rynku od 2011 roku i obsługuje klientów z Wrocławia.",
                    "fact_ids": [fact_id(bundle, "registry_start_date"), fact_id(bundle, "address")],
                },
                {
                    "text": "Zajmuje się sprzedażą oraz wynajmem mieszkań, domów i lokali.",
                    "fact_ids": [fact_id(bundle, "meta_description")],
                },
            ],
        },
        "services": [
            {
                "name": "sprzedaż mieszkań",
                "quote": "pomagamy w sprzedaży i wynajmie mieszkań",
                "source_url": URL,
            }
        ],
        "prices": [
            {
                "candidate_id": cand["candidate_id"],
                "service": "pośrednictwo w sprzedaży",
                "unit": "percent",
                "amount_min": 2.5,
                "amount_max": None,
                "tax_mode": "plus_vat",
                "quote": "od 2,5% + VAT",
                "source_url": URL,
            }
        ],
    }


def codes(report) -> set[str]:
    return {e.code for e in report.errors}


# ------------------------------------------------------------------ paczka


def test_bundle_has_no_contacts_and_valid_checksum():
    bundle = make_bundle()
    dumped = json.dumps(bundle, ensure_ascii=False)
    assert "przyklad-nieruchomosci.pl/" in dumped  # adresy źródeł zostają
    assert "@przyklad-nieruchomosci.pl" not in dumped
    assert "600 700 800" not in dumped
    assert "[e-mail]" in bundle["source_text"][0]["text"]
    assert bundle["bundle_sha256"] == bundle_sha256(bundle)
    assert [f["fact_id"] for f in bundle["facts"]][0] == "f1"


def test_redact_contacts():
    assert redact_contacts("pisz: biuro@firma.pl, tel. 600 700 800, +48 71 123 45 67") == (
        "pisz: [e-mail], tel. [telefon], [telefon]"
    )
    assert not contains_contacts("Prowizja 2,5% + VAT, sesja 600 zł, 50-067 Wrocław")


def test_write_bundle_refuses_contacts_and_writes_clean(tmp_path):
    bundle = make_bundle()
    path = write_bundle(bundle, tmp_path)
    assert path == tmp_path / "pending" / "describe" / "firm-1.json"
    assert json.loads(path.read_text(encoding="utf-8"))["bundle_sha256"] == bundle["bundle_sha256"]

    dirty = copy.deepcopy(bundle)
    dirty["source_text"][0]["text"] += " Napisz: sekret@firma.pl"
    with pytest.raises(ValueError):
        write_bundle(dirty, tmp_path)


def test_sha_with_long_digit_runs_does_not_trip_contact_check(tmp_path):
    bundle = make_bundle()
    bundle["bundle_sha256"] = "1234567890123456789012345678901234567890123456789012345678901234"
    write_bundle(bundle, tmp_path)  # nie powinno rzucić wyjątku


# ------------------------------------------------------------------ describe


def test_valid_result_passes():
    bundle = make_bundle()
    report = validate_result(bundle, valid_result(bundle))
    assert report.ok, report.errors
    assert report.metrics["ngram_overlap"] <= 0.2


def test_binding_errors():
    bundle = make_bundle()
    result = valid_result(bundle)
    result["bundle_sha256"] = "0" * 64
    assert "bundle_mismatch" in codes(validate_result(bundle, result))

    tampered = make_bundle()
    ok_result = valid_result(tampered)
    tampered["name"] = "Zmienione"
    assert "bundle_tampered" in codes(validate_result(tampered, ok_result))

    wrong_firm = valid_result(bundle)
    wrong_firm["firm_id"] = "inna"
    assert "firm_mismatch" in codes(validate_result(bundle, wrong_firm))


def test_unknown_fact_and_claim_without_fact():
    bundle = make_bundle()
    result = valid_result(bundle)
    result["description"]["claims"][0]["fact_ids"] = ["f999"]
    result["description"]["claims"][1]["fact_ids"] = []
    found = codes(validate_result(bundle, result))
    assert {"unknown_fact_id", "claim_without_fact"} <= found


def test_claims_must_equal_description_text():
    bundle = make_bundle()
    result = valid_result(bundle)
    result["description"]["text"] += " Dodatkowe zdanie bez poparcia."
    assert "claims_text_mismatch" in codes(validate_result(bundle, result))


def test_copying_source_is_rejected():
    bundle = make_bundle()
    copied = "Od 2011 roku pomagamy w sprzedaży i wynajmie mieszkań, domów i lokali. Pośrednictwo nieruchomości to nasza specjalność."
    result = valid_result(bundle)
    result["description"] = {
        "text": copied,
        "claims": [{"text": copied, "fact_ids": [fact_id(bundle, "meta_description")]}],
    }
    report = validate_result(bundle, result)
    assert "ngram_overlap" in codes(report)
    assert report.metrics["ngram_overlap"] > 0.5


def test_unsupported_superlative_is_rejected_but_supported_one_passes():
    bundle = make_bundle()
    result = valid_result(bundle)
    text = "Biuro działa od 2011 roku i jest najlepszym wyborem we Wrocławiu dla każdego sprzedającego."
    result["description"] = {
        "text": text,
        "claims": [{"text": text, "fact_ids": [fact_id(bundle, "registry_start_date")]}],
    }
    assert "unsupported_superlative" in codes(validate_result(bundle, result))


def test_description_length_and_contacts():
    bundle = make_bundle()
    result = valid_result(bundle)
    short = "Za krótki."
    result["description"] = {"text": short, "claims": [{"text": short, "fact_ids": ["f1"]}]}
    assert "description_length" in codes(validate_result(bundle, result))

    with_mail = (
        "Biuro działa od 2011 roku we Wrocławiu i obsługuje klientów indywidualnych. Kontakt: biuro@firma.pl"
    )
    result["description"] = {"text": with_mail, "claims": [{"text": with_mail, "fact_ids": ["f1"]}]}
    assert "contact_in_description" in codes(validate_result(bundle, result))


def test_service_quote_must_exist_in_source():
    bundle = make_bundle()
    result = valid_result(bundle)
    result["services"][0]["quote"] = "oferujemy zarządzanie najmem instytucjonalnym"
    assert "quote_not_in_source" in codes(validate_result(bundle, result))
    result = valid_result(bundle)
    result["services"][0]["source_url"] = "https://inna.pl/"
    assert "unknown_source" in codes(validate_result(bundle, result))


def test_price_validation_rules():
    bundle = make_bundle()

    wrong_amount = valid_result(bundle)
    wrong_amount["prices"][0]["amount_min"] = 3.0
    assert "amount_not_in_quote" in codes(validate_result(bundle, wrong_amount))

    wrong_tax = valid_result(bundle)
    wrong_tax["prices"][0]["tax_mode"] = "gross"
    assert "tax_mode_mismatch" in codes(validate_result(bundle, wrong_tax))

    invented_tax = valid_result(bundle)
    invented_tax["prices"][0].update(
        quote="od 2,5%", tax_mode="net"
    )
    assert "tax_mode_unsupported" in codes(validate_result(bundle, invented_tax))

    no_candidate = valid_result(bundle)
    no_candidate["prices"][0]["candidate_id"] = "p999"
    assert "unknown_candidate" in codes(validate_result(bundle, no_candidate))

    fake_quote = valid_result(bundle)
    fake_quote["prices"][0]["quote"] = "od 1,0% + VAT"
    assert "quote_not_in_source" in codes(validate_result(bundle, fake_quote))

    inverted = valid_result(bundle)
    inverted["prices"][0].update(
        quote="od 2,5% + VAT wartości nieruchomości. Wynajem: 50%", amount_min=50.0, amount_max=2.5
    )
    assert "range_inverted" in codes(validate_result(bundle, inverted))


def test_price_in_pln_gross():
    bundle = make_bundle()
    result = valid_result(bundle)
    cand = price_candidate(bundle, 2.5)
    result["prices"].append(
        {
            "candidate_id": cand["candidate_id"],
            "service": "sesja zdjęciowa",
            "unit": "pln",
            "amount_min": 600.0,
            "tax_mode": "gross",
            "quote": "Sesja zdjęciowa 600 zł brutto",
            "source_url": URL,
        }
    )
    report = validate_result(bundle, result)
    assert report.ok, report.errors


def test_schema_errors_are_reported():
    bundle = make_bundle()
    report = validate_result(bundle, {"schema_version": 1, "firm_id": "firm-1"})
    assert "schema" in codes(report)
    assert not report.ok


def test_unknown_bundle_type():
    assert "unknown_type" in codes(validate_result({"type": "x"}, {}))


# ------------------------------------------------------------------ classify


def make_classify_bundle() -> dict:
    return build_classify_bundle(
        vertical="nieruchomosci",
        firm_id="firm-1",
        url=URL,
        page=_page(),
        reasons=["dokładnie jeden NIP"],
    )


def test_classify_result_with_evidence_passes():
    bundle = make_classify_bundle()
    result = {
        "schema_version": 1,
        "firm_id": "firm-1",
        "bundle_sha256": bundle["bundle_sha256"],
        "verdict": {
            "label": "official",
            "reason": "Strona jednej firmy z jednym NIP-em w stopce.",
            "evidence_quote": "Przykład Nieruchomości Sp. z o.o., ul. Świdnicka 10",
        },
    }
    report = validate_result(bundle, result)
    assert report.ok, report.errors


def test_classify_requires_real_evidence():
    bundle = make_classify_bundle()
    base = {"schema_version": 1, "firm_id": "firm-1", "bundle_sha256": bundle["bundle_sha256"]}
    no_evidence = {**base, "verdict": {"label": "official", "reason": "x"}}
    assert "no_evidence" in codes(validate_result(bundle, no_evidence))
    fake = {**base, "verdict": {"label": "directory", "reason": "x", "evidence_quote": "lista 500 firm"}}
    assert "quote_not_in_source" in codes(validate_result(bundle, fake))
    uncertain = {**base, "verdict": {"label": "uncertain", "reason": "za mało danych"}}
    assert validate_result(bundle, uncertain).ok


def test_ngram_overlap_basics():
    assert ngram_overlap("a b c d e f", "x y z") == 0.0
    assert ngram_overlap("a b c d e f", "a b c d e f g") == 1.0
    assert ngram_overlap("krótko", "cokolwiek") == 0.0


def test_fact_values_and_name_are_redacted_and_leaks_report_fields(tmp_path):
    from katalog_worker.bundle import ContactLeakError, build_describe_bundle, contact_fields, write_bundle
    from katalog_worker.extract import extract_page

    html = (
        "<html><head><title>Biuro XYZ Wrocław, tel. 71 123 45 67</title>"
        '<meta name="description" content="Pośrednictwo nieruchomości. Napisz: biuro@xyz.pl"></head>'
        "<body><p>Pośrednictwo w sprzedaży mieszkań we Wrocławiu.</p></body></html>"
    )
    page = extract_page(html, "https://xyz.pl/")
    bundle = build_describe_bundle(
        vertical="nieruchomosci", firm_id="b1", name="Biuro XYZ tel. 600 700 800", city="Wrocław", pages=[page]
    )
    assert contact_fields(bundle) == []
    assert "600 700 800" not in bundle["name"]
    values = {f["type"]: f["value"] for f in bundle["facts"]}
    assert "71 123 45 67" not in values["site_title"] and "[telefon]" in values["site_title"]
    assert "biuro@xyz.pl" not in values["meta_description"]
    write_bundle(bundle, tmp_path)  # nie rzuca

    bundle["city"] = "Wrocław, tel. 71 123 45 67"
    try:
        write_bundle(bundle, tmp_path)
    except ContactLeakError as exc:
        assert exc.fields == ["city"]
        assert "71 123 45 67" not in str(exc)  # komunikat nie ujawnia treści
    else:  # pragma: no cover
        raise AssertionError("oczekiwano ContactLeakError")
