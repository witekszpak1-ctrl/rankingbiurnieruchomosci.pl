"""Nazwy firm: odrzucanie nazw, które nie są nazwą biura, i szukanie lepszej (etap 3 planu poprawy).

Strona biura bywa zatytułowana "Strona główna", "Home" albo samym adresem domeny. Taka nazwa nie może trafić
do katalogu. Robot próbuje wtedy kolejnych źródeł: nazwa z danych strony (og:site_name, dane strukturalne),
najczęstszy człon tytułów podstron, początek opisu ("X to biuro..."), nazwa z rejestru. Gdy żadne nie daje
dobrej nazwy, wpis nie trafia do katalogu.
"""

from __future__ import annotations

import re
from collections import Counter
from collections.abc import Iterable

from .city import fold

# Nazwy będące nazwą strony, a nie firmy (po ujednoliceniu znaków i wielkości liter).
GENERIC_NAMES = frozenset({
    "strona glowna", "glowna", "home", "home page", "homepage", "start", "witamy", "welcome", "index", "kontakt",
    "o nas", "oferta", "oferty", "nasze oferty", "uslugi", "zespol", "blog", "aktualnosci", "strona w budowie",
    "untitled", "default", "biuro nieruchomosci", "agencja nieruchomosci", "nieruchomosci", "biuro", "firma",
    "posrednictwo", "posrednictwo w obrocie nieruchomosciami", "na sprzedaz", "na wynajem", "sprzedaz", "wynajem",
    "polityka prywatnosci", "regulamin", "mieszkania", "domy", "dzialki", "lokale",
})
# Katalogi firm i portale: wpis z takiej domeny to strona katalogu, nie biura.
CATALOG_DOMAINS = frozenset({
    "indexfirm.pl", "panoramafirm.pl", "pkt.pl", "cylex.pl", "aleo.com", "firmy.net", "zumi.pl", "oferteo.pl",
    "gowork.pl", "otodom.pl", "olx.pl", "morizon.pl", "gratka.pl", "domiporta.pl", "nieruchomosci-online.pl",
    "adresowo.pl", "sprzedajemy.pl", "lento.pl", "tablica.pl",
})
_DOMAIN_LIKE = re.compile(r"^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$")
# Separatory członów tytułu: |, •, ·, dwukropek, myślniki z odstępami (także półpauza i pauza).
_TITLE_SEPARATORS = re.compile(r"\s*[|•·:]\s*|\s+[-–—]\s+")
_LEGAL_FORMS = re.compile(
    r"\b(sp(o|ó)(l|ł)ka z ograniczon(a|ą) odpowiedzialno(s|ś)ci(a|ą)|sp(o|ó)(l|ł)ka komandytowa|sp(o|ó)(l|ł)ka jawna|"
    r"sp(o|ó)(l|ł)ka cywilna|sp(o|ó)(l|ł)ka akcyjna|sp\.? ?z ?o\.? ?o\.?|sp\.? ?k\.?|s\.? ?c\.?|s\.? ?a\.?)\s*$",
    re.IGNORECASE,
)


def registrable_domain(host: str) -> str:
    """Domena bez subdomen: "nieruchomosci-ursus.indexfirm.pl" -> "indexfirm.pl", "x.com.pl" -> "x.com.pl"."""
    labels = host.lower().removeprefix("www.").strip(".").split(".")
    if len(labels) >= 3 and labels[-2] in {"com", "net", "org", "info", "biz", "co", "waw", "krakow"}:
        return ".".join(labels[-3:])
    return ".".join(labels[-2:])


def is_catalog_host(host: str | None) -> bool:
    return bool(host) and registrable_domain(host) in CATALOG_DOMAINS


def is_bad_name(name: str | None, host: str | None = None) -> bool:
    """Czy nazwa nie nadaje się na nazwę biura w katalogu."""
    if not name or len(name.strip()) < 3:
        return True
    stripped = name.strip()
    folded = " ".join(fold(stripped).replace("-", " ").split())
    if folded in GENERIC_NAMES or folded.startswith("strona glowna"):
        return True
    if _DOMAIN_LIKE.match(stripped):
        return True  # sam adres strony małymi literami ("officelist.pl"); "Mieszkanie.com" czy "GRUPA.PRO" zostają
    return False


def title_segments(title: str) -> list[str]:
    return [s.strip() for s in _TITLE_SEPARATORS.split(title or "") if s and s.strip()]


def name_from_titles(titles: Iterable[str], host: str | None = None) -> str | None:
    """Najczęstszy człon tytułów podstron, który wygląda na nazwę (pojawia się co najmniej dwa razy)."""
    counts: Counter = Counter()
    for title in titles:
        for seg in dict.fromkeys(title_segments(title)):
            if 3 <= len(seg) <= 60 and not is_bad_name(seg, host) and sum(ch.isdigit() for ch in seg) <= 2:
                counts[seg] += 1
    best = [(n, seg) for seg, n in counts.most_common() if n >= 2]
    return best[0][1] if best else None


def name_from_description(body: str | None, host: str | None = None) -> str | None:
    """Nazwa z początku opisu: "Home Estate to sieć..." -> "Home Estate"."""
    match = re.match(r"\s*(.{3,60}?)\s+to\s", body or "")
    if not match:
        return None
    name = match.group(1).strip()
    return None if is_bad_name(name, host) else name


def name_from_registry(name: str | None) -> str | None:
    """Nazwa z rejestru bez formy prawnej, w zwykłej pisowni: "HOME ASSET SPÓŁKA Z O.O." -> "Home Asset"."""
    if not name:
        return None
    cleaned = _LEGAL_FORMS.sub("", name.strip().strip('"')).strip(' ,."')
    cleaned = cleaned.replace('"', "").strip()
    if not cleaned:
        return None
    pretty = cleaned.title() if cleaned.isupper() else cleaned
    return None if is_bad_name(pretty) else pretty


# Słowa rozpoznawane w adresie domeny ("pasjanieruchomosci.pl" -> "Pasja Nieruchomości").
_DOMAIN_WORDS = {
    "nieruchomosci": "Nieruchomości", "nieruchomosc": "Nieruchomość", "immo": "Immo", "estate": "Estate",
    "invest": "Invest", "home": "Home", "house": "House", "dom": "Dom", "domy": "Domy", "biuro": "Biuro",
    "agencja": "Agencja", "partner": "Partner", "partners": "Partners", "group": "Group", "grupa": "Grupa",
    "mieszkania": "Mieszkania", "posrednictwo": "Pośrednictwo", "realestate": "Real Estate",
}


def name_from_domain(host: str | None) -> str | None:
    """Nazwa z domeny, gdy zawiera rozpoznawalne słowo: "hegesnieruchomosci.pl" -> "Heges Nieruchomości".

    Bez rozpoznanego słowa (np. "bnhit.pl") zwraca None, bo nie da się podzielić nazwy na słowa.
    """
    if not host:
        return None
    label = registrable_domain(host).split(".")[0]
    parts: list[str] = []
    for chunk in re.split(r"[-_]+", label):
        rest = chunk
        words: list[str] = []
        while rest:
            hit = next(((w, rest.index(w)) for w in sorted(_DOMAIN_WORDS, key=len, reverse=True) if w in rest), None)
            if not hit:
                words.append(rest)
                break
            word, at = hit
            if at:
                words.append(rest[:at])
            words.append(_DOMAIN_WORDS[word])
            rest = rest[at + len(word):]
        parts.extend(words)
    if not any(p in _DOMAIN_WORDS.values() for p in parts) or len(parts) < 2:
        return None
    pretty: list[str] = []
    for i, p in enumerate(parts):
        if p in _DOMAIN_WORDS.values():
            pretty.append(p)
        elif i > 0 and p.startswith("w") and len(p) > 5 and parts[i - 1] in _DOMAIN_WORDS.values():
            pretty.append("w " + p[1:].capitalize())  # "nieruchomosciwbeskidach" -> "Nieruchomości w Beskidach"
        else:
            pretty.append(p.upper() if len(p) <= 3 and p.isalpha() else p.capitalize())
    name = " ".join(x for x in pretty if x)
    return None if is_bad_name(name) else name


def better_name(
    current: str | None,
    host: str | None,
    titles: Iterable[str] = (),
    description: str | None = None,
    registry_name: str | None = None,
) -> tuple[str | None, str]:
    """Nowa nazwa i jej źródło dla firmy o złej nazwie; (None, "brak") gdy nie ma dobrej."""
    for source, candidate in (
        ("tytuły stron", name_from_titles(titles, host)),
        ("opis", name_from_description(description, host)),
        ("rejestr", name_from_registry(registry_name)),
        ("domena", name_from_domain(host)),
    ):
        if candidate and candidate != (current or "").strip():  # "officelist.pl" -> "Officelist.pl" to też poprawa
            return candidate, source
    return None, "brak"
