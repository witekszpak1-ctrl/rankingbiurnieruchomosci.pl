"""Paczki dla Claude Code (kolejka plikowa).

Zasady:
- w paczce NIE MA e-maili ani numerów telefonów (minimalizacja danych, opis ich nie potrzebuje),
- tekst źródłowy jest przycięty i zredagowany, a walidator sprawdza cytaty właśnie względem niego,
- paczka ma sumę kontrolną, którą wynik musi powtórzyć (wiązanie wyniku z paczką).
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path

from .extract import PageExtraction

SCHEMA_VERSION = 1

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}")
_PHONE_RE = re.compile(r"(?<![\d-])(?:\+|00)?(?:48[\s\-]?)?(?:\d[\s\-]?){8}\d(?![\d-])")


def redact_contacts(text: str) -> str:
    """Zastępuje e-maile i numery telefonów znacznikami. Sama liczba 9 cyfr też jest zasłaniana."""
    text = _EMAIL_RE.sub("[e-mail]", text)
    return _PHONE_RE.sub("[telefon]", text)


def contains_contacts(text: str) -> bool:
    return bool(_EMAIL_RE.search(text) or _PHONE_RE.search(text))


def _truncate(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    cut = text[:max_chars]
    newline = cut.rfind("\n")
    return cut[:newline] if newline > max_chars * 0.6 else cut


def canonical_json(data: dict) -> str:
    return json.dumps(data, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def bundle_sha256(bundle: dict) -> str:
    body = {k: v for k, v in bundle.items() if k != "bundle_sha256"}
    return hashlib.sha256(canonical_json(body).encode("utf-8")).hexdigest()


@dataclass
class Fact:
    type: str
    value: object
    quote: str
    source_url: str
    db_id: str | None = None


def facts_from_pages(pages: list[PageExtraction]) -> list[Fact]:
    """Fakty deterministyczne ze stron (bez kontaktów). Każdy ma cytat i adres źródła."""
    facts: list[Fact] = []
    seen: set[tuple[str, str]] = set()

    def add(type_: str, value: str, quote: str, url: str) -> None:
        key = (type_, value)
        if value and key not in seen:
            seen.add(key)
            # Tytuły i opisy meta często zawierają telefon ("Biuro XYZ, tel. 71 ..."), więc redagujemy też wartość.
            facts.append(Fact(type_, redact_contacts(value), redact_contacts(quote), url))

    for page in pages:
        if page.meta_description:
            add("meta_description", page.meta_description, page.meta_description, page.url)
        if page.title:
            add("site_title", page.title, page.title, page.url)
        for org in page.organizations:
            address = org.get("address") or {}
            parts = [address.get("street"), address.get("postcode"), address.get("city")]
            joined = ", ".join(str(p) for p in parts if p)
            if joined:
                add("address", joined, joined, page.url)
        for hit in page.postcodes[:2]:
            add("address_hint", f"{hit.postcode} {hit.city}", hit.context, page.url)
    return facts


def build_describe_bundle(
    *,
    vertical: str,
    firm_id: str,
    name: str,
    city: str,
    pages: list[PageExtraction],
    registry_facts: list[Fact] | None = None,
    preset_facts: list[Fact] | None = None,
    max_chars_per_page: int = 9000,
    max_pages: int = 8,
) -> dict:
    """Buduje paczkę typu `describe` (opis, usługi, ceny)."""
    if preset_facts is not None:
        all_facts = list(preset_facts)  # fakty już zapisane w bazie (z db_id)
    else:
        all_facts = list(registry_facts or []) + facts_from_pages(pages)
    facts = []
    for index, fact in enumerate(all_facts, start=1):
        facts.append(
            {
                "fact_id": f"f{index}",
                "type": fact.type,
                "value": redact_contacts(fact.value) if isinstance(fact.value, str) else fact.value,
                "quote": redact_contacts(fact.quote) if isinstance(fact.quote, str) else fact.quote,
                "source_url": fact.source_url,
                "db_id": fact.db_id,
            }
        )

    source_text = []
    price_candidates = []
    for page in pages[:max_pages]:
        source_text.append(
            {"source_url": page.url, "text": _truncate(redact_contacts(page.text), max_chars_per_page)}
        )
        for candidate in page.price_candidates:
            price_candidates.append(
                {
                    "candidate_id": f"p{len(price_candidates) + 1}",
                    "source_url": page.url,
                    "snippet": redact_contacts(candidate.snippet),
                    "percents": candidate.percents,
                    "amounts_pln": candidate.amounts_pln,
                    "tax_hint": candidate.tax_hint,
                }
            )

    bundle = {
        "schema_version": SCHEMA_VERSION,
        "type": "describe",
        "firm_id": firm_id,
        "vertical": vertical,
        "name": redact_contacts(name),
        "city": city,
        "facts": facts,
        "source_text": source_text,
        "price_candidates": price_candidates,
    }
    bundle["bundle_sha256"] = bundle_sha256(bundle)
    return bundle


def build_classify_bundle(
    *, vertical: str, firm_id: str, url: str, page: PageExtraction, reasons: list[str], max_chars: int = 6000
) -> dict:
    """Paczka typu `classify`: czy ta strona to oficjalna witryna jednej firmy."""
    bundle = {
        "schema_version": SCHEMA_VERSION,
        "type": "classify",
        "firm_id": firm_id,
        "vertical": vertical,
        "url": url,
        "heuristic_reasons": reasons,
        "signals": {
            "distinct_nips": len(page.nips),
            "organizations_in_jsonld": len(page.organizations),
            "item_list_len": page.item_list_len,
            "outbound_domains": len(page.outbound_domains),
            "jsonld_types": page.jsonld_types,
        },
        "source_text": [
            {"source_url": url, "text": _truncate(redact_contacts(page.text), max_chars)}
        ],
    }
    bundle["bundle_sha256"] = bundle_sha256(bundle)
    return bundle


class ContactLeakError(ValueError):
    """Paczka zawiera e-mail lub telefon. Komunikat wymienia pola, nigdy ich treści."""

    def __init__(self, fields: list[str]):
        self.fields = fields
        super().__init__(f"Paczka zawiera e-mail lub telefon w polach: {', '.join(fields)}. Zredaguj dane przed zapisem.")


def contact_fields(bundle: dict) -> list[str]:
    """Ścieżki pól z treścią, w których jest e-mail lub telefon (do logów, bez wartości)."""
    found: list[str] = []
    for key in ("name", "city", "url"):
        if contains_contacts(str(bundle.get(key, ""))):
            found.append(key)
    for fact in bundle.get("facts", []):
        for part in ("value", "quote"):
            if contains_contacts(str(fact.get(part, ""))):
                found.append(f"facts[{fact.get('fact_id')}:{fact.get('type')}].{part}")
    for i, source in enumerate(bundle.get("source_text", [])):
        if contains_contacts(str(source.get("text", ""))):
            found.append(f"source_text[{i}].text")
    for candidate in bundle.get("price_candidates", []):
        if contains_contacts(str(candidate.get("snippet", ""))):
            found.append(f"price_candidates[{candidate.get('candidate_id')}].snippet")
    return found


def write_bundle(bundle: dict, queue_dir: Path) -> Path:
    """Zapisuje paczkę do queue/pending/<typ>/<firm_id>.json. Odmawia, gdy w paczce są kontakty."""
    # Każde pole osobno: w sklejonym tekście cyfry z końca jednego pola i początku następnego
    # potrafiły razem wyglądać jak numer telefonu, choć żadne pole go nie zawierało.
    leaks = contact_fields(bundle)
    if leaks:
        raise ContactLeakError(leaks)
    target = queue_dir / "pending" / bundle["type"] / f"{bundle['firm_id']}.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(bundle, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return target
