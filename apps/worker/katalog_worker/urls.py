"""Normalizacja adresów i domen, blocklista, wybór podstron do crawla."""

from __future__ import annotations

import re
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

import tldextract

# Polskie domeny miejskie, pod którymi firmy mają własne strony (np. focus.wroc.pl), a których nie ma na dołączonej
# liście sufiksów. Bez tego focus.wroc.pl byłoby traktowane jak domena wroc.pl i pipeline sprawdzałby cudzą stronę.
_EXTRA_SUFFIXES = (
    "wroc.pl", "krakow.pl", "poznan.pl", "gdansk.pl", "gda.pl", "gdynia.pl", "sopot.pl", "lodz.pl",
    "lublin.pl", "torun.pl", "kielce.pl", "zielona-gora.pl", "wawa.pl",
)

# Lista sufiksów jest dołączona do biblioteki, bez pobierania z sieci.
_EXTRACT = tldextract.TLDExtract(suffix_list_urls=(), cache_dir=None, extra_suffixes=_EXTRA_SUFFIXES)

_TRACKING_PARAMS = {"fbclid", "gclid", "msclkid", "yclid", "mc_cid", "mc_eid", "igshid"}


def _split_host(value: str) -> str:
    value = value.strip()
    if "://" not in value:
        value = "//" + value
    host = urlsplit(value).hostname or ""
    return host.strip(".").lower()


def normalize_host(value: str) -> str:
    """Pełny host bez www, w małych literach, IDNA -> ASCII."""
    host = _split_host(value)
    if host.startswith("www."):
        host = host[4:]
    try:
        return host.encode("idna").decode("ascii")
    except UnicodeError:
        return host


def registrable_domain(value: str) -> str:
    """Domena rejestrowalna (np. przyklad.com.pl), albo pusty string, gdy nie da się ustalić."""
    host = normalize_host(value)
    parts = _EXTRACT(host)
    if not parts.domain or not parts.suffix:
        return ""
    return f"{parts.domain}.{parts.suffix}"


def canonical_url(url: str) -> str:
    """https, host bez www, bez fragmentu i parametrów śledzących."""
    parts = urlsplit(url.strip() if "://" in url else "https://" + url.strip())
    host = normalize_host(parts.hostname or "")
    query = [
        (k, v)
        for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if not k.lower().startswith("utm_") and k.lower() not in _TRACKING_PARAMS
    ]
    path = parts.path or "/"
    return urlunsplit(("https", host, path, urlencode(query), ""))


def is_blocklisted(value: str, blocklist: set[str] | frozenset[str]) -> bool:
    """Trafienie, gdy host lub jego domena rejestrowalna jest na liście (z poddomenami)."""
    host = normalize_host(value)
    domain = registrable_domain(value)
    for entry in blocklist:
        entry = entry.lower().lstrip(".")
        if host == entry or host.endswith("." + entry) or domain == entry:
            return True
    return False


# Strony urzędów i instytucji publicznych (BIP, gminy, powiaty, domeny gov.pl). Mają w treści słowo
# "nieruchomości" (sprzedaż mienia gminy, przetargi), więc wyszukiwarka je zwraca, ale to nie biura pośrednictwa.
# .edu.pl celowo pominięte: używają go też firmy (np. twojdom.edu.pl).
_PUBLIC_SUFFIXES = (".gov.pl", ".mil.pl")
_PUBLIC_LABELS = frozenset({"bip", "um", "ug", "umig", "gmina", "powiat", "starostwo", "urzad", "esp", "eurzad"})
_PUBLIC_NAME_PREFIXES = ("bip", "gmina", "powiat", "starostwo", "urzadmiasta", "urzadgminy", "urzadmiejski")


def is_public_institution(value: str) -> bool:
    """Prawda dla adresów urzędów: bip.*, *.bip.*, *.gov.pl, um.*, ug.*, gmina*.pl, powiat*.pl itp."""
    host = normalize_host(value)
    if not host:
        return False
    if host == "gov.pl" or host.endswith(_PUBLIC_SUFFIXES):
        return True
    # Wszystkie człony poza końcówką: um.bydgoszcz.pl ma bydgoszcz.pl na liście sufiksów publicznych,
    # więc "um" jest tu częścią domeny rejestrowalnej, a nie poddomeną.
    domain = registrable_domain(value)
    for label in host.split(".")[:-1]:
        if label in _PUBLIC_LABELS or label.startswith("bip-") or label.endswith("-bip"):
            return True
    name = domain.split(".")[0] if domain else ""
    # "powiatowe-centrum-nieruchomosci" to biuro, nie starostwo.
    return name.startswith(_PUBLIC_NAME_PREFIXES) and "nieruchom" not in name and not name.startswith("powiatow")


_PAGE_HINTS: tuple[tuple[str, int], ...] = (
    ("kontakt", 10),
    ("contact", 10),
    ("o-nas", 8),
    ("o nas", 8),
    ("about", 6),
    ("cennik", 9),
    ("prowizj", 9),
    ("oplat", 6),
    ("opłat", 6),
    ("oferta", 5),
    ("uslugi", 5),
    ("usługi", 5),
    ("wycena", 4),
    ("zespol", 4),
    ("zespół", 4),
    ("sprzedaz", 3),
    ("sprzedaż", 3),
    ("wynajem", 3),
    ("pośrednictwo", 3),
    ("posrednictwo", 3),
)
_SKIP_EXT = re.compile(r"\.(jpg|jpeg|png|gif|webp|svg|ico|css|js|zip|rar|mp4|mp3|docx?|xlsx?)(\?|$)", re.I)


def pick_pages(links: list[tuple[str, str]], base_url: str, limit: int = 8) -> list[str]:
    """Wybiera najbardziej obiecujące podstrony tej samej domeny.

    links: lista (href, tekst kotwicy). Zwraca kanoniczne adresy, najlepsze pierwsze.
    PDF-y z cennikiem są dozwolone, bo zwykle zawierają ceny.
    """
    base_domain = registrable_domain(base_url)
    scored: dict[str, int] = {}
    for href, anchor in links:
        if not href or href.startswith(("mailto:", "tel:", "javascript:", "#")):
            continue
        absolute = urljoin(base_url, href)
        if registrable_domain(absolute) != base_domain:
            continue
        if _SKIP_EXT.search(absolute):
            continue
        haystack = f"{absolute} {anchor}".lower()
        score = sum(weight for hint, weight in _PAGE_HINTS if hint in haystack)
        if absolute.lower().split("?")[0].endswith(".pdf") and ("cennik" in haystack or "prowizj" in haystack):
            score += 5
        if score <= 0:
            continue
        url = canonical_url(absolute)
        scored[url] = max(scored.get(url, 0), score)
    ordered = sorted(scored.items(), key=lambda item: (-item[1], item[0]))
    return [url for url, _ in ordered[:limit]]


# Strony prawne (polityka prywatności, regulamin): zwykle podają NIP administratora. Używamy ich tylko do weryfikacji
# firmy po NIP, nie jako źródła faktów do opisu (mogą zawierać dane osobowe).
_LEGAL_HINTS: tuple[tuple[str, int], ...] = (
    ("prywatn", 3),
    ("privacy", 3),
    ("rodo", 3),
    ("gdpr", 3),
    ("regulamin", 2),
    ("klauzula", 2),
    ("terms", 2),
    ("polityka", 1),
)


def _legal_score(haystack: str) -> int:
    score = sum(weight for hint, weight in _LEGAL_HINTS if hint in haystack)
    if "cookie" in haystack or "ciastecz" in haystack:
        score -= 2  # polityka cookies rzadko zawiera NIP
    return score


def is_legal_url(url: str) -> bool:
    """Czy adres wygląda na stronę prawną (do wykluczenia z danych dla opisów)."""
    return _legal_score(url.lower()) > 0


def pick_legal_pages(links: list[tuple[str, str]], base_url: str, limit: int = 2) -> list[str]:
    """Najbardziej obiecujące strony prawne tej samej domeny, najlepsze pierwsze."""
    base_domain = registrable_domain(base_url)
    scored: dict[str, int] = {}
    for href, anchor in links:
        if not href or href.startswith(("mailto:", "tel:", "javascript:", "#")):
            continue
        absolute = urljoin(base_url, href)
        if registrable_domain(absolute) != base_domain or _SKIP_EXT.search(absolute):
            continue
        if absolute.lower().split("?")[0].endswith(".pdf"):
            continue
        score = _legal_score(f"{absolute} {anchor}".lower())
        if score <= 0:
            continue
        url = canonical_url(absolute)
        scored[url] = max(scored.get(url, 0), score)
    ordered = sorted(scored.items(), key=lambda item: (-item[1], item[0]))
    return [url for url, _ in ordered[:limit]]
