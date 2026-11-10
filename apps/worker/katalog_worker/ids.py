"""Identyfikatory firm: NIP, REGON, KRS. Walidacja sum kontrolnych i wyszukiwanie w tekście."""

from __future__ import annotations

import re
from dataclasses import dataclass

_NIP_WEIGHTS = (6, 5, 7, 2, 3, 4, 5, 6, 7)
_REGON9_WEIGHTS = (8, 9, 2, 3, 4, 5, 6, 7)
_REGON14_WEIGHTS = (2, 4, 8, 5, 0, 9, 7, 3, 6, 1, 2, 4, 8)


def digits_only(raw: str | None) -> str:
    return re.sub(r"\D", "", raw or "")


def normalize_nip(raw: str | None) -> str | None:
    """Zwraca 10 cyfr albo None. Akceptuje separatory i prefiks PL."""
    text = (raw or "").strip().upper()
    if text.startswith("PL"):
        text = text[2:]
    digits = digits_only(text)
    return digits if len(digits) == 10 else None


def is_valid_nip(nip: str | None) -> bool:
    if not nip or not re.fullmatch(r"\d{10}", nip):
        return False
    total = sum(w * int(d) for w, d in zip(_NIP_WEIGHTS, nip[:9]))
    check = total % 11
    return check != 10 and check == int(nip[9])


def is_valid_regon(regon: str | None) -> bool:
    if not regon or not re.fullmatch(r"\d{9}|\d{14}", regon):
        return False
    weights = _REGON9_WEIGHTS if len(regon) == 9 else _REGON14_WEIGHTS
    total = sum(w * int(d) for w, d in zip(weights, regon[:-1]))
    check = (total % 11) % 10
    if check != int(regon[-1]):
        return False
    if len(regon) == 14:
        return is_valid_regon(regon[:9])
    return True


def normalize_krs(raw: str | None) -> str | None:
    digits = digits_only(raw)
    if not digits or len(digits) > 10:
        return None
    return digits.zfill(10)


@dataclass(frozen=True)
class IdHit:
    value: str
    context: str


# Słowo kluczowe, potem do ~15 znaków nie-cyfr, potem blok cyfr z separatorami.
_NIP_KEYED = re.compile(
    r"(?i)\bNIP\b[^0-9A-Za-z]{0,15}(?:PL\s?)?(?P<num>\d[\d\-\s]{8,16}\d)"
)
# Numer VAT UE: PL1234567890
_NIP_VATEU = re.compile(r"\bPL[\s\-]?(?P<num>\d{3}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}|\d{10})\b")
_REGON_KEYED = re.compile(r"(?i)\bREGON\b[^0-9A-Za-z]{0,15}(?P<num>\d[\d\-\s]{7,17}\d)")
_KRS_KEYED = re.compile(r"(?i)\bKRS\b[^0-9A-Za-z]{0,15}(?P<num>\d{4,10})")


def _context(text: str, start: int, end: int, radius: int = 60) -> str:
    return " ".join(text[max(0, start - radius) : end + radius].split())


def find_nips(text: str) -> list[IdHit]:
    """Zwraca unikalne, poprawne sumą kontrolną NIP-y znalezione przy słowie NIP lub z prefiksem PL.

    Gołe 10-cyfrowe liczby bez słowa kluczowego są ignorowane (zbyt wiele numerów telefonów).
    """
    hits: dict[str, IdHit] = {}
    for pattern in (_NIP_KEYED, _NIP_VATEU):
        for match in pattern.finditer(text):
            nip = digits_only(match.group("num"))
            if is_valid_nip(nip) and nip not in hits:
                hits[nip] = IdHit(nip, _context(text, match.start(), match.end()))
    return list(hits.values())


def find_regons(text: str) -> list[IdHit]:
    hits: dict[str, IdHit] = {}
    for match in _REGON_KEYED.finditer(text):
        regon = digits_only(match.group("num"))
        if is_valid_regon(regon) and regon not in hits:
            hits[regon] = IdHit(regon, _context(text, match.start(), match.end()))
    return list(hits.values())


def find_krs(text: str) -> list[IdHit]:
    hits: dict[str, IdHit] = {}
    for match in _KRS_KEYED.finditer(text):
        krs = normalize_krs(match.group("num"))
        if krs and krs not in hits:
            hits[krs] = IdHit(krs, _context(text, match.start(), match.end()))
    return list(hits.values())
