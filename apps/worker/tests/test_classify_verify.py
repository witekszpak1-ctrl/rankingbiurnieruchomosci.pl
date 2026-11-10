from conftest import fixture_text

from katalog_worker.classify import Classification, classify_page
from katalog_worker.extract import PageExtraction, extract_page
from katalog_worker.verify import (
    RegistryView,
    name_in_text,
    name_similarity,
    normalize_name,
    verify_domain,
)

KEYWORDS = ("nieruchomo", "pośredni", "posredni")
OFFICIAL_URL = "https://przyklad-nieruchomosci.pl/"


def _official():
    return extract_page(fixture_text("agency_official.html"), OFFICIAL_URL)


def _registry(**overrides) -> RegistryView:
    base = dict(
        nip="1234563218",
        name="PRZYKŁAD NIERUCHOMOŚCI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ",
        active=True,
        postcode="50-067",
        city="WROCŁAW",
        pkd_codes=["68.31.Z"],
    )
    base.update(overrides)
    return RegistryView(**base)


# ------------------------------------------------------------------ klasyfikator


def test_official_site_is_official():
    result = classify_page(_official(), KEYWORDS)
    assert result.label == "official"
    assert result.confidence > 0.5


def test_directory_listing_is_directory():
    page = extract_page(fixture_text("directory_listing.html"), "https://katalog.example.pl/firmy/wroclaw")
    result = classify_page(page, KEYWORDS)
    assert result.label == "directory"
    assert any("NIP" in r for r in result.reasons)


def test_article_is_media():
    page = extract_page(fixture_text("article_ranking.html"), "https://portal.example.pl/ranking")
    assert classify_page(page, KEYWORDS).label == "media"


def test_parked_domain():
    page = extract_page(fixture_text("parked.html"), "https://przyklad-nieruchomosci.com/")
    assert classify_page(page, KEYWORDS).label == "parked"


def test_blocklist_wins_regardless_of_content():
    page = PageExtraction(url="https://www.oferteo.pl/biura", text="biuro nieruchomości")
    result = classify_page(page, KEYWORDS)
    assert (result.label, result.confidence) == ("directory", 1.0)
    social = PageExtraction(url="https://www.facebook.com/firma")
    assert classify_page(social, KEYWORDS).label == "irrelevant"


def test_irrelevant_without_vertical_keywords():
    html = "<html><head><title>Hurtownia opon</title></head><body><p>Opony letnie i zimowe. Tel. 600 100 200</p></body></html>"
    page = extract_page(html, "https://opony.example.pl/")
    assert classify_page(page, KEYWORDS).label == "irrelevant"


def test_sparse_page_is_uncertain_not_official():
    html = "<html><head><title>Nieruchomości</title></head><body><p>Nieruchomości. Pośrednictwo.</p></body></html>"
    page = extract_page(html, "https://x.example.pl/")
    assert classify_page(page, KEYWORDS).label == "uncertain"


# ------------------------------------------------------------------ nazwy


def test_normalize_name_drops_legal_forms_and_diacritics():
    assert normalize_name("PRZYKŁAD NIERUCHOMOŚCI SP. Z O.O.") == "przyklad nieruchomosci"
    assert normalize_name("Biuro Łódź S.A.") == "biuro lodz"


def test_name_similarity_and_text_match():
    assert name_similarity("Przykład Nieruchomości Sp. z o.o.", "PRZYKŁAD NIERUCHOMOŚCI SPÓŁKA Z O.O.") == 1.0
    assert name_similarity("Zupełnie Inna Firma", "Przykład Nieruchomości") < 0.4
    assert name_in_text("KOWALSKI JAN", "Biuro prowadzi Jan Kowalski od 2010 roku")
    assert not name_in_text("KOWALSKI JAN", "Biuro prowadzi Anna Nowak")
    assert not name_in_text("KOWALSKI", "Kowalski")  # jeden człon to za mało


# ------------------------------------------------------------------ weryfikacja


def test_verified_when_nip_matches_registry():
    classification = classify_page(_official(), KEYWORDS)
    result = verify_domain(_registry(), [_official()], classification, KEYWORDS, ("68.31.Z",))
    assert result.status == "verified"
    assert result.matched_nip == "1234563218"
    assert result.score >= 75


def test_nip_mismatch_is_never_verified():
    classification = classify_page(_official(), KEYWORDS)
    registry = _registry(nip="7740001454", name="Zupełnie Inna Firma", postcode="00-001", city="WARSZAWA")
    result = verify_domain(registry, [_official()], classification, KEYWORDS)
    assert result.status != "verified"
    assert result.matched_nip is None


def test_inactive_registry_entity_is_rejected():
    classification = classify_page(_official(), KEYWORDS)
    result = verify_domain(_registry(active=False), [_official()], classification, KEYWORDS)
    assert result.status == "rejected"


def test_without_registry_data_nip_makes_candidate():
    classification = classify_page(_official(), KEYWORDS)
    result = verify_domain(None, [_official()], classification, KEYWORDS)
    assert result.status == "candidate"


def test_without_registry_and_nip_needs_review():
    html = "<html><head><title>Biuro</title></head><body><p>Pośrednictwo nieruchomości. Tel. 600 100 200</p></body></html>"
    page = extract_page(html, "https://x.example.pl/")
    result = verify_domain(None, [page], Classification("uncertain", 0.5), KEYWORDS)
    assert result.status == "needs_review"


def test_directory_classification_is_rejected():
    result = verify_domain(_registry(), [_official()], Classification("directory", 1.0), KEYWORDS)
    assert result.status == "rejected"


def test_many_nips_on_site_is_rejected():
    page = extract_page(fixture_text("directory_listing.html"), "https://katalog.example.pl/")
    result = verify_domain(_registry(), [page], Classification("uncertain", 0.5), KEYWORDS)
    assert result.status == "rejected"
