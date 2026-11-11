"""Oferty nieruchomości ze stron biur: tytuł i link do oferty na stronie firmy (bez opisów, cen i zdjęć).

Źródła, w tej kolejności:
1. JSON-LD (schema.org: Offer, Product, Residence, Apartment, House, RealEstateListing oraz ItemList z adresami ofert),
2. powtarzalne linki: grupa co najmniej 3 adresów o tym samym wzorcu (np. /oferta/<slug>-<id>), których adresy
   lub tytuły wyglądają na nieruchomości (mieszkanie, dom, działka, lokal, sprzedaż, wynajem...).

Tytuł oferty: nagłówek z karty oferty albo najdłuższy sensowny tekst linku. Ofert z kontaktem w tytule nie zapisujemy.
Kolejność jak na stronie firmy (biura zwykle pokazują najnowsze oferty na początku), najwyżej MAX_OFFERS.
"""

from __future__ import annotations

import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field
from urllib.parse import parse_qsl, urljoin, urlsplit, urlunsplit

from bs4 import BeautifulSoup, Tag

from .bundle import contains_contacts
from .extract import _as_list, _load_jsonld, _types
from .urls import canonical_url, registrable_domain

MAX_OFFERS = 20
MIN_OFFERS = 3
MAX_TITLE = 160

# Rdzenie słów (po usunięciu polskich znaków), które w adresie albo tytule wskazują na ofertę nieruchomości.
_RE_PREFIXES = (
    "mieszkan", "kawalerk", "apartament", "dzialk", "grunt", "lokal", "magazyn", "kamienic", "segment", "blizniak",
    "szeregow", "siedlisk", "pokoj", "pokoi", "sprzedaz", "sprzeda", "wynaj", "najem", "nieruchomosc", "inwestyc",
    "apartment", "propert", "willa", "rezydencj", "penthouse", "studio", "hala", "hali", "biurow",
)
_RE_WORDS = {"dom", "domy", "domu", "biuro", "biura", "hale", "pok", "m2", "ha", "flat", "house", "rent", "sale", "ar"}
# Pierwszy segment ścieżki typowy dla ofert w systemach CRM i motywach WordPress.
_OFFER_SECTIONS = {
    "oferta", "oferty", "offer", "offers", "nieruchomosc", "nieruchomosci", "property", "properties", "listing",
    "listings", "ogloszenie", "ogloszenia", "estate", "real-estate", "mieszkanie", "mieszkania", "dom", "domy",
    "dzialka", "dzialki", "lokal", "lokale", "sprzedaz", "wynajem", "inwestycje", "obiekt",
}
# Adresy, które na pewno nie są ofertami.
_SKIP_PATH = re.compile(
    r"(?:^|/)(?:kontakt|contact|o-nas|onas|about|blog|aktualnosci|news|artykul|artykuly|poradnik|porady|polityka"
    r"|privacy|regulamin|cookies?|rodo|login|logowanie|rejestracja|register|koszyk|cart|wp-admin|wp-login|wp-json|feed"
    r"|tag|tags|category|kategoria|author|autor|page|strona|kariera|praca|zespol|team|agent|agenci|agents|doradcy"
    r"|faq|cennik|uslugi|wycena|galeria|mapa-strony|sitemap|search|szukaj|wyszukiwarka|ulubione|schowek|porownaj"
    r"|print|drukuj|newsletter|partnerzy|referencje|opinie|dla-wlasciciela|zglos-nieruchomosc|zglos)(?:/|$|[.-])"
)
_SKIP_QUERY_KEYS = {"page", "strona", "paged", "sort", "order", "orderby", "limit", "view", "lang", "s", "print"}
_SKIP_EXT = re.compile(r"\.(jpe?g|png|gif|webp|svg|ico|css|js|pdf|zip|rar|mp4|mp3|docx?|xlsx?)$", re.I)
# Linki kategorii (np. /oferty/mieszkania-na-sprzedaz) wyglądają jak oferty, ale nie mają numeru oferty.
_CATEGORY_SLUG = re.compile(r"(?:^|-)(?:na-)?(?:sprzedaz|wynajem|najem|sprzedaze|wynajmu)$")
_GENERIC_TEXT = {
    "zobacz", "zobacz oferte", "zobacz wiecej", "szczegoly", "szczegoly oferty", "wiecej", "czytaj wiecej", "sprawdz",
    "details", "more", "read more", "pokaz", "pokaz oferte", "kliknij", "otworz", "dalej", "przejdz", "view",
    "see more", "oferta", "zapytaj", "zapytaj o oferte", "dodaj do ulubionych", "ulubione", "porownaj", "nowosc",
    "promocja", "wyroznione", "polecane", "rezerwacja", "sprzedane", "wynajete",
}
_TITLE_CLASS = re.compile(r"title|tytul|name|nazwa|heading|header|naglowek", re.I)
_HEADINGS = ("h1", "h2", "h3", "h4", "h5", "h6")
_INDEX_HINTS: tuple[tuple[str, int], ...] = (
    ("wszystkie oferty", 9),
    ("baza ofert", 9),
    ("nasze oferty", 8),
    ("oferty", 8),
    ("nieruchomosci", 4),
    ("properties", 6),
    ("listings", 6),
    ("ogloszenia", 6),
    ("mieszkania", 3),
    ("na sprzedaz", 3),
    ("sprzedaz", 2),
    ("wynajem", 2),
    ("oferta", 2),
)
_INDEX_SKIP = re.compile(r"(?:^|/)(?:kontakt|contact|blog|aktualnosci|polityka|privacy|regulamin|cookies?|rodo|zglos)")


@dataclass
class Offer:
    url: str
    title: str
    position: int


@dataclass
class OfferScan:
    source_url: str | None = None
    offers: list[Offer] = field(default_factory=list)
    method: str | None = None  # jsonld | links
    tried: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def fold(text: str) -> str:
    """Małe litery bez polskich znaków (ł -> l), inne znaki jako spacje."""
    text = unicodedata.normalize("NFKD", text.lower().replace("ł", "l"))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def looks_like_real_estate(text: str) -> bool:
    for token in fold(text).split():
        if token in _RE_WORDS or token.startswith(_RE_PREFIXES):
            return True
    return False


def clean_title(text: str) -> str | None:
    title = " ".join(text.split()).strip(" -|·•»«>,;:")
    if len(title) < 6 or not re.search(r"[A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃ]{3}", title):
        return None
    if fold(title) in _GENERIC_TEXT:
        return None
    if contains_contacts(title):
        return None
    if len(title) > MAX_TITLE:
        cut = title[:MAX_TITLE].rsplit(" ", 1)[0]
        title = cut.rstrip(" ,;:-") + "..."
    return title


def _absolute(href: str, base_url: str) -> str | None:
    if not href or href.startswith(("mailto:", "tel:", "javascript:", "#", "data:")):
        return None
    absolute = urljoin(base_url, href.strip())
    parts = urlsplit(absolute)
    if parts.scheme not in ("http", "https") or not parts.netloc:
        return None
    return urlunsplit((parts.scheme, parts.netloc, parts.path or "/", parts.query, ""))


def _candidate(url: str, base_domain: str, page_key: str) -> bool:
    """Czy adres może być ofertą: ta sama domena, nie strona główna ani strona systemowa."""
    if registrable_domain(url) != base_domain:
        return False
    key = canonical_url(url)
    if key == page_key:
        return False
    parts = urlsplit(url)
    path = parts.path.lower()
    if path in ("", "/") and not parts.query:
        return False
    if _SKIP_EXT.search(path) or _SKIP_PATH.search(path):
        return False
    if any(k.lower() in _SKIP_QUERY_KEYS for k, _ in parse_qsl(parts.query)):
        return False
    return True


def _template(url: str) -> tuple | None:
    """Wzorzec adresu oferty: pierwszy segment, głębokość, rozszerzenie i klucze liczbowe w zapytaniu.

    Zwraca None, gdy ostatni segment nie wygląda na pojedynczą ofertę (brak numeru i krótki slug)."""
    parts = urlsplit(url)
    segments = [s for s in parts.path.split("/") if s]
    numeric_keys = tuple(sorted(k.lower() for k, v in parse_qsl(parts.query) if re.fullmatch(r"\d{2,}", v)))
    if not segments and not numeric_keys:
        return None
    last = segments[-1] if segments else ""
    stem = re.sub(r"\.(html?|php|aspx?)$", "", last, flags=re.I)
    ext = last[len(stem):].lower()
    has_id = bool(re.search(r"\d{3,}", stem)) or bool(numeric_keys)
    long_slug = stem.count("-") + stem.count("_") >= 2 or len(stem) >= 24
    if not has_id and not long_slug:
        return None
    if not has_id and _CATEGORY_SLUG.search(fold(stem).replace(" ", "-")):
        return None
    first = segments[0].lower() if len(segments) > 1 else ""
    first = re.sub(r"\d+", "#", first)
    return (first, len(segments), ext, numeric_keys)


_CHROME_TOKENS = {
    "menu", "main-menu", "navbar", "nav", "navigation", "site-header", "site-footer", "footer", "stopka", "topbar",
    "breadcrumb", "breadcrumbs", "okruszki", "sidebar",
}


def _in_chrome(anchor: Tag) -> bool:
    """Link w menu, nagłówku lub stopce strony (tam są kategorie, nie oferty).

    <header> i <footer> wewnątrz karty (<article>, <li>) należą do oferty, nie do szkieletu strony."""
    parents = [p for p in anchor.parents if isinstance(p, Tag)]
    for index, parent in enumerate(parents):
        if parent.name in ("nav", "aside"):
            return True
        if parent.name in ("header", "footer") and not any(p.name in ("article", "li") for p in parents[index + 1:]):
            return True
        role = str(parent.get("role", "")).lower()
        if role in ("navigation", "banner", "contentinfo", "menu", "menubar"):
            return True
        tokens = {str(c).lower() for c in (parent.get("class") or [])}
        tokens.add(str(parent.get("id", "")).lower())
        if tokens & _CHROME_TOKENS:
            return True
    return False


_POST_TOKENS = {"type-post", "blog", "blog-post", "news", "aktualnosci", "wpis", "artykul", "article-list", "posts"}


def _in_posts(anchor: Tag) -> bool:
    """Link we wpisie blogowym albo aktualności (np. "Jak kupić mieszkanie"), a nie w ofercie."""
    for parent in anchor.parents:
        if isinstance(parent, Tag) and {str(c).lower() for c in (parent.get("class") or [])} & _POST_TOKENS:
            return True
    return False


def _heading_text(node: Tag) -> str | None:
    for element in node.find_all(_HEADINGS):
        title = clean_title(element.get_text(" "))
        if title:
            return title
    for element in node.find_all(class_=_TITLE_CLASS):
        if element.find(["img"]) and not element.get_text(strip=True):
            continue
        title = clean_title(element.get_text(" "))
        if title and len(title) <= MAX_TITLE:
            return title
    return None


def _card_title(anchor: Tag, url_key: str, page_url: str) -> str | None:
    """Nagłówek z karty oferty: najbliższy przodek linku, który nie obejmuje innych ofert."""
    node: Tag | None = anchor
    for _ in range(5):
        node = node.parent if node is not None else None
        if not isinstance(node, Tag) or node.name in ("body", "html"):
            return None
        keys = set()
        for other in node.find_all("a", href=True):
            absolute = _absolute(str(other["href"]), page_url)
            if absolute:
                keys.add(canonical_url(absolute))
        keys.discard(canonical_url(page_url))
        if len(keys - {url_key}) > 1:
            return None  # przodek obejmuje już listę ofert
        title = _heading_text(node)
        if title:
            return title
    return None


def _anchor_title(anchor: Tag) -> str | None:
    inner = _heading_text(anchor)
    if inner:
        return inner
    text = anchor.get_text(" ")
    title = clean_title(text) if len(" ".join(text.split())) <= 120 else None
    if title:
        return title
    for attr in ("title", "aria-label"):
        if anchor.get(attr):
            title = clean_title(str(anchor[attr]))
            if title:
                return title
    image = anchor.find("img", alt=True)
    if image is not None:
        return clean_title(str(image["alt"]))
    return None


def offers_from_jsonld(soup: BeautifulSoup, page_url: str) -> list[Offer]:
    base_domain = registrable_domain(page_url)
    page_key = canonical_url(page_url)
    found: dict[str, Offer] = {}

    def add(node: dict) -> None:
        url = node.get("url") or (node.get("@id") if str(node.get("@id", "")).startswith("http") else None)
        name = node.get("name") or node.get("headline")
        if isinstance(url, list):
            url = url[0] if url else None
        if not isinstance(url, str) or not isinstance(name, str):
            return
        absolute = _absolute(url, page_url)
        if not absolute or not _candidate(absolute, base_domain, page_key):
            return
        title = clean_title(name)
        key = canonical_url(absolute)
        if title and key not in found:
            found[key] = Offer(absolute, title, len(found))

    offer_types = {"Offer", "Product", "Residence", "Apartment", "House", "SingleFamilyResidence", "Accommodation",
                   "RealEstateListing", "Room", "Suite"}
    for node in _load_jsonld(soup):
        types = set(_types(node))
        if "ItemList" in types:
            for element in _as_list(node.get("itemListElement")):
                if isinstance(element, dict):
                    item = element.get("item")
                    add(item if isinstance(item, dict) else element)
        elif types & offer_types:
            add(node)
    offers = list(found.values())
    if sum(looks_like_real_estate(f"{o.title} {o.url}") for o in offers) * 2 < len(offers):
        return []
    return offers[:MAX_OFFERS]


def offers_from_links(soup: BeautifulSoup, page_url: str) -> list[Offer]:
    base_domain = registrable_domain(page_url)
    page_key = canonical_url(page_url)
    groups: dict[tuple, dict[str, dict]] = defaultdict(dict)  # wzorzec -> klucz adresu -> dane
    order = 0
    for anchor in soup.find_all("a", href=True):
        absolute = _absolute(str(anchor["href"]), page_url)
        if not absolute or not _candidate(absolute, base_domain, page_key):
            continue
        template = _template(absolute)
        if template is None or _in_chrome(anchor) or _in_posts(anchor):
            continue
        key = canonical_url(absolute)
        entry = groups[template].get(key)
        if entry is None:
            entry = groups[template][key] = {"url": absolute, "order": order, "titles": [], "anchors": []}
            order += 1
        entry["anchors"].append(anchor)
        title = _anchor_title(anchor)
        if title:
            entry["titles"].append(title)

    best: tuple[float, list[dict]] | None = None
    for template, entries in groups.items():
        items = list(entries.values())
        with_id = [e for e in items if re.search(r"\d{3,}", urlsplit(e["url"]).path) or template[3]]
        if len(with_id) >= MIN_OFFERS and len(with_id) * 10 >= len(items) * 6:
            items = with_id  # większość ma numer oferty: odrzucamy linki bez numeru (kategorie, podstrony)
        if len(items) < MIN_OFFERS:
            continue
        for entry in items:
            if not entry["titles"]:
                title = _card_title(entry["anchors"][0], canonical_url(entry["url"]), page_url)
                if title:
                    entry["titles"].append(title)
        titled = [e for e in items if e["titles"]]
        if len(titled) < MIN_OFFERS:
            continue
        ratio = sum(looks_like_real_estate(f"{max(e['titles'], key=len)} {e['url']}") for e in titled) / len(titled)
        if ratio < 0.5:
            continue
        score = len(titled) * (0.5 + ratio) + (3 if template[0] in _OFFER_SECTIONS else 0)
        if best is None or score > best[0]:
            best = (score, titled)
    if best is None:
        return []
    chosen = sorted(best[1], key=lambda e: e["order"])[:MAX_OFFERS]
    return [Offer(e["url"], _best_title(e["titles"]), i) for i, e in enumerate(chosen)]


def _best_title(titles: list[str]) -> str:
    """Najdłuższy tytuł, ale bez ucinanych ("...") gdy jest pełny krótszy."""
    full = [t for t in titles if not t.endswith("...")]
    return max(full or titles, key=len)


def extract_offers(html: str, page_url: str) -> tuple[list[Offer], str | None]:
    soup = BeautifulSoup(html, "lxml")
    offers = offers_from_jsonld(soup, page_url)
    if len(offers) >= MIN_OFFERS:
        return offers, "jsonld"
    for tag in soup(["script", "style", "noscript", "template"]):
        tag.decompose()
    offers = offers_from_links(soup, page_url)
    if len(offers) >= MIN_OFFERS:
        return offers, "links"
    return [], None


def offer_index_urls(html: str, page_url: str, limit: int = 3) -> list[str]:
    """Najbardziej obiecujące podstrony z listą ofert (np. /oferty, "Nasze oferty"), najlepsze pierwsze."""
    soup = BeautifulSoup(html, "lxml")
    base_domain = registrable_domain(page_url)
    page_key = canonical_url(page_url)
    scored: dict[str, tuple[int, str]] = {}
    for anchor in soup.find_all("a", href=True):
        absolute = _absolute(str(anchor["href"]), page_url)
        if not absolute or registrable_domain(absolute) != base_domain:
            continue
        key = canonical_url(absolute)
        path = urlsplit(absolute).path.lower()
        if key == page_key or _SKIP_EXT.search(path) or _INDEX_SKIP.search(path):
            continue
        anchor_text = fold(anchor.get_text(" "))
        path_text = fold(path)
        score = 0
        for hint, weight in _INDEX_HINTS:
            if f" {hint} " in f" {anchor_text} ":
                score += weight
            if f" {hint} " in f" {path_text} ":
                score += weight
        if score <= 0:
            continue
        depth = len([s for s in path.split("/") if s])
        if depth <= 2:
            score += 2
        if _template(absolute) and re.search(r"\d{3,}", path):
            score -= 6  # to raczej pojedyncza oferta
        if key not in scored or scored[key][0] < score:
            scored[key] = (score, absolute)
    ordered = sorted(scored.values(), key=lambda item: (-item[0], len(item[1])))
    return [url for _, url in ordered[:limit]]


def scan_offers(fetcher, home_url: str, known_index: str | None = None, max_index_pages: int = 3) -> OfferScan:
    """Pobiera stronę z ofertami (zapamiętaną albo znalezioną na stronie głównej) i wyciąga z niej oferty.

    Strona główna jest tylko awaryjnym źródłem, bo często pokazuje oferty polecane zamiast najnowszych."""
    scan = OfferScan()
    if known_index:
        scan.tried.append(known_index)
        result = fetcher.fetch(known_index)
        if result.ok:
            offers, method = extract_offers(result.text, result.final_url)
            if offers:
                scan.source_url, scan.offers, scan.method = known_index, offers, method
                return scan
        else:
            scan.errors.append(f"{known_index}: {result.error}")
    home = fetcher.fetch(home_url)
    scan.tried.append(home_url)
    if not home.ok:
        scan.errors.append(f"{home_url}: {home.error}")
        return scan
    home_offers, home_method = extract_offers(home.text, home.final_url)
    for url in offer_index_urls(home.text, home.final_url, limit=max_index_pages):
        if url == known_index:
            continue
        scan.tried.append(url)
        result = fetcher.fetch(url)
        if not result.ok:
            scan.errors.append(f"{url}: {result.error}")
            continue
        offers, method = extract_offers(result.text, result.final_url)
        if offers:
            scan.source_url, scan.offers, scan.method = url, offers, method
            return scan
    if home_offers:
        scan.source_url, scan.offers, scan.method = home.final_url, home_offers, home_method
    return scan
