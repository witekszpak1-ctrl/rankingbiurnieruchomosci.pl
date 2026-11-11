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


def test_counted_category_links_are_not_offers():
    cats = "".join(
        f'<div class="city"><a href="/nieruchomosci/biura-wynajem-{c}/">{c.title()} {n} ofert</a></div>'
        for c, n in (("warszawa", 2516), ("wroclaw", 567), ("krakow", 812), ("gdansk", 301))
    )
    assert extract_offers(page(cats), "https://biuro.pl/nieruchomosci/") == ([], None)


def test_articles_without_property_type_are_not_offers():
    articles = "".join(
        f'<div class="box"><h3><a href="/{slug}.html">{title}</a></h3></div>'
        for slug, title in (
            ("gdzie-reklamowac-nieruchomosci", "Gdzie reklamować nieruchomości?"),
            ("zarzadzanie-najmem-wroclaw", "Zarządzanie najmem we Wrocławiu"),
            ("sprzedaz-nieruchomosci-krok-po-kroku", "Sprzedaż nieruchomości krok po kroku"),
        )
    )
    assert extract_offers(page(articles), "https://biuro.pl/") == ([], None)


def test_url_variants_of_one_offer_are_merged():
    cards = "".join(
        f"""<div class="inv"><a href="/inwestycja-wroclaw-{n},{oid}"><h3>Mieszkanie {n}, Psie Pole</h3></a>
              <a href="/inwestycja-wroclaw-{n},{oid},jump=1">Kup teraz</a></div>"""
        for n, oid in (("a", 8983), ("b", 8984), ("c", 8985))
    )
    offers, _ = extract_offers(page(cards), "https://biuro.pl/")
    assert [o.url for o in offers] == [f"https://biuro.pl/inwestycja-wroclaw-{n},{oid}" for n, oid in (("a", 8983), ("b", 8984), ("c", 8985))]
    assert offers[0].title == "Mieszkanie a, Psie Pole"


def test_index_urls_skip_single_offers_and_sorted_duplicates():
    html = """<html><body>
      <a href="/nieruchomosci/5809-4112-ods/">Dom na sprzedaż Dobrzykowice</a>
      <a href="/oferty?sort=dd">Oferty od najnowszych</a>
      <a href="/nieruchomosci/">Nieruchomości</a>
    </body></html>"""
    assert offer_index_urls(html, "https://biuro.pl/") == ["https://biuro.pl/nieruchomosci/"]


def test_scan_reports_link_groups_for_pages_without_offers():
    fetcher = FakeFetcher({"https://biuro.pl/": HOME, "https://biuro.pl/oferty": "<html><body><p>Ładowanie...</p></body></html>"})
    scan = scan_offers(fetcher, "https://biuro.pl/")
    assert scan.offers == []
    assert scan.diagnostics["https://biuro.pl/oferty"][0]["anchors"] == 0


def test_offer_slug_as_first_path_segment_is_grouped():
    cards = "".join(
        f"""<div class="item"><a href="/{slug}/{oid}"><img src="/a.jpg"></a>
              <div class="item-title">{title}</div><span>{oid} zł</span></div>"""
        for slug, oid, title in (
            ("dzialki-na-sprzedaz-1200m2-dlugoleka-pasikurowice-350000zl", "ag-9101", "Działka, Długołęka Pasikurowice"),
            ("mieszkania-na-sprzedaz-48m2-wroclaw-krzyki-620000zl", "ag-9102", "Mieszkanie, Wrocław Krzyki"),
            ("domy-na-sprzedaz-160m2-wolow-990000zl", "ag-9103", "Dom, Wołów"),
        )
    )
    offers, _ = extract_offers(page(cards), "https://biuro.pl/oferty")
    assert [o.title for o in offers] == ["Działka, Długołęka Pasikurowice", "Mieszkanie, Wrocław Krzyki", "Dom, Wołów"]


def test_index_urls_add_unfiltered_list_first():
    html = '<html><body><a href="/oferty?typ=dzialki">Działki</a><a href="/oferty?typ=domy">Domy na sprzedaż</a></body></html>'
    assert offer_index_urls(html, "https://biuro.pl/")[0] == "https://biuro.pl/oferty"


def test_scan_picks_list_with_most_offers():
    home = '<html><body><a href="/oferty/domy">Oferty domy</a><a href="/oferty/mieszkania">Oferty mieszkania</a></body></html>'
    fetcher = FakeFetcher({
        "https://biuro.pl/": home,
        "https://biuro.pl/oferty/domy": page(crm_cards(3)),
        "https://biuro.pl/oferty/mieszkania": page(crm_cards(9)),
    })
    scan = scan_offers(fetcher, "https://biuro.pl/")
    assert scan.source_url == "https://biuro.pl/oferty/mieszkania" and len(scan.offers) == 9


def test_long_dashes_in_titles_become_short():
    assert clean_title("Mieszkanie 4P – Okazja") == "Mieszkanie 4P - Okazja"


def test_repeated_generic_titles_get_location_and_area_but_not_agent_names():
    cards = "".join(
        f"""<div class="offer"><a href="/dzialki-na-sprzedaz-{m}m2-{slug}-{p}zl/{oid}"><img src="/a.jpg"></a>
              <h3>Działka na sprzedaż</h3><div class="location">{loc}</div>
              <ul><li>{m} m²</li><li>{p} zł</li></ul><p class="agent">Jan Kowalski</p></div>"""
        for m, slug, p, oid, loc in (
            (1281, "dlugoleka-pasikurowice", 358680, 7214001, "Długołęka, Pasikurowice"),
            (2000, "walim-rzeczka", 240000, 7214002, "Walim, Rzeczka"),
            (763, "wroclaw-psie-pole", 549000, 7214003, "Wrocław, Psie Pole"),
        )
    )
    offers, _ = extract_offers(page(cards), "https://biuro.pl/oferty")
    assert [o.title for o in offers] == [
        "Działka na sprzedaż, Długołęka, Pasikurowice, 1281 m²",
        "Działka na sprzedaż, Walim, Rzeczka, 2000 m²",
        "Działka na sprzedaż, Wrocław, Psie Pole, 763 m²",
    ]
    assert all("Kowalski" not in o.title for o in offers)


def test_parse_price_total_rent_and_per_area():
    from katalog_worker.offers import format_price, parse_price

    assert parse_price("Cena: 599 000 zł 11 280 zł/m²") == (599000.0, "PLN", None)
    assert parse_price("12 500 zł/m2 · 750.000 PLN") == (750000.0, "PLN", None)
    assert parse_price("3 200 zł / mies.") == (3200.0, "PLN", "month")
    assert parse_price("2 800 zł", rent_hint=True) == (2800.0, "PLN", "month")
    assert parse_price("120 000 €") == (120000.0, "EUR", None)
    assert parse_price("2 pokoje, 48 m2, 3 piętro") is None
    assert parse_price("tel. 600 100 200") is None
    assert format_price(599000, "PLN", None) == "599 000 zł"
    assert format_price(3200, "PLN", "month") == "3 200 zł/mies."


def test_prices_from_cards_and_from_offer_urls():
    from katalog_worker.offers import extract_offers

    offers, method = extract_offers(page(crm_cards(4)), "https://biuro.pl/oferty")
    assert method == "links"
    assert {o.price_text for o in offers} == {"450\u00a0000 zł"}

    links = "".join(
        f'<li><a href="/dzialki-na-sprzedaz-1200m2-wroclaw-{p}zl/72{i}">Działka na sprzedaż, Wrocław</a></li>'
        for i, p in enumerate([358680, 311040, 240000])
    )
    offers, _ = extract_offers(f"<html><body><ul>{links}</ul></body></html>", "https://biuro.pl/oferty")
    prices = {o.url.rsplit("/", 1)[-1]: (o.price_amount, o.price_period) for o in offers}
    assert prices["720"] == (358680.0, None)

    rent = "".join(
        f'<li><a href="/oferty/mieszkania/mieszkania-na-wynajem-{p}zl-39m2-wroclaw-o72{i}">Mieszkanie na wynajem, Wrocław</a></li>'
        for i, p in enumerate([3000, 2700, 2000])
    )
    offers, _ = extract_offers(f"<html><body><ul>{rent}</ul></body></html>", "https://biuro.pl/oferty")
    assert [(o.price_amount, o.price_period) for o in offers] == [(3000.0, "month"), (2700.0, "month"), (2000.0, "month")]
