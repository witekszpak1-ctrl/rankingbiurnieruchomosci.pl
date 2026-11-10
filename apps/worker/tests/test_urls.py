from katalog_worker.urls import (
    canonical_url,
    is_blocklisted,
    normalize_host,
    pick_pages,
    registrable_domain,
)


def test_normalize_host():
    assert normalize_host("https://www.Przyklad.PL/abc?x=1") == "przyklad.pl"
    assert normalize_host("przyklad.pl:8080/x") == "przyklad.pl"
    assert normalize_host("https://Zażółć.pl").startswith("xn--")
    assert normalize_host("https://Zażółć.pl").endswith(".pl")


def test_registrable_domain_handles_public_suffixes():
    assert registrable_domain("https://sub.przyklad.com.pl/x") == "przyklad.com.pl"
    assert registrable_domain("https://www.biuro.waw.pl") == "biuro.waw.pl"
    assert registrable_domain("https://przyklad.pl") == "przyklad.pl"
    assert registrable_domain("localhost") == ""


def test_canonical_url_strips_tracking():
    url = "http://www.Przyklad.pl/oferta?utm_source=x&id=7&fbclid=abc#sekcja"
    assert canonical_url(url) == "https://przyklad.pl/oferta?id=7"


def test_is_blocklisted_matches_subdomains_not_lookalikes():
    blocklist = {"oferteo.pl"}
    assert is_blocklisted("https://www.oferteo.pl/firmy", blocklist)
    assert is_blocklisted("https://biura.oferteo.pl", blocklist)
    assert not is_blocklisted("https://moje-oferteo.pl", blocklist)
    assert not is_blocklisted("https://oferteo.com.pl", blocklist)


def test_pick_pages_prefers_contact_and_pricing_same_domain_only():
    links = [
        ("/kontakt", "Kontakt"),
        ("/cennik", "Cennik i prowizje"),
        ("/files/cennik-2026.pdf", "Cennik (PDF)"),
        ("/blog/poradnik", "Blog"),
        ("/logo.png", "logo"),
        ("https://inna-domena.pl/kontakt", "Kontakt partnera"),
        ("mailto:a@b.pl", "mail"),
        ("#top", "góra"),
        ("/o-nas/", "O nas"),
    ]
    pages = pick_pages(links, "https://przyklad.pl/", limit=10)
    assert pages[0] in {"https://przyklad.pl/cennik", "https://przyklad.pl/files/cennik-2026.pdf"}
    assert "https://przyklad.pl/kontakt" in pages
    assert "https://przyklad.pl/o-nas/" in pages
    assert all("inna-domena" not in p for p in pages)
    assert all(not p.endswith(".png") for p in pages)
    assert "https://przyklad.pl/blog/poradnik" not in pages


def test_registrable_domain_handles_polish_city_suffixes():
    from katalog_worker.urls import registrable_domain

    # firma pod domeną miejską to osobna strona, nie domena miejska
    assert registrable_domain("https://focus.wroc.pl/oferty") == "focus.wroc.pl"
    assert registrable_domain("https://www.firma.krakow.pl/") == "firma.krakow.pl"
    # sama domena miejska nie jest domeną firmy
    assert registrable_domain("https://wroc.pl/") == ""
    # zwykłe domeny bez zmian
    assert registrable_domain("https://www.przyklad.com.pl/") == "przyklad.com.pl"
    assert registrable_domain("https://wroclaw.wgn.pl/") == "wgn.pl"


def test_pick_legal_pages_prefers_privacy_and_skips_cookies_foreign_and_pdf():
    from katalog_worker.urls import is_legal_url, pick_legal_pages

    links = [
        ("/kontakt", "Kontakt"),
        ("/polityka-cookies", "Polityka cookies"),
        ("/regulamin", "Regulamin serwisu"),
        ("/polityka-prywatnosci", "Polityka prywatności"),
        ("https://inna-firma.pl/polityka-prywatnosci", "cudza"),
        ("/files/rodo.pdf", "RODO (PDF)"),
        ("mailto:rodo@przyklad.pl", "rodo"),
    ]
    picks = pick_legal_pages(links, "https://przyklad.pl/", limit=3)
    assert picks == ["https://przyklad.pl/polityka-prywatnosci", "https://przyklad.pl/regulamin"]
    assert is_legal_url("https://przyklad.pl/polityka-prywatnosci")
    assert not is_legal_url("https://przyklad.pl/oferta/sprzedaz-mieszkan")
    assert pick_legal_pages([("/kontakt", "Kontakt")], "https://przyklad.pl/") == []
