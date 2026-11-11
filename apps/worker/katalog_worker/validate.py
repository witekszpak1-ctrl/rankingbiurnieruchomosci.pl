"""Walidator wyników Claude Code. Decyduje, czy wynik można zaimportować.

Sprawdzamy w kodzie, nie ufamy modelowi:
- schemat i wiązanie z paczką (suma kontrolna),
- każde zdanie opisu opiera się na faktach z paczki (claims -> fact_ids),
- opis nie kopiuje źródła (nakładanie n-gramów),
- cytaty (usługi, ceny) występują w tekście źródłowym z paczki,
- liczby, jednostka i tryb VAT w cenach zgadzają się z cytatem,
- brak kontaktów w opisie i brak niepopartych superlatywów.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

from pydantic import BaseModel, ValidationError

from .bundle import bundle_sha256, contains_contacts
from .extract import price_numbers, tax_hint

# ------------------------------------------------------------------ modele wyniku


class Claim(BaseModel):
    text: str
    fact_ids: list[str]


class DescriptionOut(BaseModel):
    text: str
    claims: list[Claim]


class ServiceOut(BaseModel):
    name: str
    quote: str
    source_url: str


class PriceOut(BaseModel):
    candidate_id: str
    service: str
    unit: Literal["percent", "pln", "pln_per_month", "other"]
    amount_min: float | None = None
    amount_max: float | None = None
    tax_mode: Literal["net", "gross", "plus_vat", "unknown"] = "unknown"
    quote: str
    source_url: str
    conditions: str | None = None


class BrandOut(BaseModel):
    """Nazwa marki tak, jak firma przedstawia się na swojej stronie (zamiast tytułu strony)."""

    name: str
    quote: str
    source_url: str


class DescribeResult(BaseModel):
    schema_version: Literal[1]
    firm_id: str
    bundle_sha256: str
    description: DescriptionOut
    brand: BrandOut | None = None
    services: list[ServiceOut] = []
    prices: list[PriceOut] = []


class Verdict(BaseModel):
    label: Literal["official", "directory", "marketplace", "media", "irrelevant", "parked", "uncertain"]
    reason: str
    evidence_quote: str | None = None


class ClassifyResult(BaseModel):
    schema_version: Literal[1]
    firm_id: str
    bundle_sha256: str
    verdict: Verdict


# ------------------------------------------------------------------ raport


@dataclass
class Issue:
    code: str
    message: str


@dataclass
class Report:
    errors: list[Issue] = field(default_factory=list)
    warnings: list[Issue] = field(default_factory=list)
    metrics: dict = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return not self.errors

    def error(self, code: str, message: str) -> None:
        self.errors.append(Issue(code, message))

    def warn(self, code: str, message: str) -> None:
        self.warnings.append(Issue(code, message))

    def to_dict(self) -> dict:
        return {
            "ok": self.ok,
            "errors": [vars(i) for i in self.errors],
            "warnings": [vars(i) for i in self.warnings],
            "metrics": self.metrics,
        }


# ------------------------------------------------------------------ narzędzia

_SUPERLATIVES = ("najlepsz", "numer 1", "lider ", "gwarantuj", "bezkonkurencyjn", "najtańsz", "najtansz")
_WORD_RE = re.compile(r"\w+", re.UNICODE)
DESCRIPTION_MIN_CHARS = 80
DESCRIPTION_MAX_CHARS = 1400


def _norm(text: str) -> str:
    return " ".join(text.split()).casefold()


def _ngrams(text: str, n: int = 5) -> set[tuple[str, ...]]:
    tokens = _WORD_RE.findall(text.casefold())
    return {tuple(tokens[i : i + n]) for i in range(len(tokens) - n + 1)}


def ngram_overlap(candidate: str, source: str, n: int = 5) -> float:
    """Jaka część n-gramów kandydata występuje w źródle (0.0-1.0)."""
    grams = _ngrams(candidate, n)
    if not grams:
        return 0.0
    return len(grams & _ngrams(source, n)) / len(grams)


def _source_by_url(bundle: dict) -> dict[str, str]:
    return {s["source_url"]: s["text"] for s in bundle.get("source_text", [])}


def _quote_in(quote: str, texts: list[str]) -> bool:
    needle = _norm(quote)
    return bool(needle) and any(needle in _norm(t) for t in texts)


# ------------------------------------------------------------------ walidacja


def _check_binding(bundle: dict, result: BaseModel, report: Report) -> None:
    if result.bundle_sha256 != bundle.get("bundle_sha256"):
        report.error("bundle_mismatch", "Suma kontrolna wyniku nie zgadza się z paczką.")
    if bundle_sha256(bundle) != bundle.get("bundle_sha256"):
        report.error("bundle_tampered", "Paczka została zmieniona po utworzeniu.")
    if result.firm_id != bundle.get("firm_id"):
        report.error("firm_mismatch", "firm_id wyniku nie zgadza się z paczką.")


def _check_description(bundle: dict, result: DescribeResult, max_overlap: float, report: Report) -> None:
    text = result.description.text.strip()
    if not DESCRIPTION_MIN_CHARS <= len(text) <= DESCRIPTION_MAX_CHARS:
        report.error(
            "description_length",
            f"Opis ma {len(text)} znaków, dozwolone {DESCRIPTION_MIN_CHARS}-{DESCRIPTION_MAX_CHARS}.",
        )
    facts = {f["fact_id"]: f for f in bundle.get("facts", [])}
    if not result.description.claims:
        report.error("no_claims", "Opis nie ma przypisanych twierdzeń (claims).")
    joined = " ".join(c.text.strip() for c in result.description.claims)
    if _norm(joined) != _norm(text):
        report.error("claims_text_mismatch", "Treść opisu nie jest równa złączonym twierdzeniom (claims).")
    cited_quotes: list[str] = []
    for claim in result.description.claims:
        if not claim.fact_ids:
            report.error("claim_without_fact", f"Twierdzenie bez faktu: {claim.text[:60]!r}")
        for fact_id in claim.fact_ids:
            if fact_id not in facts:
                report.error("unknown_fact_id", f"Nieznany fact_id {fact_id!r}.")
            else:
                cited_quotes.append(str(facts[fact_id].get("quote", "")).casefold())

    source_all = "\n".join(s["text"] for s in bundle.get("source_text", []))
    fact_text = "\n".join(str(f.get("quote", "")) for f in bundle.get("facts", []))
    overlap = ngram_overlap(text, source_all + "\n" + fact_text)
    report.metrics["ngram_overlap"] = round(overlap, 3)
    if overlap > max_overlap:
        report.error("ngram_overlap", f"Opis zbyt podobny do źródła ({overlap:.2f} > {max_overlap:.2f}).")

    if contains_contacts(text):
        report.error("contact_in_description", "Opis zawiera e-mail lub numer telefonu.")

    lowered = text.casefold()
    for word in _SUPERLATIVES:
        if word in lowered and not any(word in quote for quote in cited_quotes):
            report.error("unsupported_superlative", f"Superlatyw {word.strip()!r} bez poparcia w cytowanym fakcie.")


def _check_brand(bundle: dict, result: DescribeResult, report: Report) -> None:
    brand = result.brand
    if brand is None:
        return
    name = brand.name.strip()
    if not 2 <= len(name) <= 80:
        report.error("brand_name_length", "Nazwa marki musi mieć od 2 do 80 znaków.")
        return
    text = _source_by_url(bundle).get(brand.source_url)
    if text is None:
        report.error("unknown_source", "Nazwa marki: nieznany adres źródła.")
    elif not _quote_in(brand.quote, [text]):
        report.error("quote_not_in_source", "Nazwa marki: cytat nie występuje w źródle.")
    elif _norm(name) not in _norm(brand.quote):
        report.error("brand_not_in_quote", "Nazwa marki musi występować w cytacie.")


def _check_services(bundle: dict, result: DescribeResult, report: Report) -> None:
    sources = _source_by_url(bundle)
    for service in result.services:
        text = sources.get(service.source_url)
        if text is None:
            report.error("unknown_source", f"Usługa {service.name!r}: nieznany adres źródła.")
        elif not _quote_in(service.quote, [text]):
            report.error("quote_not_in_source", f"Usługa {service.name!r}: cytat nie występuje w źródle.")


_TAX_ERROR_MESSAGES = {
    "plus_vat": "Cytat zawiera '+ VAT'.",
    "net": "Cytat zawiera 'netto'.",
    "gross": "Cytat zawiera 'brutto'.",
}


_MANAGEMENT_RE = re.compile(r"zarządza|zarzadza|administrow|obsług[ai] najmu|opieka nad najmem", re.I)
_RENT_RE = re.compile(r"najem|najmu|wynaj|najemc", re.I)
_SALE_RE = re.compile(r"sprzeda|kupn|kupi|zakup|transakc", re.I)


def price_kind(service: str) -> str:
    """Rodzaj ceny z nazwy usługi (zgodnie z apps/web/lib/prices.ts)."""
    if _MANAGEMENT_RE.search(service):
        return "management"
    if _RENT_RE.search(service):
        return "rent_brokerage"
    if _SALE_RE.search(service):
        return "sale"
    return "other"


def implausible_price(service: str, unit: str, values: list[float]) -> str | None:
    """Powód odrzucenia ceny spoza rozsądnego przedziału (zwykle statystyka, rabat albo cena nieruchomości)."""
    kind = price_kind(service)
    if unit == "percent":
        if any(v <= 0 or v > 200 for v in values):
            return "procent poza zakresem 0-200"
        if kind == "sale" and any(v < 0.5 or v > 10 for v in values):
            return "prowizja od sprzedaży poza zakresem 0,5-10%"
        if kind == "management" and any(v < 2 or v > 40 for v in values):
            return "opłata za zarządzanie najmem poza zakresem 2-40%"
    elif unit in ("pln", "pln_per_month") and any(v <= 0 or v >= 1_000_000 for v in values):
        return "kwota poza zakresem (to raczej cena nieruchomości niż usługi)"
    return None


def _check_prices(bundle: dict, result: DescribeResult, report: Report) -> None:
    sources = _source_by_url(bundle)
    candidates = {c["candidate_id"]: c for c in bundle.get("price_candidates", [])}
    for price in result.prices:
        label = f"Cena {price.service!r}"
        candidate = candidates.get(price.candidate_id)
        if candidate is None:
            report.error("unknown_candidate", f"{label}: nieznany candidate_id {price.candidate_id!r}.")
            continue
        haystacks = [candidate["snippet"], sources.get(price.source_url, "")]
        if not _quote_in(price.quote, haystacks):
            report.error("quote_not_in_source", f"{label}: cytat nie występuje w źródle.")
            continue
        percents, amounts = price_numbers(price.quote)
        if price.unit == "percent":
            allowed = percents
        elif price.unit in ("pln", "pln_per_month"):
            allowed = amounts
        else:
            allowed = percents + amounts
        for value in (price.amount_min, price.amount_max):
            if value is not None and not any(abs(value - a) < 1e-9 for a in allowed):
                report.error("amount_not_in_quote", f"{label}: wartość {value} nie występuje w cytacie.")
        if price.amount_min is None and price.amount_max is None:
            report.error("no_amount", f"{label}: brak wartości liczbowej.")
        if (
            price.amount_min is not None
            and price.amount_max is not None
            and price.amount_min > price.amount_max
        ):
            report.error("range_inverted", f"{label}: amount_min większe od amount_max.")
        values = [v for v in (price.amount_min, price.amount_max) if v is not None]
        if values and (why := implausible_price(price.service, price.unit, values)):
            report.error("implausible_amount", f"{label}: {why}. Pomiń tę cenę, jeśli to nie jest stawka za usługę biura.")
        hint = tax_hint(price.quote)
        if hint and price.tax_mode != hint:
            report.error("tax_mode_mismatch", f"{label}: tryb VAT {price.tax_mode!r}. {_TAX_ERROR_MESSAGES[hint]}")
        if hint is None and price.tax_mode != "unknown":
            report.error("tax_mode_unsupported", f"{label}: tryb VAT {price.tax_mode!r} bez poparcia w cytacie.")


def _check_classify(bundle: dict, result: ClassifyResult, report: Report) -> None:
    quote = result.verdict.evidence_quote
    if result.verdict.label != "uncertain" and not quote:
        report.error("no_evidence", "Werdykt inny niż 'uncertain' wymaga cytatu dowodowego.")
    if quote and not _quote_in(quote, [s["text"] for s in bundle.get("source_text", [])]):
        report.error("quote_not_in_source", "Cytat dowodowy nie występuje w źródle.")


def validate_result(bundle: dict, raw_result: dict, max_overlap: float = 0.2) -> Report:
    """Waliduje wynik względem paczki. Typ wyniku wynika z typu paczki."""
    report = Report()
    kind = bundle.get("type")
    model = {"describe": DescribeResult, "classify": ClassifyResult}.get(kind)
    if model is None:
        report.error("unknown_type", f"Nieznany typ paczki: {kind!r}.")
        return report
    try:
        result = model.model_validate(raw_result)
    except ValidationError as exc:
        for err in exc.errors():
            location = ".".join(str(p) for p in err["loc"])
            report.error("schema", f"{location}: {err['msg']}")
        return report

    _check_binding(bundle, result, report)
    if isinstance(result, DescribeResult):
        _check_description(bundle, result, max_overlap, report)
        _check_brand(bundle, result, report)
        _check_services(bundle, result, report)
        _check_prices(bundle, result, report)
    else:
        _check_classify(bundle, result, report)
    return report
