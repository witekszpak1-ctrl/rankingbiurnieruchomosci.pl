from katalog_worker.fetch import FetchResult
from katalog_worker.offers import (
    MAX_OFFERS,
    clean_title,
    extract_offers,
    looks_like_real_estate,
    offer_index_urls,
    scan_offers,
)

NAV = """
<header><nav><ul>
  <li><a href="/">Start</a></li>
  <li><a href="/oferty/mieszkania-na-sprzedaz">Mieszkania na sprzedaż</a></li>
  <li><a href="/oferty/domy-na-sprzedaz">Domy na sprzedaż</a></li>
  <li><a href="/oferty/dzialki-na-sprzedaz">Działki na sprzedaż</a></li>
  <li><a href="/oferty/lokale-na-wynajem">Lokale na wynajem</a></li>
  <li><a href="/kontakt">Kontakt</a></li>
</ul></nav></header>
"""
FOOTER = '<footer><a href="/polityka-prywatnosci">Polityka prywatności</a><a href="/o-nas">O nas</a></footer>'


def page(body: str) -> str:
    return f"<html><body>{NAV}<main>{body}</main>{FOOTER}</body></html>"


def crm_cards(n: int) -> str:
    cards = []
    for i in range(n):
        oid = 12000 + i
        url = f"/mieszkanie-na-sprzedaz-wroclaw-krzyki-{i}-pokoje,{oid}.html"
        cards.append(f"""
        <div class="offer-item">
          <a href="{url}"><img src="/img/{oid}.jpg" alt=""></a>
          <h3><a href="{url}">Mieszkanie {i + 2}-pokojowe, Wrocław Krzyki</a></h3>
          <p class="price">450 000 zł</p>
          <a href="{url}" class="btn">Szczegóły</a>
        </div>""")
    return "".join(cards)


def test_crm_cards_with_ids_skip_nav_categories_and_generic_links():
    offers, method = extract_offers(page(crm_cards(5)), "https://biuro.pl/oferty")
    assert method == "links"
    assert [o.title for o in offers] == [f"Mieszkanie {i + 2}-pokojowe, Wrocław Krzyki" for i in range(5)]
    assert offers[0].url == "https://biuro.pl/mieszkanie-na-sprzedaz-wroclaw-krzyki-0-pokoje,12000.html"
    assert [o.position for o in offers] == list(range(5))


def test_limit_to_max_offers_in_page_order():
    offers, _ = extract_offers(page(crm_cards(30)), "https://biuro.pl/oferty")
    assert len(offers) == MAX_OFFERS
    assert offers[-1].url.endswith(f",{12000 + MAX_OFFERS - 1}.html")


def test_wordpress_property_slugs_with_card_header_inside_article():
    items = "".join(
        f"""<article class="post-{i} property type-property">
              <header class="entry-header"><h2><a href="/property/{slug}/">{title}</a></h2></header>
              <footer class="card-footer"><a href="/property/{slug}/">Zobacz ofertę</a></footer>
            </article>"""
        for i, (slug, title) in enumerate([
            ("dom-z-ogrodem-sobotka-wschodnia", "Dom z ogrodem, Sobótka"),
            ("apartament-nad-odra-stare-miasto", "Apartament nad Odrą, Stare Miasto"),
            ("dzialka-budowlana-kielczow-1200-m2", "Działka budowlana Kiełczów 1200 m2"),
            ("lokal-uzytkowy-na-wynajem-rynek", "Lokal użytkowy na wynajem, Rynek"),
        ])
    )
    offers, _ = extract_offers(page(items), "https://biuro.pl/nieruchomosci/")
    assert [o.title for o in offers][:2] == ["Dom z ogrodem, Sobótka", "Apartament nad Odrą, Stare Miasto"]
    assert len(offers) == 4
    assert offers[0].url == "https://biuro.pl/property/dom-z-ogrodem-sobotka-wschodnia/"


def test_whole_card_wrapped_in_link_uses_inner_heading():
    cards = "".join(
        f"""<a class="card" href="/oferta/{oid}">
              <img src="/x.jpg" alt="zdjęcie">
              <h4>Kawalerka {oid}, Nadodrze</h4><span>32 m²</span><span>1 pokój</span><strong>389 000 zł</strong>
            </a>"""
        for oid in (501, 502, 503)
    )
    offers, _ = extract_offers(page(cards), "https://biuro.pl/")
    assert [o.title for o in offers] == ["Kawalerka 501, Nadodrze", "Kawalerka 502, Nadodrze", "Kawalerka 503, Nadodrze"]


def test_query_id_links_and_title_from_card_heading_when_link_has_only_image():
    cards = "".join(
        f"""<div class="box"><a href="oferta.php?id={oid}"><img src="/f.jpg"></a>
              <div class="tytul">Dom wolnostojący, Długołęka {oid}</div></div>"""
        for oid in (71, 72, 73)
    )
    offers, _ = extract_offers(page(cards), "https://biuro.pl/oferty.php")
    assert [o.url for o in offers] == [f"https://biuro.pl/oferta.php?id={oid}" for oid in (71, 72, 73)]
    assert offers[0].title == "Dom wolnostojący, Długołęka 71"


def test_jsonld_item_list():
    items = ",".join(
        f'{{"@type": "ListItem", "position": {i}, "url": "https://biuro.pl/oferta/{i}", "name": "Mieszkanie {i} pokoje, Psie Pole"}}'
        for i in range(1, 5)
    )
    html = f'<html><head><script type="application/ld+json">{{"@type": "ItemList", "itemListElement": [{items}]}}</script></head><body></body></html>'
    offers, method = extract_offers(html, "https://biuro.pl/oferty")
    assert method == "jsonld"
    assert [o.url for o in offers] == [f"https://biuro.pl/oferta/{i}" for i in range(1, 5)]


def test_blog_posts_and_services_are_not_offers():
    posts = "".join(
        f"""<article class="post-{i} post type-post"><h2><a href="/{slug}/">{title}</a></h2></article>"""
        for i, (slug, title) in enumerate([
            ("jak-kupic-mieszkanie-bez-stresu", "Jak kupić mieszkanie bez stresu"),
            ("sprzedaz-domu-krok-po-kroku", "Sprzedaż domu krok po kroku"),
            ("najem-instytucjonalny-co-to-jest", "Najem instytucjonalny, co to jest"),
        ])
    )
    services = "".join(f'<a href="/uslugi/{s}">{s}</a>' for s in ("wycena-nieruchomosci", "pomoc-kredytowa", "home-staging-mieszkan"))
    assert extract_offers(page(posts + services), "https://biuro.pl/") == ([], None)


def test_offers_from_other_domains_and_contacts_in_titles_are_dropped():
    cards = "".join(
        f'<h3><a href="https://www.otodom.pl/pl/oferta/mieszkanie-{i}-ID{i}abc">Mieszkanie {i} pokoje</a></h3>' for i in range(4)
    )
    cards += "".join(
        f'<h3><a href="/oferta/dom-{i}-pietrowy-{900 + i}">Dom {i}, tel. 600 100 200</a></h3>' for i in range(4)
    )
    assert extract_offers(page(cards), "https://biuro.pl/oferty") == ([], None)


def test_clean_title_and_real_estate_words():
    assert clean_title("  Zobacz   ofertę ") is None
    assert clean_title("Mieszkanie\n  3 pokoje  ") == "Mieszkanie 3 pokoje"
    assert clean_title("x" * 300).endswith("...")
    assert looks_like_real_estate("Działka rolna 2 ha")
    assert looks_like_real_estate("/oferta/mieszkanie-na-sprzedaz-12")
    assert not looks_like_real_estate("Polityka prywatności i cookies")


def test_offer_index_urls_prefers_offer_listing():
    html = """<html><body><nav>
      <a href="/">Start</a><a href="/o-nas">O nas</a><a href="/oferta-uslug">Nasza oferta</a>
      <a href="/oferty/">Oferty</a><a href="/blog/oferty-tygodnia">Blog</a><a href="/kontakt">Kontakt</a>
      <a href="/mieszkanie-3-pokoje,12345.html">Mieszkanie 3 pokoje</a>
    </nav></body></html>"""
    urls = offer_index_urls(html, "https://biuro.pl/")
    assert urls[0] == "https://biuro.pl/oferty/"
    assert "https://biuro.pl/blog/oferty-tygodnia" not in urls


class FakeFetcher:
    def __init__(self, pages: dict[str, str]):
        self.pages = pages
        self.calls: list[str] = []

    def fetch(self, url: str) -> FetchResult:
        self.calls.append(url)
        if url in self.pages:
            return FetchResult(url, url, 200, "text/html", self.pages[url], len(self.pages[url]), True)
        return FetchResult(url, url, 404, "text/html", "", 0, True, "http_404")


HOME = '<html><body><nav><a href="/oferty">Nasze oferty</a><a href="/kontakt">Kontakt</a></nav></body></html>'


def test_scan_finds_index_from_home_and_reuses_known_index():
    fetcher = FakeFetcher({"https://biuro.pl/": HOME, "https://biuro.pl/oferty": page(crm_cards(4))})
    scan = scan_offers(fetcher, "https://biuro.pl/")
    assert scan.source_url == "https://biuro.pl/oferty" and len(scan.offers) == 4 and scan.method == "links"

    fetcher.calls.clear()
    again = scan_offers(fetcher, "https://biuro.pl/", known_index="https://biuro.pl/oferty")
    assert fetcher.calls == ["https://biuro.pl/oferty"]  # jedno pobranie dziennie, gdy strona ofert jest znana
    assert len(again.offers) == 4


def test_scan_falls_back_to_home_offers_and_reports_errors():
    home_with_offers = page(crm_cards(3)).replace("<main>", '<main><a href="/oferty">Oferty</a>')
    fetcher = FakeFetcher({"https://biuro.pl/": home_with_offers})
    scan = scan_offers(fetcher, "https://biuro.pl/")
    assert scan.source_url == "https://biuro.pl/" and len(scan.offers) == 3
    assert any("http_404" in e for e in scan.errors)

    empty = scan_offers(FakeFetcher({}), "https://biuro.pl/")
    assert empty.offers == [] and empty.source_url is None
