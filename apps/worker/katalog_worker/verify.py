"""Weryfikacja, że domena należy do konkretnego podmiotu z rejestru.

Twarda bramka: status `verified` wymaga zgodności NIP ze strony z NIP z rejestru.
Wynik 0-100 służy do sortowania kolejki ręcznej weryfikacji, nie zastępuje bramki.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from difflib import SequenceMatcher

from .classify import Classification
from .extract import PageExtraction

_LEGAL_FORM_TOKENS = {
    "sp", "z", "o", "oo", "spolka", "ograniczona", "odpowiedzialnoscia", "sa", "s", "a", "sc", "jawna",
    "komandytowa", "komandytowo", "akcyjna", "akcyjne", "firma", "przedsiebiorstwo", "usługowe",
    "uslugowe", "handlowe", "k", "j", "p", "zoo", "ltd", "gmbh",
}


@dataclass
class RegistryView:
    """Minimalny widok rekordu rejestru potrzebny do weryfikacji."""

    nip: str
    name: str
    active: bool | None = None  # None = nieznane
    postcode: str | None = None
    city: str | None = None
    pkd_codes: list[str] = field(default_factory=list)


@dataclass
class Verification:
    score: int
    status: str  # verified | probable | needs_review | rejected | candidate
    matched_nip: str | None
    reasons: list[str] = field(default_factory=list)


def _ascii(text: str) -> str:
    text = text.replace("ł", "l").replace("Ł", "L")
    return "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))


def normalize_name(name: str) -> str:
    """Małe litery, bez diakrytyków i interpunkcji, bez form prawnych."""
    cleaned = re.sub(r"[^a-z0-9 ]+", " ", _ascii(name).lower())
    tokens = [t for t in cleaned.split() if t not in _LEGAL_FORM_TOKENS]
    return " ".join(tokens)


def name_similarity(a: str, b: str) -> float:
    na, nb = normalize_name(a), normalize_name(b)
    if not na or not nb:
        return 0.0
    seq = SequenceMatcher(None, na, nb).ratio()
    ta, tb = set(na.split()), set(nb.split())
    jaccard = len(ta & tb) / len(ta | tb) if ta | tb else 0.0
    return max(seq, jaccard)


def name_in_text(name: str, text: str) -> bool:
    """Czy wszystkie istotne człony nazwy z rejestru występują w tekście (np. imię i nazwisko JDG)."""
    tokens = normalize_name(name).split()
    if len(tokens) < 2:
        return False
    haystack = set(re.sub(r"[^a-z0-9 ]+", " ", _ascii(text).lower()).split())
    return all(t in haystack for t in tokens)


def _page_names(pages: list[PageExtraction]) -> list[str]:
    names: list[str] = []
    for page in pages:
        for value in (page.title, page.og_site_name):
            if value:
                names.append(value)
                # tytuły mają zwykle postać "Nazwa | opis" lub "Opis - Nazwa"
                names.extend(part.strip() for part in re.split("[|:" + chr(0x2d) + chr(0x2013) + chr(0x2014) + "]", value) if part.strip())
        names.extend(str(o["name"]) for o in page.organizations if o.get("name"))
    return names


def verify_domain(
    registry: RegistryView | None,
    pages: list[PageExtraction],
    classification: Classification,
    vertical_keywords: tuple[str, ...] | list[str] = (),
    expected_pkd: tuple[str, ...] | list[str] = (),
) -> Verification:
    reasons: list[str] = []

    if classification.label not in ("official", "uncertain"):
        return Verification(0, "rejected", None, [f"klasyfikacja: {classification.label}"])

    nips_found: dict[str, int] = {}
    for page in pages:
        for hit in page.nips:
            nips_found[hit.value] = nips_found.get(hit.value, 0) + 1
    if len(nips_found) >= 3:
        return Verification(0, "rejected", None, [f"{len(nips_found)} różnych NIP-ów na stronie (katalog?)"])

    if registry is None:
        if nips_found:
            return Verification(0, "candidate", None, ["znaleziono NIP, czeka na dane z rejestru"])
        return Verification(0, "needs_review", None, ["brak NIP na stronie i brak danych z rejestru"])

    if registry.active is False:
        return Verification(0, "rejected", None, ["podmiot nieaktywny lub wykreślony w rejestrze"])

    score = 0
    matched = registry.nip in nips_found
    if matched:
        score += 50
        reasons.append("NIP ze strony zgodny z rejestrem")
        if nips_found[registry.nip] >= 2:
            score += 5
            reasons.append("NIP na co najmniej dwóch podstronach")
    elif nips_found:
        reasons.append("na stronie jest inny NIP niż w rejestrze")
        score -= 20

    if registry.active:
        score += 10
        reasons.append("podmiot aktywny w rejestrze")

    all_text = "\n".join(p.text for p in pages)
    similarity = max((name_similarity(registry.name, n) for n in _page_names(pages)), default=0.0)
    if similarity >= 0.8:
        score += 15
    elif similarity >= 0.6:
        score += 10
    elif similarity >= 0.4:
        score += 5
    if name_in_text(registry.name, all_text):
        score += 12 if similarity < 0.8 else 0
        reasons.append("nazwa z rejestru występuje w tekście strony")
    if similarity:
        reasons.append(f"podobieństwo nazwy {similarity:.2f}")

    page_postcodes = {h.postcode for p in pages for h in p.postcodes}
    page_cities = {_ascii(h.city).lower() for p in pages for h in p.postcodes}
    if registry.postcode and registry.postcode in page_postcodes:
        score += 10
        reasons.append("kod pocztowy zgodny z rejestrem")
    elif registry.city and _ascii(registry.city).lower() in page_cities:
        score += 6
        reasons.append("miasto zgodne z rejestrem")

    if vertical_keywords:
        lowered = all_text.lower()
        if any(k.lower() in lowered for k in vertical_keywords):
            score += 5
    if expected_pkd and registry.pkd_codes:
        if set(registry.pkd_codes) & set(expected_pkd):
            score += 5
            reasons.append("PKD zgodny z branżą")
        else:
            reasons.append("PKD rejestru nie obejmuje branży")

    score = max(0, min(100, score))

    if matched and score >= 75 and classification.label == "official":
        status = "verified"
    elif matched:
        status = "needs_review"
    elif similarity >= 0.6 and score >= 40 and not nips_found:
        status = "probable"
    elif score >= 20:
        status = "needs_review"
    else:
        status = "rejected"
    return Verification(score, status, registry.nip if matched else None, reasons)
