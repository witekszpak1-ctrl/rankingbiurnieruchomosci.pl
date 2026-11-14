"""Miasto wpisu ustalane z dowodów (etap 2 planu poprawy, docs/rozpoznanie.md punkt 3).

Kolejność źródeł, pierwsze trafienie wygrywa:
1. adres biura na stronie (kod pocztowy z miastem) zgodny z miastem wyszukiwania,
2. siedziba z rejestru zgodna z adresem na stronie,
3. siedziba z rejestru (KRS, wykaz podatników VAT),
4. adres biura na stronie (najczęstszy),
5. miasto wyszukiwania wymienione na stronie (dokładna nazwa albo jej odmiana; z ostrzeżeniem),
6. brak pewnego źródła: miasto niepotwierdzone, firma nie trafia do rankingu żadnego miasta.

Nazwy miast porównujemy dokładnie (całe słowa po ujednoliceniu znaków), nigdy po samym początku nazwy:
"ul. Warszawska" to nie Warszawa, a "Lubliniec" to nie Lublin.
"""

from __future__ import annotations

import re
import unicodedata
from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass, field

# Źródła miasta zapisywane w listings.city_source.
SOURCE_ADDRESS_SEARCH = "adres_wyszukiwanie"
SOURCE_REGISTRY_ADDRESS = "rejestr_adres"
SOURCE_REGISTRY = "rejestr"
SOURCE_ADDRESS = "adres"
SOURCE_MENTION = "wzmianka"
SOURCE_NONE = "brak"

SOURCE_LABEL = {
    SOURCE_ADDRESS_SEARCH: "adres biura na stronie zgodny z wyszukiwaniem",
    SOURCE_REGISTRY_ADDRESS: "rejestr zgodny z adresem na stronie",
    SOURCE_REGISTRY: "siedziba z rejestru",
    SOURCE_ADDRESS: "adres biura na stronie",
    SOURCE_MENTION: "miasto wymienione na stronie",
    SOURCE_NONE: "brak pewnego źródła",
}

# Cudze adresy, które strony biur podają w polityce prywatności albo stopce: UODO (ul. Stawki 2, 00-193 Warszawa),
# firmy przetwarzające dane. Takiego adresu nie traktujemy jako biura.
_INSTITUTIONAL_POSTCODES = frozenset({"00-193"})
_INSTITUTIONAL_WORDS = ("uodo", "ochrony danych", "przetwarz", "prezes urzedu", "stawki 2", "organ nadzorczy")
# Słowa doklejane przez wyrażenie regularne po nazwie miasta ("30-102 Kraków Polska E-mail").
_ADDRESS_STOP_WORDS = frozenset({"polska", "poland", "tel", "telefon", "e", "email", "mail", "nip", "regon", "krs", "fax",
                                 "kontakt", "godziny", "ul", "biuro", "pon", "czynne"})


def fold(text: str) -> str:
    text = text.replace("ł", "l").replace("Ł", "L")
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()


def tokens(text: str) -> list[str]:
    return [t for t in re.split(r"[^a-z0-9]+", fold(text)) if t]


@dataclass
class AddressHit:
    postcode: str
    city: str
    context: str = ""


@dataclass
class CityDecision:
    city: str | None
    source: str
    warnings: list[str] = field(default_factory=list)
    postcode: str | None = None  # kod pocztowy adresu, z którego wzięto miasto (do sprawdzenia z kodami miasta)


# Skróty w adresach: "66-400 Gorzów Wlkp.", "05-825 Grodzisk Maz.".
_ABBREVIATIONS = {"wlkp": "wielkopolski", "wielkop": "wielkopolski", "maz": "mazowiecki", "mazow": "mazowiecki",
                  "sl": "slaski", "gd": "gdanski", "kuj": "kujawski", "pom": "pomorski", "lub": "lubelski",
                  "opol": "opolski", "tryb": "trybunalski", "swietokrz": "swietokrzyski"}


# Drugi człon nazwy innej miejscowości: "Brzeg Dolny" to nie Brzeg, "Góra Kalwaria" to nie Góra,
# "Rawa Mazowiecka" to nie Rawa. Dzielnica po nazwie miasta ("Warszawa Mokotów") takim członem nie jest.
_NAME_PARTS = frozenset({"dolny", "dolna", "dolne", "gorny", "gorna", "gorne", "wielki", "wielka", "wielkie", "maly",
                         "mala", "male", "zdroj", "kalwaria", "slaski", "slaska", "slaskie", "kujawski", "lodzki"})
_NAME_PART_ENDINGS = ("ski", "ska", "skie", "cki", "cka", "ckie", "dzki", "dzka")


def _continues_name(tok: str) -> bool:
    return tok in _NAME_PARTS or (len(tok) > 4 and tok.endswith(_NAME_PART_ENDINGS))


def office_cities(hits: Iterable[AddressHit]) -> list[list[str]]:
    """Miasta z adresów biura (jako listy tokenów), bez adresów instytucji i firm przetwarzających dane."""
    return [tokens_ for _, tokens_, _ in _offices(hits)]


def _offices(hits: Iterable[AddressHit]) -> list[tuple[str, list[str], str]]:
    """Jak office_cities, z kodem pocztowym i oryginalną pisownią miasta z każdego adresu."""
    out: list[tuple[str, list[str], str]] = []
    for hit in hits:
        context = fold(hit.context)
        if hit.postcode in _INSTITUTIONAL_POSTCODES or any(w in context for w in _INSTITUTIONAL_WORDS):
            continue
        city_tokens: list[str] = []
        for i, tok in enumerate(tokens(hit.city)):
            if tok in _ADDRESS_STOP_WORDS:
                break
            city_tokens.append(_ABBREVIATIONS.get(tok, tok) if i > 0 else tok)
        if city_tokens:
            out.append((hit.postcode, city_tokens[:3], hit.city))
    return out


def _same_city(name: str | None, address_tokens: list[str]) -> bool:
    """Czy adres (tokeny po kodzie pocztowym) to dokładnie to miasto: "Kraków" pasuje do "Kraków", nie do "Krakówka"."""
    if not name:
        return False
    want = tokens(name)
    if not want:
        return False
    if address_tokens[: len(want)] == want:
        # "Brzeg" nie pasuje do adresu "Brzeg Dolny": dalszy człon nazwy oznacza inną miejscowość.
        return not (len(address_tokens) > len(want) and _continues_name(address_tokens[len(want)]))
    # "Gorzów" bez drugiego członu w adresie to Gorzów Wielkopolski (gdy adres ma tylko pierwsze słowo nazwy).
    return len(want) > 1 and address_tokens == want[:1]


def _city_key(address_tokens: list[str], known: dict[tuple[str, ...], str]) -> tuple[str, ...]:
    """Najdłuższa znana nazwa miasta na początku adresu, inaczej pierwsze słowo."""
    for n in range(min(3, len(address_tokens)), 0, -1):
        if tuple(address_tokens[:n]) in known:
            if n < len(address_tokens) and _continues_name(address_tokens[n]):
                break  # "Brzeg Dolny" przy znanym tylko "Brzeg": inna miejscowość, spoza listy znanych
            return tuple(address_tokens[:n])
    if len(address_tokens) > 1 and _continues_name(address_tokens[1]):
        return tuple(address_tokens[:2])
    # Samo pierwsze słowo pasujące do dokładnie jednej znanej nazwy wielowyrazowej ("gorzow" -> Gorzów Wielkopolski).
    longer = [k for k in known if len(k) > 1 and k[0] == address_tokens[0]]
    if len(address_tokens) == 1 and len(longer) == 1:
        return longer[0]
    return tuple(address_tokens[:1])


def _display_name(address_tokens: list[str], known: dict[tuple[str, ...], str]) -> str:
    """Nazwa miasta z adresu: najdłuższa znana nazwa pasująca do początku adresu, inaczej pierwsze słowo."""
    name = known.get(tuple(address_tokens))
    if name:
        return name
    for n in range(min(3, len(address_tokens)), 0, -1):
        name = known.get(tuple(address_tokens[:n]))
        if name and not (n < len(address_tokens) and _continues_name(address_tokens[n])):
            return name
    if len(address_tokens) > 1 and _continues_name(address_tokens[1]):
        return " ".join(t.capitalize() for t in address_tokens[:2])  # spoza listy znanych: trafi do przeglądu
    return address_tokens[0].capitalize()


def city_warnings(city: str | None, brand_name: str, host: str, known: dict[tuple[str, ...], str]) -> list[str]:
    """Sygnały do ręcznego przeglądu: nazwa innego miasta w nazwie biura lub adresie strony, zagraniczna domena."""
    warnings: list[str] = []
    chosen = tuple(tokens(city or ""))
    host_tokens = tokens(host.replace(".", " ").replace("-", " "))
    for label, words in (("nazwie biura", tokens(brand_name)), ("adresie strony", host_tokens)):
        for name_tokens, name in known.items():
            if name_tokens == chosen or len(name_tokens[0]) < 4:
                continue
            n = len(name_tokens)
            glued = label == "adresie strony" and n == 1 and len(name_tokens[0]) >= 6 and any(
                name_tokens[0] in w for w in words)  # "nieruchomoscijaslo.pl"
            if glued or any(tuple(words[i : i + n]) == name_tokens for i in range(len(words) - n + 1)):
                warnings.append(f"inne miasto w {label}: {name}")
                break
    labels = host.lower().rstrip(".").split(".")
    if len(labels) >= 2:
        tld = labels[-1]
        if len(tld) == 2 and tld not in {"pl", "eu"}:
            warnings.append(f"zagraniczna domena: .{tld}")
    return warnings


def decide_city(
    registry_city: str | None,
    city_hint: str | None,
    page_text: str,
    address_hits: Iterable[AddressHit],
    known: dict[tuple[str, ...], str] | None = None,
    brand_name: str = "",
    host: str = "",
) -> CityDecision:
    """Miasto wpisu według kolejności źródeł z opisu modułu. `known`: znane nazwy miast (tokeny -> nazwa)."""
    from .pipeline import offer_mentions_city  # dokładne dopasowanie z odmianą (w Karpaczu, w Lublinie)

    known = known or {}
    with_codes = _offices(address_hits)
    offices = [o for _, o, _ in with_codes]
    registry = registry_city.strip().title() if registry_city and registry_city.strip() else None
    hint = city_hint.strip() if city_hint and city_hint.strip() else None

    def code_for(name: str) -> str | None:
        return next((code for code, o, _ in with_codes if _same_city(name, o)), None)

    if hint and any(_same_city(hint, o) for o in offices):
        decision = CityDecision(hint, SOURCE_ADDRESS_SEARCH, postcode=code_for(hint))
    elif registry and any(_same_city(registry, o) for o in offices):
        decision = CityDecision(registry, SOURCE_REGISTRY_ADDRESS, postcode=code_for(registry))
    elif registry:
        decision = CityDecision(registry, SOURCE_REGISTRY)
    elif offices:
        counts = Counter(_city_key(o, known) for o in offices)
        best = max(counts.items(), key=lambda kv: (kv[1], len(kv[0])))[0]
        code, raw = next(((c, r) for c, o, r in with_codes if _city_key(o, known) == best), (None, ""))
        name = _display_name(list(best), known)
        words = re.split(r"[\s,]+", raw.strip())
        if tuple(best) not in known and len(words) >= len(best):
            name = " ".join(w[:1].upper() + w[1:] for w in words[: len(best)])  # pisownia z adresu, z polskimi znakami
        decision = CityDecision(name, SOURCE_ADDRESS, postcode=code)
    elif hint and offer_mentions_city(tokens(page_text), tokens(hint)):
        decision = CityDecision(hint, SOURCE_MENTION, ["miasto tylko z wzmianki na stronie"])
    else:
        return CityDecision(None, SOURCE_NONE, ["brak adresu na stronie i wpisu w rejestrze"])
    decision.warnings += city_warnings(decision.city, brand_name, host, known)
    return decision


def known_cities(names: Iterable[str]) -> dict[tuple[str, ...], str]:
    return {tuple(tokens(n)): n for n in names if tokens(n)}


def parse_address_fact(value: str, quote: str = "") -> AddressHit | None:
    """Fakt "30-102 Kraków" (z cytatem) jako AddressHit."""
    match = re.match(r"\s*(\d{2}-\d{3})\s+(.+)", value or "")
    if not match:
        return None
    return AddressHit(match.group(1), match.group(2).strip(), quote or "")
