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

# Rdzenie słów (po usunięciu polskich znaków) nazywające rodzaj nieruchomości albo jej parametry. Same słowa
# "sprzedaż", "najem", "nieruchomości" nie wystarczą, bo pojawiają się też w tytułach artykułów i kategorii.
_RE_PREFIXES = (
    "mieszkan", "kawalerk", "apartament", "dzialk", "grunt", "lokal", "magazyn", "kamienic", "segment", "blizniak",
    "szeregow", "siedlisk", "pokoj", "pokoi", "apartment", "willa", "rezydencj", "penthouse", "hala", "hali",
    "biurow", "garaz", "dworek", "posiadlosc", "pensjonat", "budynek", "budynk", "kawalerk", "loft",
)
_RE_WORDS = {
    "dom", "domy", "domu", "biuro", "biura", "hale", "pok", "m2", "ha", "ar", "flat", "house", "studio", "plot",
}
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
    "promocja", "wyroznione", "polecane", "rezerwacja", "sprzedane", "wynajete", "kup teraz", "wynajmij teraz",
    "zarezerwuj", "umow prezentacje", "umow sie na prezentacje", "pokaz na mapie", "zobacz na mapie", "mapa",
    "galeria", "zdjecia", "film", "wirtualny spacer", "spacer 3d", "drukuj", "udostepnij",
}
# "Warszawa 2516 ofert", "Mieszkania (45)": linki do kategorii z licznikiem, nie oferty.
_COUNTED_CATEGORY = re.compile(r"(?:\b\d[\d ]*\s+(?:ofert|oferty|ogloszen|nieruchomosci)\b|\(\s*\d+\s*\)\s*$)")
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
    ("rynek wtorny", 6),
    ("rynek pierwotny", 5),
    ("kupno", 3),
    ("wynajmij", 3),
    ("kup", 2),
    ("na wynajem", 3),
    ("do wynajecia", 3),
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
    price_amount: float | None = None
    price_currency: str | None = None
    price_period: str | None = None  # month dla najmu, None dla ceny jednorazowej

    @property
    def price_text(self) -> str | None:
        return format_price(self.price_amount, self.price_currency, self.price_period)


# Cena: liczba z separatorami tysięcy i waluta, np. "599 000 zł", "3.200 PLN/mies.", "120 000 €".
_PRICE_RE = re.compile(
    r"(?i)(?<![\d.,])(\d{1,3}(?:[ \u00a0\u202f.]\d{3})+|\d{3,9})(?:,(\d{1,2}))?\s*(zł|zl|pln|eur|€|usd|\$)"
    r"(\s*/\s*(?:mies\w*|m-c|mc|msc|miesiąc|month)\.?)?"
)
_PER_AREA_RE = re.compile(r"(?i)^\s*/\s*(?:m2|m²|m\.?\s*kw|mkw|ar|ha)")
_PRICE_CLASS = re.compile(r"price|cena|cost|koszt|amount|kwota", re.I)
_SLUG_PRICE_RE = re.compile(r"(?i)-(\d{3,9})(?:zl|pln)(?=[-/._]|$)")
_CURRENCY = {"zł": "PLN", "zl": "PLN", "pln": "PLN", "eur": "EUR", "€": "EUR", "usd": "USD", "$": "USD"}
_MIN_PRICE = {"PLN": 300, "EUR": 70, "USD": 70}
_RENT_HINT = re.compile(r"(?i)wynaj|najem|najm|do-wynajecia|rent")


def format_price(amount: float | None, currency: str | None, period: str | None) -> str | None:
    if not amount or not currency:
        return None
    whole = int(round(amount))
    digits = f"{whole:,}".replace(",", "\u00a0")
    unit = {"PLN": "zł", "EUR": "EUR", "USD": "USD"}.get(currency, currency)
    return f"{digits} {unit}" + ("/mies." if period == "month" else "")


def parse_price(text: str, rent_hint: bool = False) -> tuple[float, str, str | None] | None:
    """Pierwsza cena całkowita w tekście (ceny za m2 pomijamy). Zwraca (kwota, waluta, okres)."""
    for match in _PRICE_RE.finditer(text):
        if _PER_AREA_RE.match(text[match.end():]):
            continue
        number = re.sub(r"[ \u00a0\u202f.]", "", match.group(1))
        amount = float(number) + (float(f"0.{match.group(2)}") if match.group(2) else 0.0)
        currency = _CURRENCY[match.group(3).lower()]
        if amount < _MIN_PRICE[currency] or amount > 500_000_000:
            continue
        period = "month" if match.group(4) else None
        if period is None and rent_hint and currency == "PLN" and amount < 40_000:
            period = "month"
        return amount, currency, period
    return None


def price_from_card(card: Tag | None, url: str) -> tuple[float, str, str | None] | None:
    """Cena z karty oferty (najpierw element oznaczony jako cena), a gdy jej brak, z adresu oferty (np. -358680zl/)."""
    rent = bool(_RENT_HINT.search(url))
    if card is not None:
        whole = " ".join(card.get_text(" ").split())
        rent = rent or bool(_RENT_HINT.search(whole[:2000]))
        candidates = [" ".join(e.get_text(" ").split()) for e in card.find_all(class_=_PRICE_CLASS)]
        candidates.append(whole)
        for text in candidates:
            if text and len(text) <= 2000:
                found = parse_price(text, rent)
                if found:
                    return found
    match = _SLUG_PRICE_RE.search(urlsplit(url).path)
    if match:
        amount = float(match.group(1))
        if amount >= _MIN_PRICE["PLN"]:
            return amount, "PLN", "month" if rent and amount < 40_000 else None
    return None


def _jsonld_price(node: dict, url: str) -> tuple[float, str, str | None] | None:
    for offer in [node, *_as_list(node.get("offers"))]:
        if not isinstance(offer, dict):
            continue
        price = offer.get("price") or offer.get("lowPrice")
        if isinstance(offer.get("priceSpecification"), dict):
            price = price or offer["priceSpecification"].get("price")
        if price in (None, ""):
            continue
        try:
            amount = float(str(price).replace(" ", "").replace("\u00a0", "").replace(",", "."))
        except ValueError:
            continue
        currency = str(offer.get("priceCurrency") or "PLN").upper()
        if currency not in _MIN_PRICE or amount < _MIN_PRICE[currency]:
            continue
        rent = bool(_RENT_HINT.search(url))
        return amount, currency, "month" if rent and currency == "PLN" and amount < 40_000 else None
    return None


@dataclass
class OfferScan:
    source_url: str | None = None
    offers: list[Offer] = field(default_factory=list)
    method: str | None = None  # jsonld | links
    tried: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    diagnostics: dict[str, list[dict]] = field(default_factory=dict)  # strona bez ofert -> największe grupy linków


def fold(text: str) -> str:
    """Małe litery bez polskich znaków (ł -> l), inne znaki jako spacje."""
    text = unicodedata.normalize("NFKD", text.lower().replace("ł", "l"))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def _path_text(url: str) -> str:
    """Ścieżka i zapytanie adresu, bez domeny (nazwa domeny biura nie mówi nic o pojedynczej ofercie)."""
    parts = urlsplit(url)
    return f"{parts.path} {parts.query}"


def looks_like_real_estate(text: str) -> bool:
    for token in fold(text).split():
        if token in _RE_WORDS or token.startswith(_RE_PREFIXES):
            return True
    return False


def clean_title(text: str) -> str | None:
    title = " ".join(text.replace("\u2013", "-").replace("\u2014", "-").split()).strip(" -|·•»«>,;:")
    if len(title) < 6 or not re.search(r"[A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃ]{3}", title):
        return None
    if fold(title) in _GENERIC_TEXT or _COUNTED_CATEGORY.search(fold(title) if "(" not in title else title.lower()):
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
    long_slug = len([t for t in re.split(r"[-_]+", stem) if t]) >= 3 or len(stem.strip("-_")) >= 24
    if not has_id and not long_slug:
        return None
    if not has_id and _CATEGORY_SLUG.search(fold(stem).replace(" ", "-")):
        return None
    first = segments[0].lower() if len(segments) > 1 else ""
    if re.search(r"\d{3,}", first) or len([t for t in re.split(r"[-_]+", first) if t]) >= 3:
        first = "*"  # pierwszy człon to slug samej oferty (np. /dzialki-na-sprzedaz-1200m2-.../123)
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


_LOCATION_CLASS = re.compile(r"loc|address|adres|lokaliz|city|miasto|miejsc|region|district|dzielnic", re.I)
_AREA_CLASS = re.compile(r"area|powierzchn|metraz|surface|size", re.I)
_AREA_RE = re.compile(r"(?i)\b\d[\d\s.,]*\s*(?:m2|m²|ar|ary|ha)\b")


def _card_node(anchor: Tag, url_key: str, page_url: str) -> Tag | None:
    """Największy przodek linku (do 5 poziomów), który nie obejmuje innych ofert, czyli cała karta oferty."""
    best: Tag | None = None
    node: Tag | None = anchor
    for _ in range(5):
        node = node.parent if node is not None else None
        if not isinstance(node, Tag) or node.name in ("body", "html"):
            break
        keys = set()
        for other in node.find_all("a", href=True):
            absolute = _absolute(str(other["href"]), page_url)
            if absolute:
                keys.add(canonical_url(absolute))
        keys.discard(canonical_url(page_url))
        if len({k for k in keys if not k.startswith(url_key)} - {url_key}) > 1:
            break
        best = node
    return best


def _enrich_title(title: str, card: Tag) -> str:
    """Ogólny tytuł (np. "Działka na sprzedaż" przy wielu ofertach) uzupełniony o lokalizację i powierzchnię z karty.

    Lokalizację bierzemy tylko z elementu oznaczonego jako adres lub lokalizacja, a nie z dowolnego tekstu karty,
    żeby nie dopisać np. imienia i nazwiska agenta."""
    folded = fold(title)
    extra: list[str] = []
    for pattern in (_LOCATION_CLASS, _AREA_CLASS):
        for element in card.find_all(class_=pattern):
            text = " ".join(element.get_text(" ").split()).strip(" ,;:|")
            if not text or len(text) > 80 or fold(text) in folded or contains_contacts(text):
                continue
            if pattern is _LOCATION_CLASS and re.search(r"(?i)zł|pln|eur|€", text):
                continue
            if pattern is _AREA_CLASS and not _AREA_RE.search(text):
                continue
            extra.append(_AREA_RE.search(text).group(0).strip() if pattern is _AREA_CLASS else text)
            break
    if not any(_AREA_RE.search(e) for e in extra):
        for piece in card.stripped_strings:
            match = _AREA_RE.search(piece)
            if match and len(piece) <= 30:
                extra.append(match.group(0).strip())
                break
    if not extra:
        return title
    return clean_title(", ".join([title, *extra])) or title


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
            offer = Offer(absolute, title, len(found))
            price = _jsonld_price(node, absolute) or price_from_card(None, absolute)
            if price:
                offer.price_amount, offer.price_currency, offer.price_period = price
            found[key] = offer

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
    if sum(looks_like_real_estate(f"{o.title} {_path_text(o.url)}") for o in offers) * 10 < len(offers) * 6:
        return []
    return offers[:MAX_OFFERS]


def _link_groups(soup: BeautifulSoup, page_url: str) -> list[dict]:
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

    return _rank_groups(groups, page_url)


def _drop_variants(items: list[dict]) -> list[dict]:
    """Usuwa warianty tej samej oferty, np. /oferta,123,jump=1 obok /oferta,123 (kotwice, zakładki, przyciski)."""
    urls = [e["url"] for e in items]
    return [
        e for e in items
        if not any(other != e["url"] and e["url"].startswith(other) and e["url"][len(other)] in ",;&?/" for other in urls)
    ]


def _rank_groups(groups: dict[tuple, dict[str, dict]], page_url: str) -> list[dict]:
    """Grupy linków o wspólnym wzorcu, od najbardziej do najmniej prawdopodobnej listy ofert."""
    ranked = []
    for template, entries in groups.items():
        items = _drop_variants(list(entries.values()))
        with_id = [e for e in items if re.search(r"\d{3,}", urlsplit(e["url"]).path) or template[3]]
        if len(with_id) >= MIN_OFFERS and len(with_id) * 10 >= len(items) * 6:
            items = with_id  # większość ma numer oferty: odrzucamy linki bez numeru (kategorie, podstrony)
        if len(items) >= MIN_OFFERS:
            for entry in items:
                if not entry["titles"]:
                    title = _card_title(entry["anchors"][0], canonical_url(entry["url"]), page_url)
                    if title:
                        entry["titles"].append(title)
        titled = [e for e in items if e["titles"]]
        ratio = (
            sum(looks_like_real_estate(f"{_best_title(e['titles'])} {_path_text(e['url'])}") for e in titled) / len(titled)
            if titled else 0.0
        )
        score = len(titled) * (0.5 + ratio) + (3 if template[0] in _OFFER_SECTIONS else 0)
        ranked.append({"template": template, "links": len(items), "items": titled, "ratio": ratio, "score": score})
    return sorted(ranked, key=lambda g: -g["score"])


def offers_from_links(soup: BeautifulSoup, page_url: str) -> list[Offer]:
    for group in _link_groups(soup, page_url):
        if len(group["items"]) >= MIN_OFFERS and group["ratio"] >= 0.6:
            chosen = sorted(group["items"], key=lambda e: e["order"])[:MAX_OFFERS]
            titles = [_best_title(e["titles"]) for e in chosen]
            repeated = {t for t in titles if titles.count(t) > 1}
            offers: list[Offer] = []
            for index, entry in enumerate(chosen):
                card = _card_node(entry["anchors"][0], canonical_url(entry["url"]), page_url)
                if titles[index] in repeated and card is not None:
                    titles[index] = _enrich_title(titles[index], card)
                offer = Offer(entry["url"], titles[index], index)
                price = price_from_card(card, entry["url"])
                if price:
                    offer.price_amount, offer.price_currency, offer.price_period = price
                offers.append(offer)
            return offers
    return []


def describe_link_groups(html: str, page_url: str, top: int = 3) -> list[dict]:
    """Diagnostyka strony bez ofert: największe grupy linków (wzorzec, liczba, udział nieruchomości, przykład)."""
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "noscript", "template"]):
        tag.decompose()
    anchors = len(soup.find_all("a", href=True))
    report = [{"anchors": anchors, "text_chars": len(soup.get_text(" ", strip=True))}]
    for group in _link_groups(soup, page_url)[:top]:
        first, depth, ext, keys = group["template"]
        sample = group["items"][0] if group["items"] else None
        report.append({
            "pattern": f"/{first or '*'}/(głębokość {depth}){ext}{'?' + ','.join(keys) if keys else ''}",
            "links": group["links"], "titled": len(group["items"]), "ratio": round(group["ratio"], 2),
            "sample": [_best_title(sample["titles"]), sample["url"]] if sample else None,
        })
    return report


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
        if any(k.lower() in _SKIP_QUERY_KEYS for k, _ in parse_qsl(urlsplit(absolute).query)):
            continue  # ta sama lista inaczej posortowana albo kolejna strona listy
        if _template(absolute) and re.search(r"\d{3,}", path):
            continue  # pojedyncza oferta, a nie lista ofert
        last = [seg for seg in path.split("/") if seg][-1:] or [""]
        if len([t for t in re.split(r"[-_.]+", last[0]) if t and t not in ("html", "htm", "php")]) >= 5:
            continue  # artykuł, np. /dlaczego-warto-podpisac-umowe-na-wylacznosc/
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
        query = urlsplit(absolute).query
        if query:
            score -= 2  # lista z filtrem (np. tylko działki) jest gorsza od pełnej
            parts = urlsplit(absolute)
            bare = urlunsplit((parts.scheme, parts.netloc, parts.path or "/", "", ""))
            bare_key = canonical_url(bare)
            if bare_key != page_key and (bare_key not in scored or scored[bare_key][0] < score + 3):
                scored[bare_key] = (score + 3, bare)
        if key not in scored or scored[key][0] < score:
            scored[key] = (score, absolute)
    ordered = sorted(scored.values(), key=lambda item: (-item[0], len(item[1])))
    return [url for _, url in ordered[:limit]]


def scan_offers(fetcher, home_url: str, known_index: str | None = None, max_index_pages: int = 4) -> OfferScan:
    """Pobiera stronę z ofertami (zapamiętaną albo znalezioną na stronie głównej) i wyciąga z niej oferty.

    Strona główna jest tylko awaryjnym źródłem, bo często pokazuje oferty polecane zamiast najnowszych."""
    scan = OfferScan()

    def read(url: str, result) -> tuple[list[Offer], str | None]:
        offers, method = extract_offers(result.text, result.final_url)
        if not offers:
            scan.diagnostics[url] = describe_link_groups(result.text, result.final_url)
        return offers, method

    if known_index:
        scan.tried.append(known_index)
        result = fetcher.fetch(known_index)
        if result.ok:
            offers, method = read(known_index, result)
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
    home_offers, home_method = read(home_url, home)
    for url in offer_index_urls(home.text, home.final_url, limit=max_index_pages):
        if url == known_index:
            continue
        scan.tried.append(url)
        result = fetcher.fetch(url)
        if not result.ok:
            scan.errors.append(f"{url}: {result.error}")
            continue
        offers, method = read(url, result)
        if len(offers) > len(scan.offers):
            scan.source_url, scan.offers, scan.method = url, offers, method
            if len(offers) >= MAX_OFFERS:
                break
    if scan.offers:
        return scan
    if home_offers:
        scan.source_url, scan.offers, scan.method = home.final_url, home_offers, home_method
    return scan
