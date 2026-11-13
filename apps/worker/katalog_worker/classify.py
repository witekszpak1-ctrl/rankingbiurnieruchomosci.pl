"""Filtr anty-katalogowy: rozpoznaje, czy strona to oficjalna witryna jednej firmy.

Najpierw tanie reguły (blocklista, sygnały strukturalne i frazowe). Przypadki graniczne dostają etykietę
`uncertain` i trafiają do Claude Code lub do ręcznej weryfikacji.

UWAGA: progi i listy fraz są startowe. Trzeba je skalibrować na zestawie wzorcowym (golden set)
przed włączeniem autopublikacji.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .extract import PageExtraction
from .urls import is_blocklisted, is_public_institution

# Domeny, które nigdy nie są oficjalną stroną jednej firmy. Wartość to etykieta.
DEFAULT_BLOCKLIST: dict[str, str] = {
    "oferteo.pl": "directory",
    "panoramafirm.pl": "directory",
    "pkt.pl": "directory",
    "cylex.pl": "directory",
    "fixly.pl": "directory",
    "aleo.com": "directory",
    "gowork.pl": "directory",
    "opineo.pl": "directory",
    "firmy.net": "directory",
    "zumi.pl": "directory",
    "olx.pl": "marketplace",
    "otodom.pl": "marketplace",
    "domiporta.pl": "marketplace",
    "morizon.pl": "marketplace",
    "gratka.pl": "marketplace",
    "allegro.pl": "marketplace",
    "nieruchomosci-online.pl": "marketplace",
    "facebook.com": "irrelevant",
    "instagram.com": "irrelevant",
    "linkedin.com": "irrelevant",
    "youtube.com": "irrelevant",
    "tiktok.com": "irrelevant",
    "x.com": "irrelevant",
    "twitter.com": "irrelevant",
    "wikipedia.org": "media",
}

_DIRECTORY_PHRASES = (
    "dodaj firmę", "dodaj swoją firmę", "katalog firm", "baza firm", "porównaj oferty",
    "porównywarka", "ranking biur", "najlepsze biura", "lista biur", "opinie o firmie",
    "zobacz więcej firm", "wyszukaj firmę", "sortuj wg", "top 10", "top 5",
)
_MARKETPLACE_PHRASES = (
    "dodaj ogłoszenie", "portal ogłoszeniowy", "szukaj ofert", "znajdź ofertę",
    "zaloguj się aby dodać ogłoszenie", "ogłoszenia nieruchomości",
)
_MEDIA_PHRASES = ("czytaj więcej", "komentarze", "opublikowano", "redakcja", "zobacz także")
_PARKED_PHRASES = (
    "domena jest na sprzedaż", "this domain is for sale", "domena zaparkowana", "kup tę domenę",
    "domain parking", "buy this domain",
)
# Strony z branży, ale nie biura pośrednictwa: rzeczoznawcy, deweloperzy, oprogramowanie dla biur.
# Liczymy tylko mocne znaczniki, bo biura też wspominają o wycenie czy współpracy z deweloperami.
_APPRAISER_PHRASES = ("rzeczoznawca majątkowy", "rzeczoznawcy majątkowi", "rzeczoznawcę majątkowego", "operat szacunkowy",
                      "operaty szacunkowe", "operatu szacunkowego", "uprawnienia zawodowe nr", "biegły sądowy")
_DEVELOPER_PHRASES = ("prospekt informacyjny", "harmonogram budowy", "postęp prac budowlanych", "dziennik budowy",
                      "nasze inwestycje", "zrealizowane inwestycje", "generalny wykonawca", "pozwolenie na budowę uzyskane",
                      "termin oddania inwestycji", "rzuty mieszkań")
_SOFTWARE_PHRASES = ("crm dla biur nieruchomości", "oprogramowanie dla biur", "program dla biur nieruchomości",
                     "wypróbuj za darmo", "darmowy okres próbny", "cennik abonamentów")
_BROKER_PHRASES = ("pośrednictw", "pośrednik", "biuro nieruchomości", "biura nieruchomości", "agencja nieruchomości",
                   "agencji nieruchomości", "umowa pośrednictwa", "umowę pośrednictwa", "prowizj", "licencj")
_ARTICLE_TYPES = {"NewsArticle", "Article", "BlogPosting"}
_URL_DIRECTORY_HINTS = re.compile(r"/(firmy|katalog|ranking|rankingi|porownywarka)(/|$)", re.I)


@dataclass
class Classification:
    label: str  # official | directory | marketplace | media | irrelevant | parked | uncertain
    confidence: float
    reasons: list[str] = field(default_factory=list)


def _count(text: str, phrases: tuple[str, ...]) -> list[str]:
    lowered = text.lower()
    return [p for p in phrases if p in lowered]


def classify_page(
    page: PageExtraction,
    vertical_keywords: tuple[str, ...] | list[str],
    blocklist: dict[str, str] | None = None,
) -> Classification:
    blocklist = DEFAULT_BLOCKLIST if blocklist is None else blocklist
    reasons: list[str] = []

    # 1. blocklista
    for domain, label in blocklist.items():
        if is_blocklisted(page.url, {domain}):
            return Classification(label, 1.0, [f"blocklista: {domain}"])
    if is_public_institution(page.url):
        return Classification("irrelevant", 1.0, ["strona urzędu lub instytucji publicznej (BIP, gmina, gov.pl)"])

    text = f"{page.title}\n{page.meta_description}\n{page.text}"
    lowered = text.lower()

    # 2. domena zaparkowana
    parked = _count(lowered, _PARKED_PHRASES)
    if parked:
        return Classification("parked", 0.9, [f"fraza: {parked[0]}"])

    # 3. sygnały katalogu, marketplace'u i mediów
    directory = 0
    marketplace = 0
    media = 0
    if page.item_list_len >= 5:
        directory += 3
        reasons.append(f"JSON-LD ItemList z {page.item_list_len} elementami")
    org_names = {str(o.get("name")).strip().lower() for o in page.organizations if o.get("name")}
    if len(org_names) >= 4:
        directory += 3
        reasons.append(f"{len(org_names)} różnych firm w JSON-LD")
    if len(page.nips) >= 3:
        directory += 3
        reasons.append(f"{len(page.nips)} różnych NIP-ów na stronie")
    if len(page.outbound_domains) >= 40:
        directory += 1
        reasons.append(f"{len(page.outbound_domains)} linków do różnych domen")
    dir_phrases = _count(lowered, _DIRECTORY_PHRASES)
    if dir_phrases:
        directory += min(3, len(dir_phrases))
        reasons.append(f"frazy katalogowe: {', '.join(dir_phrases[:3])}")
    if _URL_DIRECTORY_HINTS.search(page.url):
        directory += 1
        reasons.append("adres zawiera /firmy/, /katalog/ lub /ranking/")
    mp_phrases = _count(lowered, _MARKETPLACE_PHRASES)
    if mp_phrases:
        marketplace += min(3, 2 * len(mp_phrases))
        reasons.append(f"frazy marketplace: {', '.join(mp_phrases[:3])}")
    if set(page.jsonld_types) & _ARTICLE_TYPES:
        media += 3
        reasons.append("JSON-LD artykułu")
    media_phrases = _count(lowered, _MEDIA_PHRASES)
    if len(media_phrases) >= 2:
        media += 1
        reasons.append("frazy redakcyjne")

    scores = {"directory": directory, "marketplace": marketplace, "media": media}
    top_label, top_score = max(scores.items(), key=lambda item: item[1])
    if top_score >= 3:
        return Classification(top_label, min(1.0, top_score / 6), reasons)

    # 4. trafność względem branży
    keyword_hits = sum(lowered.count(k.lower()) for k in vertical_keywords)
    if keyword_hits == 0:
        return Classification("irrelevant", 0.8, reasons + ["brak słów kluczowych branży"])

    # 4b. branża się zgadza, ale to nie biuro pośrednictwa (najczęstsze pomyłki wyszukiwania)
    broker = len(_count(lowered, _BROKER_PHRASES))
    for label, phrases in (("rzeczoznawca", _APPRAISER_PHRASES), ("deweloper", _DEVELOPER_PHRASES),
                           ("oprogramowanie", _SOFTWARE_PHRASES)):
        hits = _count(lowered, phrases)
        if len(hits) >= 2 and broker < 3:
            return Classification("irrelevant", 0.8, reasons + [f"{label}, nie biuro pośrednictwa: {', '.join(hits[:3])}"])

    # 5. sygnały oficjalnej strony jednej firmy
    official = 0
    if len(page.nips) == 1:
        official += 2
        reasons.append("dokładnie jeden NIP")
    if page.emails or page.phones:
        official += 1
        reasons.append("dane kontaktowe")
    if len(org_names) <= 2:
        official += 1
    if page.postcodes:
        official += 1
        reasons.append("adres z kodem pocztowym")
    if page.title or page.og_site_name:
        official += 1
    if top_score >= 1:
        official -= top_score
        reasons.append("słabe sygnały katalogu")

    if official >= 3 and keyword_hits >= 2:
        return Classification("official", min(1.0, official / 6), reasons)
    return Classification("uncertain", 0.5, reasons)
