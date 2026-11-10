from conftest import fixture_text

from katalog_worker.extract import (
    classify_email,
    classify_social,
    decode_cfemail,
    extract_page,
    parse_pl_number,
)

URL = "https://przyklad-nieruchomosci.pl/"


def _page():
    return extract_page(fixture_text("agency_official.html"), URL)


def test_title_meta_and_text_cleaning():
    page = _page()
    assert page.title.startswith("Przykład Nieruchomości")
    assert "Pośrednictwo w sprzedaży" in page.meta_description
    assert page.og_site_name == "Przykład Nieruchomości"
    assert page.lang == "pl"
    assert "color: red" not in page.text  # style usunięty
    assert "@context" not in page.text  # JSON-LD usunięty z tekstu


def test_jsonld_organization():
    page = _page()
    assert len(page.organizations) == 1
    org = page.organizations[0]
    assert org["name"].startswith("Przykład Nieruchomości")
    assert org["address"]["postcode"] == "50-067"
    assert "RealEstateAgent" in page.jsonld_types


def test_emails_roles_and_personal():
    page = _page()
    by_addr = {e.address: e for e in page.emails}
    assert by_addr["kontakt@przyklad-nieruchomosci.pl"].kind == "role"
    assert by_addr["kontakt@przyklad-nieruchomosci.pl"].storable
    assert by_addr["jan.kowalski@przyklad-nieruchomosci.pl"].kind == "personal_like"
    assert not by_addr["jan.kowalski@przyklad-nieruchomosci.pl"].storable
    assert len(page.emails) == len(by_addr)  # bez duplikatów


def test_decode_cloudflare_email():
    hexstr = "2a4145445e4b415e6a5a58505341464b4e0744434f585f4942454745594943045a46"
    assert decode_cfemail(hexstr) == "kontakt@przyklad-nieruchomosci.pl"
    assert decode_cfemail("zz") is None
    assert decode_cfemail("2a") is None


def test_email_junk_is_dropped():
    html = '<p>logo@2x.png, test@example.com, biuro@firma.pl, biuro [at] inna.pl</p>'
    page = extract_page(html, "https://x.pl/")
    assert {e.address for e in page.emails} == {"biuro@firma.pl", "biuro@inna.pl"}


def test_classify_email_kinds():
    assert classify_email("biuro@x.pl") == "role"
    assert classify_email("anna.nowak@x.pl") == "personal_like"
    assert classify_email("agencjaabc@x.pl") == "unknown"


def test_phones_normalized_and_ids_not_mistaken():
    page = _page()
    numbers = {p.e164 for p in page.phones}
    assert numbers == {"+48711234567", "+48600700800"}


def test_socials_normalized_and_share_links_dropped():
    page = _page()
    urls = {s.url for s in page.socials}
    assert "https://facebook.com/przykladnieruchomosci" in urls
    assert "https://instagram.com/przyklad_nieruchomosci" in urls
    assert "https://linkedin.com/company/przyklad-nieruchomosci" in urls
    assert not any("sharer" in u for u in urls)
    assert len(page.socials) == len(urls)


def test_classify_social_edge_cases():
    assert classify_social("https://facebook.com/") is None
    assert classify_social("https://www.linkedin.com/feed/") is None
    assert classify_social("https://tiktok.com/@firma").network == "tiktok"
    assert classify_social("https://example.com/x") is None


def test_ids_and_postcodes():
    page = _page()
    assert {h.value for h in page.nips} == {"1234563218"}
    assert [h.value for h in page.regons] == ["123456785"]
    assert [h.value for h in page.krs] == ["0000123456"]
    assert any(h.postcode == "50-067" and h.city == "Wrocław" for h in page.postcodes)


def test_price_candidates_with_tax_hint():
    page = _page()
    assert page.price_candidates
    merged_percents = {p for c in page.price_candidates for p in c.percents}
    merged_amounts = {a for c in page.price_candidates for a in c.amounts_pln}
    assert 2.5 in merged_percents
    assert 600.0 in merged_amounts
    assert any(c.tax_hint == "plus_vat" for c in page.price_candidates)


def test_links_and_outbound_domains():
    page = _page()
    hrefs = {href for href, _ in page.links}
    assert "https://przyklad-nieruchomosci.pl/cennik" in hrefs
    assert "example.org" in page.outbound_domains
    assert "facebook.com" not in page.outbound_domains


def test_parse_pl_number():
    assert parse_pl_number("2,5") == 2.5
    assert parse_pl_number("1 200") == 1200.0
    assert parse_pl_number("1.200") == 1200.0
    assert parse_pl_number("1.200,50") == 1200.5
    assert parse_pl_number("abc") is None


def test_item_list_length():
    page = extract_page(fixture_text("directory_listing.html"), "https://katalog.example.pl/")
    assert page.item_list_len == 6
