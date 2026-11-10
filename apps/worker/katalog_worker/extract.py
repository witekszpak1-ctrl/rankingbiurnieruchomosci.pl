"""Deterministyczna ekstrakcja danych ze strony firmy (bez LLM).

Wydobywa: JSON-LD, meta, e-maile (mailto, Cloudflare, tekst), telefony (E.164), profile społecznościowe,
NIP/REGON/KRS (z sumą kontrolną), kody pocztowe z miastem, kandydatów na ceny i linki do podstron.

Zasady (z planu):
- e-maile osobiste (imie.nazwisko@) są oznaczane i nie nadają się do zapisu,
- nigdy nie zgadujemy adresów, bierzemy tylko to, co jest opublikowane na stronie.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlsplit

import phonenumbers
from bs4 import BeautifulSoup

from .ids import IdHit, find_krs, find_nips, find_regons, is_valid_nip, normalize_nip
from .urls import registrable_domain

# ----------------------------------------------------------------------------- typy


@dataclass
class EmailHit:
    address: str
    kind: str  # role | personal_like | unknown
    source: str  # mailto | cfemail | jsonld | text

    @property
    def storable(self) -> bool:
        """Do bazy trafiają tylko adresy rolowe. Reszta wymaga decyzji człowieka."""
        return self.kind == "role"


@dataclass
class PhoneHit:
    e164: str
    raw: str
    source: str  # tel | jsonld | text


@dataclass
class SocialLink:
    network: str
    url: str


@dataclass
class PostcodeHit:
    postcode: str
    city: str
    context: str


@dataclass
class PriceCandidate:
    snippet: str
    keyword: str
    percents: list[float]
    amounts_pln: list[float]
    tax_hint: str | None  # plus_vat | net | gross | None


@dataclass
class PageExtraction:
    url: str
    title: str = ""
    meta_description: str = ""
    og_site_name: str = ""
    lang: str = ""
    text: str = ""
    organizations: list[dict] = field(default_factory=list)
    emails: list[EmailHit] = field(default_factory=list)
    phones: list[PhoneHit] = field(default_factory=list)
    socials: list[SocialLink] = field(default_factory=list)
    nips: list[IdHit] = field(default_factory=list)
    regons: list[IdHit] = field(default_factory=list)
    krs: list[IdHit] = field(default_factory=list)
    postcodes: list[PostcodeHit] = field(default_factory=list)
    price_candidates: list[PriceCandidate] = field(default_factory=list)
    links: list[tuple[str, str]] = field(default_factory=list)
    outbound_domains: set[str] = field(default_factory=set)
    jsonld_types: list[str] = field(default_factory=list)
    item_list_len: int = 0


# ----------------------------------------------------------------------------- e-mail

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}")
_IMAGE_TLDS = {"png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "css", "js", "avif"}
_JUNK_DOMAINS = {"example.com", "domain.com", "email.com", "sentry.io", "wixpress.com", "yoursite.com", "twoja-domena.pl"}
_ROLE_LOCALPARTS = {
    "biuro", "kontakt", "info", "office", "sekretariat", "oferta", "oferty", "sprzedaz", "wynajem",
    "rekrutacja", "praca", "bok", "recepcja", "marketing", "hello", "contact", "mail", "poczta",
    "zapytania", "rezerwacje", "administracja", "obsluga", "klient", "klienci", "wycena",
    "nieruchomosci", "agencja", "pomoc", "support", "reklama", "kadry", "ksiegowosc", "faktury",
    "zamowienia", "sales", "team", "zespol",
}
_PERSONAL_LIKE_RE = re.compile(r"^[a-z]{2,}[._-][a-z]{2,}$")
_OBFUSCATED_AT = re.compile(r"\s*[\[(]\s*(?:at|małpa|malpa)\s*[\])]\s*", re.I)
_OBFUSCATED_DOT = re.compile(r"\s*[\[(]\s*(?:dot|kropka)\s*[\])]\s*", re.I)


def classify_email(address: str) -> str:
    local = address.split("@", 1)[0].lower()
    if local in _ROLE_LOCALPARTS:
        return "role"
    if _PERSONAL_LIKE_RE.match(local):
        return "personal_like"
    return "unknown"


def _valid_email(address: str) -> bool:
    address = address.lower()
    if "@" not in address:
        return False
    local, domain = address.rsplit("@", 1)
    tld = domain.rsplit(".", 1)[-1]
    if tld in _IMAGE_TLDS or tld.isdigit():
        return False
    if domain in _JUNK_DOMAINS or domain.endswith(".sentry.io") or "wixpress" in domain:
        return False
    return bool(local) and len(address) <= 254


def decode_cfemail(hexstr: str) -> str | None:
    """Dekoduje adres zaciemniony przez ochronę e-mail Cloudflare (data-cfemail)."""
    try:
        data = bytes.fromhex(hexstr)
    except ValueError:
        return None
    if len(data) < 2:
        return None
    key = data[0]
    try:
        return bytes(b ^ key for b in data[1:]).decode("utf-8")
    except UnicodeDecodeError:
        return None


# ----------------------------------------------------------------------------- telefony

_PHONE_KEYWORDS = re.compile(r"(?i)\b(tel|telefon|kom|komórka|komorka|mobile|phone|zadzwoń|zadzwon|dzwoń|dzwon|infolinia)\b")


def _e164(raw: str) -> str | None:
    try:
        number = phonenumbers.parse(raw, "PL")
    except phonenumbers.NumberParseException:
        return None
    if not phonenumbers.is_valid_number(number):
        return None
    return phonenumbers.format_number(number, phonenumbers.PhoneNumberFormat.E164)


def _phones_from_text(text: str) -> list[PhoneHit]:
    hits: list[PhoneHit] = []
    for match in phonenumbers.PhoneNumberMatcher(text, "PL", leniency=phonenumbers.Leniency.VALID):
        raw = match.raw_string
        before = text[max(0, match.start - 25) : match.start]
        explicit_prefix = raw.strip().startswith(("+", "00"))
        if not (explicit_prefix or _PHONE_KEYWORDS.search(before)):
            # bez prefiksu i bez słowa "tel" to często REGON/KRS/NIP albo numer ofertowy
            continue
        e164 = phonenumbers.format_number(match.number, phonenumbers.PhoneNumberFormat.E164)
        hits.append(PhoneHit(e164=e164, raw=raw, source="text"))
    return hits


# ----------------------------------------------------------------------------- social media

_SOCIAL_RULES: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("facebook", re.compile(r"^(?:www\.|m\.|pl-pl\.)?facebook\.com$")),
    ("instagram", re.compile(r"^(?:www\.)?instagram\.com$")),
    ("linkedin", re.compile(r"^(?:[a-z]{2,3}\.)?linkedin\.com$")),
    ("youtube", re.compile(r"^(?:www\.|m\.)?youtube\.com$")),
    ("tiktok", re.compile(r"^(?:www\.)?tiktok\.com$")),
    ("x", re.compile(r"^(?:www\.)?(?:twitter|x)\.com$")),
)
# Domeny, do których linkuje prawie każda strona (udostępnianie, mapy, komunikatory).
# Nie liczą się jako sygnał "dużo linków do różnych firm".
_NEUTRAL_DOMAINS = {
    "facebook.com", "instagram.com", "linkedin.com", "youtube.com", "tiktok.com", "twitter.com",
    "x.com", "google.com", "goo.gl", "g.page", "wa.me", "whatsapp.com", "t.me", "messenger.com",
    "pinterest.com", "apple.com",
}
_SOCIAL_SKIP_PATH = re.compile(
    r"^/(?:sharer|share|dialog|plugins|tr|login|intent|home|hashtag|watch|embed|policies|legal|help|privacy|about/privacy)\b",
    re.I,
)


def classify_social(url: str) -> SocialLink | None:
    parts = urlsplit(url)
    host = (parts.hostname or "").lower()
    path = parts.path or "/"
    if path.strip("/") == "" or _SOCIAL_SKIP_PATH.match(path):
        return None
    for network, pattern in _SOCIAL_RULES:
        if pattern.match(host):
            if network == "linkedin" and not re.match(r"^/(company|in|school)/", path):
                return None
            if network == "tiktok" and not path.startswith("/@"):
                return None
            if network == "youtube" and not re.match(r"^/(channel/|@|user/|c/)", path):
                return None
            clean_host = host.removeprefix("www.").removeprefix("m.").removeprefix("pl-pl.")
            return SocialLink(network, f"https://{clean_host}{path.rstrip('/')}")
    return None


# ----------------------------------------------------------------------------- kody pocztowe

_CITY_WORD = r"[A-ZŁŚŻŹĆŃÓĄĘ][A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃ\-]+"
# Tylko spacje poziome, żeby nazwa miasta nie "przeciekała" do następnej linii tekstu.
_POSTCODE_RE = re.compile(rf"\b(\d{{2}}-\d{{3}})[ \t]+({_CITY_WORD}(?:[ \t]{_CITY_WORD}){{0,2}})")


def _postcodes(text: str) -> list[PostcodeHit]:
    seen: set[tuple[str, str]] = set()
    hits: list[PostcodeHit] = []
    for match in _POSTCODE_RE.finditer(text):
        key = (match.group(1), match.group(2).lower())
        if key in seen:
            continue
        seen.add(key)
        context = " ".join(text[max(0, match.start() - 60) : match.end() + 20].split())
        hits.append(PostcodeHit(match.group(1), match.group(2), context))
    return hits


# ----------------------------------------------------------------------------- ceny

_PRICE_KEYWORDS = re.compile(r"(?i)(prowizj|cennik|opłat|oplat|wynagrodzeni|koszt|cena|stawk)")
_PERCENT_RE = re.compile(r"(\d{1,2}(?:[.,]\d{1,2})?)\s?%")
_PLN_RE = re.compile(r"(\d{1,3}(?:[  .]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s?(?:zł|PLN)\b", re.I)
_TAX_PLUS_VAT = re.compile(r"(?i)\+\s?VAT|plus\s+VAT")
_TAX_NET = re.compile(r"(?i)\bnetto\b")
_TAX_GROSS = re.compile(r"(?i)\bbrutto\b")


def parse_pl_number(raw: str) -> float | None:
    value = raw.replace(" ", "").replace(" ", "")
    if "," in value:
        value = value.replace(".", "").replace(",", ".")
    elif re.fullmatch(r"\d{1,3}(?:\.\d{3})+", value):
        value = value.replace(".", "")
    try:
        return float(value)
    except ValueError:
        return None


def price_numbers(snippet: str) -> tuple[list[float], list[float]]:
    """Zwraca (wartości procentowe, kwoty w zł) znalezione we fragmencie tekstu."""
    percents = [parse_pl_number(p) for p in _PERCENT_RE.findall(snippet)]
    amounts = [parse_pl_number(a) for a in _PLN_RE.findall(snippet)]
    return [p for p in percents if p is not None], [a for a in amounts if a is not None]


def tax_hint(snippet: str) -> str | None:
    """plus_vat | net | gross | None, na podstawie słów w tekście."""
    if _TAX_PLUS_VAT.search(snippet):
        return "plus_vat"
    if _TAX_NET.search(snippet):
        return "net"
    if _TAX_GROSS.search(snippet):
        return "gross"
    return None


def _price_candidates(text: str, window: int = 160, limit: int = 20) -> list[PriceCandidate]:
    candidates: list[PriceCandidate] = []
    last_end = -1
    for match in _PRICE_KEYWORDS.finditer(text):
        if match.start() < last_end:
            continue
        start = max(0, match.start() - window // 4)
        end = min(len(text), match.end() + window)
        snippet = " ".join(text[start:end].split())
        percents_f, amounts_f = price_numbers(snippet)
        if not percents_f and not amounts_f:
            continue
        tax = tax_hint(snippet)
        candidates.append(PriceCandidate(snippet, match.group(1).lower(), percents_f, amounts_f, tax))
        last_end = end
        if len(candidates) >= limit:
            break
    return candidates


# ----------------------------------------------------------------------------- JSON-LD

_ORG_TYPES = {
    "Organization", "LocalBusiness", "RealEstateAgent", "ProfessionalService", "Corporation",
    "OnlineBusiness", "Store",
}


def _as_list(value) -> list:
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def _types(node: dict) -> list[str]:
    return [str(t) for t in _as_list(node.get("@type"))]


def _flatten_jsonld(data) -> list[dict]:
    nodes: list[dict] = []
    for item in _as_list(data):
        if not isinstance(item, dict):
            continue
        if "@graph" in item:
            nodes.extend(_flatten_jsonld(item["@graph"]))
        nodes.append(item)
    return nodes


def _load_jsonld(soup: BeautifulSoup) -> list[dict]:
    nodes: list[dict] = []
    for script in soup.find_all("script", attrs={"type": re.compile(r"application/ld\+json", re.I)}):
        raw = (script.string or script.get_text() or "").strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            try:
                data = json.loads(re.sub(r"[\x00-\x1f]+", " ", raw))
            except json.JSONDecodeError:
                continue
        nodes.extend(_flatten_jsonld(data))
    return nodes


def _org_summary(node: dict) -> dict:
    address = node.get("address")
    addr = None
    if isinstance(address, dict):
        addr = {
            "street": address.get("streetAddress"),
            "postcode": address.get("postalCode"),
            "city": address.get("addressLocality"),
        }
    elif isinstance(address, str):
        addr = {"street": address, "postcode": None, "city": None}
    return {
        "types": _types(node),
        "name": node.get("name") or node.get("legalName"),
        "telephone": node.get("telephone"),
        "email": node.get("email"),
        "url": node.get("url"),
        "same_as": [str(u) for u in _as_list(node.get("sameAs")) if isinstance(u, str)],
        "tax_id": node.get("taxID") or node.get("vatID"),
        "address": addr,
    }


# ----------------------------------------------------------------------------- główna funkcja

_DROP_TAGS = ("script", "style", "noscript", "svg", "iframe", "template")


def _clean_text(soup: BeautifulSoup) -> str:
    for tag in soup(_DROP_TAGS):
        tag.decompose()
    text = soup.get_text("\n")
    lines = [" ".join(line.split()) for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def extract_page(html: str, url: str) -> PageExtraction:
    soup = BeautifulSoup(html, "lxml")
    page = PageExtraction(url=url)

    # JSON-LD, meta i cfemail zbieramy przed usunięciem skryptów
    nodes = _load_jsonld(soup)
    org_nodes = [n for n in nodes if set(_types(n)) & _ORG_TYPES]
    page.organizations = [_org_summary(n) for n in org_nodes]
    page.jsonld_types = sorted({t for n in nodes for t in _types(n)})
    page.item_list_len = max(
        (len(_as_list(n.get("itemListElement"))) for n in nodes if "ItemList" in _types(n)), default=0
    )

    if soup.title and soup.title.string:
        page.title = " ".join(soup.title.string.split())
    desc = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)})
    if desc and desc.get("content"):
        page.meta_description = " ".join(str(desc["content"]).split())
    og_site = soup.find("meta", attrs={"property": "og:site_name"})
    if og_site and og_site.get("content"):
        page.og_site_name = " ".join(str(og_site["content"]).split())
    if soup.html and soup.html.get("lang"):
        page.lang = str(soup.html["lang"]).lower()

    emails: dict[str, EmailHit] = {}

    def add_email(address: str, source: str) -> None:
        address = address.strip().strip(".,;:()<>").lower()
        if not _valid_email(address) or address in emails:
            return
        emails[address] = EmailHit(address, classify_email(address), source)

    phones: dict[str, PhoneHit] = {}

    def add_phone(hit: PhoneHit) -> None:
        phones.setdefault(hit.e164, hit)

    socials: dict[str, SocialLink] = {}
    links: list[tuple[str, str]] = []
    page_domain = registrable_domain(url)
    outbound: set[str] = set()

    for anchor in soup.find_all("a", href=True):
        href = str(anchor["href"]).strip()
        anchor_text = " ".join(anchor.get_text(" ").split())
        lowered = href.lower()
        if lowered.startswith("mailto:"):
            add_email(href[7:].split("?", 1)[0], "mailto")
            continue
        if lowered.startswith("tel:"):
            e164 = _e164(href[4:])
            if e164:
                add_phone(PhoneHit(e164, href[4:], "tel"))
            continue
        if "/cdn-cgi/l/email-protection#" in lowered:
            decoded = decode_cfemail(href.split("#", 1)[1])
            if decoded:
                add_email(decoded, "cfemail")
            continue
        if lowered.startswith(("javascript:", "#")):
            continue
        absolute = urljoin(url, href)
        links.append((absolute, anchor_text))
        social = classify_social(absolute)
        if social:
            socials.setdefault(social.url, social)
            continue
        dom = registrable_domain(absolute)
        if dom and dom != page_domain and dom not in _NEUTRAL_DOMAINS:
            outbound.add(dom)

    for element in soup.find_all(attrs={"data-cfemail": True}):
        decoded = decode_cfemail(str(element["data-cfemail"]))
        if decoded:
            add_email(decoded, "cfemail")

    for org in page.organizations:
        if org.get("email"):
            add_email(str(org["email"]), "jsonld")
        if org.get("telephone"):
            e164 = _e164(str(org["telephone"]))
            if e164:
                add_phone(PhoneHit(e164, str(org["telephone"]), "jsonld"))
        for same in org.get("same_as", []):
            social = classify_social(same)
            if social:
                socials.setdefault(social.url, social)

    page.text = _clean_text(soup)
    plain = _OBFUSCATED_DOT.sub(".", _OBFUSCATED_AT.sub("@", page.text))
    for match in _EMAIL_RE.finditer(plain):
        add_email(match.group(0), "text")
    for hit in _phones_from_text(page.text):
        add_phone(hit)

    page.emails = list(emails.values())
    page.phones = list(phones.values())
    page.socials = list(socials.values())
    page.links = links
    page.outbound_domains = outbound

    nips = {hit.value: hit for hit in find_nips(page.text)}
    for org in page.organizations:
        tax_id = normalize_nip(str(org.get("tax_id") or ""))
        if tax_id and is_valid_nip(tax_id) and tax_id not in nips:
            nips[tax_id] = IdHit(tax_id, "JSON-LD taxID/vatID")
    page.nips = list(nips.values())
    page.regons = find_regons(page.text)
    page.krs = find_krs(page.text)
    page.postcodes = _postcodes(page.text)
    page.price_candidates = _price_candidates(page.text)
    return page


def merge_extractions(pages: list[PageExtraction]) -> PageExtraction:
    """Łączy kilka stron jednej domeny w jedną (do klasyfikacji i weryfikacji całej witryny)."""
    if not pages:
        raise ValueError("Brak stron do połączenia.")
    first = pages[0]
    merged = PageExtraction(
        url=first.url,
        title=first.title,
        meta_description=first.meta_description,
        og_site_name=first.og_site_name,
        lang=first.lang,
        text="\n".join(p.text for p in pages),
    )

    def unique(items, key):
        seen, out = set(), []
        for item in items:
            k = key(item)
            if k not in seen:
                seen.add(k)
                out.append(item)
        return out

    merged.organizations = [o for p in pages for o in p.organizations]
    merged.emails = unique((e for p in pages for e in p.emails), lambda e: e.address)
    merged.phones = unique((x for p in pages for x in p.phones), lambda x: x.e164)
    merged.socials = unique((s for p in pages for s in p.socials), lambda s: s.url)
    merged.nips = unique((h for p in pages for h in p.nips), lambda h: h.value)
    merged.regons = unique((h for p in pages for h in p.regons), lambda h: h.value)
    merged.krs = unique((h for p in pages for h in p.krs), lambda h: h.value)
    merged.postcodes = unique((h for p in pages for h in p.postcodes), lambda h: (h.postcode, h.city.lower()))
    merged.price_candidates = [c for p in pages for c in p.price_candidates]
    merged.links = [link for p in pages for link in p.links]
    merged.outbound_domains = set().union(*(p.outbound_domains for p in pages))
    merged.jsonld_types = sorted(set().union(*(set(p.jsonld_types) for p in pages)))
    merged.item_list_len = max(p.item_list_len for p in pages)
    return merged
