"""Pomiary odpowiedzi AI przez LiteScrape do schematu geo (GeoTrace): Gemini, Google AI Mode, Google AI Overview.

Przepływ: biblioteka pytań dla największych miast -> klucz pamięci podręcznej (identyczny jak w apps/geo/lib/measure.ts)
-> świeży pomiar w bazie = ponowne użycie, inaczej jedno płatne zapytanie -> parser odpowiedzi -> wzmianki o firmach
(dopasowane do opublikowanych firm miasta) i cytowane źródła -> jedna transakcja na pomiar.

Kształt zagnieżdżonych pól odpowiedzi LiteScrape (text_blocks, references, ai_overview) nie jest w pełni znany, więc
parsery są tolerancyjne: przechodzą po strukturze rekurencyjnie. Surową odpowiedź zapisuje opcja --save-raw, żeby
można było dopracować parsery bez ponownego płacenia.

Czyste funkcje (hashe, parsery, wzmianki, planowanie) nie dotykają sieci ani bazy i mają testy jednostkowe.
"""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from collections.abc import Iterable
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlsplit

OWN_PORTAL_DOMAIN = "rankingbiurnieruchomosci.pl"
PROVIDER = "litescrape"
LOCATION = "Poland"
LANGUAGE = "pl"
HARD_CAP = 1000  # bezpiecznik na jedno uruchomienie (budżet bez limitu, decyzja właściciela z 28.11.2026)
EXCERPT_CHARS = 2000


# ----------------------------------------------------------------------------- platformy

@dataclass(frozen=True)
class Platform:
    name: str  # wartość geo.measurements.platform
    kind: str  # rodzaj do licznika użycia (litescrape:<kind>)
    path: str
    query_param: str  # nazwa parametru z pytaniem
    params: dict  # stałe parametry (język, kraj)
    mode: str = "ui"
    web_search: bool = True


PLATFORMS: dict[str, Platform] = {
    "gemini": Platform("gemini", "gemini", "/api/google/gemini", "prompt", {"hl": "pl"}),
    "google_ai_mode": Platform("google_ai_mode", "ai_mode", "/api/google/ai-mode", "q", {"gl": "pl", "hl": "pl"}),
    "google_ai_overview": Platform("google_ai_overview", "ai_overview", "/api/google/ai-overview", "q",
                                   {"gl": "pl", "hl": "pl"}),
}


# ----------------------------------------------------------------------------- hashe (identyczne jak w measure.ts)

def normalize_prompt_text(text: str) -> str:
    return re.sub(r"[\s﻿]+", " ", text).strip()


def prompt_hash(text: str) -> str:
    return hashlib.sha256(normalize_prompt_text(text).encode("utf-8")).hexdigest()


def cache_key(prompt_text: str, platform: str, model: str | None = None, mode: str = "ui",
              web_search: bool = True, location: str | None = LOCATION, language: str = LANGUAGE) -> str:
    parts = [
        prompt_hash(prompt_text), platform, model or "", mode, "web" if web_search else "noweb",
        (location or "").lower(), language.lower(),
    ]
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()


def platform_cache_key(prompt_text: str, platform: str) -> str:
    p = PLATFORMS[platform]
    return cache_key(prompt_text, p.name, None, p.mode, p.web_search, LOCATION, LANGUAGE)


# ----------------------------------------------------------------------------- parsery odpowiedzi

@dataclass
class Parsed:
    answer_text: str = ""
    citations: list[tuple[str, str, str | None]] = field(default_factory=list)  # (url, domain, title)
    highlighted: list[str] = field(default_factory=list)


_TEXT_KEYS = ("text", "snippet", "answer", "content", "markdown")
_LIST_KEYS = ("list", "items")
_SKIP_TEXT_KEYS = frozenset({"references", "reference", "sources", "source_links", "links", "web_results",
                             "search_metadata", "search_parameters", "billed"})
_HIGHLIGHT_RE = re.compile(r"\[Początek wyróżnienia\](.*?)\[Koniec wyróżnienia\]", re.S)


def domain_of(url: str) -> str:
    try:
        host = urlsplit(url.strip()).hostname or ""
    except ValueError:
        return ""
    host = host.lower()
    return host[4:] if host.startswith("www.") else host


def _table_to_markdown(table) -> list[str]:
    """Tabela z odpowiedzi (lista wierszy: list komórek albo słowników) jako wiersze markdown."""
    lines = []
    for row in table if isinstance(table, list) else []:
        cells = row if isinstance(row, list) else list(row.values()) if isinstance(row, dict) else []
        cells = [c if isinstance(c, str) else json.dumps(c, ensure_ascii=False) if c is not None else "" for c in cells]
        if cells:
            lines.append("| " + " | ".join(c.strip() for c in cells) + " |")
    return lines


def collect_text(value, out: list[str] | None = None, depth: int = 0) -> list[str]:
    """Teksty z kluczy text/snippet/answer/content/markdown w kolejności występowania (pomija źródła)."""
    out = [] if out is None else out
    if depth > 12:
        return out
    if isinstance(value, str):
        if depth == 0 and value.strip():
            out.append(value)
    elif isinstance(value, dict):
        for key, v in value.items():
            lk = str(key).lower()
            if lk in _SKIP_TEXT_KEYS:
                continue
            if isinstance(v, str):
                if lk in _TEXT_KEYS and v.strip():
                    out.append(v)
            elif lk == "table":
                out.extend(_table_to_markdown(v))
            elif lk in _LIST_KEYS and isinstance(v, list) and any(isinstance(x, str) for x in v):
                out.extend("- " + x for x in v if isinstance(x, str) and x.strip())
                collect_text([x for x in v if not isinstance(x, str)], out, depth + 1)
            else:
                collect_text(v, out, depth + 1)
    elif isinstance(value, list):
        for v in value:
            collect_text(v, out, depth + 1)
    return out


def _dedupe_consecutive(texts: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    out = []
    for t in texts:
        key = t.strip()
        if key and key not in seen:
            seen.add(key)
            out.append(t.strip())
    return out


def collect_citations(value, out: list[tuple[str, str, str | None]] | None = None, seen: set[str] | None = None,
                      depth: int = 0) -> list[tuple[str, str, str | None]]:
    """Słowniki z polem link/url (http) w kolejności występowania, bez powtórzeń adresów."""
    out = [] if out is None else out
    seen = set() if seen is None else seen
    if depth > 12:
        return out
    if isinstance(value, dict):
        url = next((value[k] for k in ("link", "url") if isinstance(value.get(k), str) and value[k].startswith("http")), None)
        if url and url not in seen:
            domain = domain_of(url)
            # Linki Google (wizytówki Map, adres wyszukiwania) to nie źródła odpowiedzi.
            if domain and not re.match(r"^(?:[a-z0-9-]+\.)*google\.[a-z.]+$", domain):
                seen.add(url)
                title = next((str(value[k]).strip() for k in ("title", "source", "name")
                              if isinstance(value.get(k), str) and value[k].strip()), None)
                out.append((url, domain, title[:300] if title else None))
        for k, v in value.items():
            if k in ("search_metadata", "search_parameters"):
                continue
            if isinstance(v, (dict, list)):
                collect_citations(v, out, seen, depth + 1)
    elif isinstance(value, list):
        for v in value:
            collect_citations(v, out, seen, depth + 1)
    return out


def parse_gemini(data: dict) -> Parsed:
    """Gemini: klucz "text" (markdown, często z tabelą firm). Bez cytowań."""
    data = data if isinstance(data, dict) else {}
    text = data.get("text")
    if not isinstance(text, str):
        text = "\n".join(_dedupe_consecutive(collect_text(data)))
    return Parsed(answer_text=text.strip(), citations=[], highlighted=[])


def parse_ai_mode(data: dict) -> Parsed:
    """Google AI Mode: text_blocks (treść) i references (źródła)."""
    data = data if isinstance(data, dict) else {}
    text = "\n\n".join(_dedupe_consecutive(collect_text(data.get("text_blocks"))))
    refs = collect_citations(data.get("references"))
    for extra in (data.get("text_blocks"),):  # linki wplecione w bloki tekstu
        for c in collect_citations(extra):
            if all(c[0] != r[0] for r in refs):
                refs.append(c)
    text, highlighted = _strip_highlights(text)
    return Parsed(answer_text=text, citations=refs, highlighted=highlighted)


def parse_ai_overview(data: dict) -> Parsed:
    """Google AI Overview: ai_overview (może być pusty, gdy Google go nie pokazał) z markerami wyróżnień."""
    data = data if isinstance(data, dict) else {}
    block = data.get("ai_overview")
    if not block:
        return Parsed()
    text = "\n\n".join(_dedupe_consecutive(collect_text(block)))
    refs = collect_citations(block)
    text, highlighted = _strip_highlights(text)
    return Parsed(answer_text=text, citations=refs, highlighted=highlighted)


def _strip_highlights(text: str) -> tuple[str, list[str]]:
    highlighted = []
    for m in _HIGHLIGHT_RE.finditer(text):
        name = re.sub(r"\s+", " ", m.group(1)).strip()
        if name and name not in highlighted:
            highlighted.append(name)
    clean = _HIGHLIGHT_RE.sub(lambda m: m.group(1), text)
    clean = clean.replace("[Początek wyróżnienia]", "").replace("[Koniec wyróżnienia]", "")
    return clean.strip(), highlighted


PARSERS = {"gemini": parse_gemini, "google_ai_mode": parse_ai_mode, "google_ai_overview": parse_ai_overview}


# ----------------------------------------------------------------------------- wzmianki o firmach

@dataclass
class Mention:
    position: int
    name: str
    brand_id: str | None
    match_method: str | None  # name_city | domain | None (kandydat bez dopasowania)
    recommended: bool = False
    domain: str | None = None
    snippet: str | None = None


GENERIC = frozenset({
    "nieruchomosci", "nieruchomosc", "nieruchomosciami", "biuro", "biura", "biurze", "agencja", "agencje", "agencji",
    "posrednictwo", "posrednik", "posrednicy", "obrot", "obrotu", "sp", "z", "o", "oo", "zoo", "spolka", "jawna",
    "komandytowa", "sc", "s", "c", "sa", "sk", "i", "oraz", "firma", "www", "pl", "com", "ltd", "the",
})
_BLOCK_CANDIDATES = frozenset({
    "uwaga", "wazne", "podsumowanie", "cena", "ceny", "prowizja", "koszt", "koszty", "opinie", "ocena", "adres",
    "telefon", "strona", "www", "tak", "nie", "nazwa", "firma", "biuro", "uslugi", "zalety", "wady",
})
_RECOMMEND_RE = re.compile(r"polecam|polecan|godn\w* polecenia|wyrozni|rekomend")
_MIN_SIGNIFICANT = 4


def fold_char(c: str) -> str:
    """Mała litera bez ogonków, zawsze jeden znak (indeksy tekstu po złożeniu zgadzają się z oryginałem)."""
    if c in "łŁ":
        return "l"
    lower = c.lower()
    if len(lower) != 1:
        return c
    base = unicodedata.normalize("NFKD", lower)[:1]
    return base if base.isascii() else lower


def fold(text: str) -> str:
    return "".join(fold_char(c) for c in text)


def significant_tokens(name: str) -> list[str]:
    toks = [t for t in re.split(r"[^a-z0-9]+", fold(name)) if t]
    return [t for t in toks if t not in GENERIC]


def _name_pattern(name: str, original: str | None = None) -> tuple[re.Pattern[str], bool] | None:
    """Wzorzec na tekście po złożeniu znaków: całe słowa istotne w nazwie. None, gdy nazwa za krótka (poniżej 4 znaków)."""
    toks = significant_tokens(name)
    if not toks:
        return None
    joined = "".join(toks)
    if len(joined) >= _MIN_SIGNIFICANT:
        body = r"[^a-z0-9]+".join(re.escape(t) for t in toks)
        return re.compile(rf"(?<![a-z0-9]){body}(?![a-z0-9])"), False
    # Skrót wielkimi literami (np. "ABC") akceptujemy tylko jako dokładny skrót w oryginalnym tekście.
    raw = [t for t in re.split(r"[^\w]+", original or name) if t and fold(t) not in GENERIC]
    if len(raw) == 1 and len(raw[0]) == 3 and raw[0].isupper() and raw[0].isalpha():
        return re.compile(rf"(?<![A-Za-z0-9]){re.escape(raw[0])}(?![A-Za-z0-9])"), True
    return None


@dataclass
class _Brand:
    brand_id: str
    name: str
    domains: list[str]
    pattern: re.Pattern[str] | None
    case_sensitive: bool


def geo_stems(names: Iterable[str]) -> set[str]:
    """Rdzenie nazw miejsc (miasto, dzielnice): "Warszawa" -> "warsz", żeby pasowało też "warszawski", "Warszawie"."""
    stems = set()
    for n in names:
        for t in re.split(r"[^a-z0-9]+", fold(n)):
            if len(t) >= 4:
                stems.add(t[: max(4, len(t) - 2)])
    return stems


def _is_geo(token: str, stems: set[str]) -> bool:
    return any(token.startswith(st) for st in stems)


def _full_pattern(name: str) -> re.Pattern[str] | None:
    """Cała nazwa ze słowami ogólnymi ("Warszawski Pośrednik Nieruchomości"), gdy istotne słowa to same nazwy miejsc."""
    toks = [t for t in re.split(r"[^a-z0-9]+", fold(name)) if t and t not in {"sp", "z", "o", "oo", "zoo", "sc", "s", "c", "sa", "sk"}]
    if len(toks) < 2:
        return None
    body = r"[^a-z0-9]+".join(re.escape(t) for t in toks)
    return re.compile(rf"(?<![a-z0-9]){body}(?![a-z0-9])")


def _prepare_brands(known_brands, stems: set[str] | None = None) -> list[_Brand]:
    out = []
    for brand_id, name, domains in known_brands:
        sig = significant_tokens(name)
        if stems and sig and all(_is_geo(t, stems) for t in sig):
            full = _full_pattern(name)
            out.append(_Brand(str(brand_id), name, [d.lower().removeprefix("www.") for d in (domains or []) if d], full, False))
            continue
        pat = _name_pattern(name)
        out.append(_Brand(str(brand_id), name, [d.lower().removeprefix("www.") for d in (domains or []) if d],
                          pat[0] if pat else None, bool(pat and pat[1])))
    return out


def _brand_spans(brand: _Brand, text: str, folded: str) -> list[tuple[int, int]]:
    if brand.pattern is None:
        return []
    source = text if brand.case_sensitive else folded
    return [m.span() for m in brand.pattern.finditer(source)]


_BOLD_RE = re.compile(r"\*\*(.+?)\*\*", re.S)
_LINK_RE = re.compile(r"\[([^\]]+)\]\([^)]*\)")


def _clean_cell(cell: str) -> str:
    cell = _LINK_RE.sub(r"\1", cell)
    cell = cell.replace("**", "").replace("__", "").replace("`", "")
    return re.sub(r"\s+", " ", cell).strip(" *_:-")


def _table_first_cells(text: str) -> list[str]:
    cells = []
    for line in text.splitlines():
        s = line.strip()
        if not s.startswith("|"):
            continue
        parts = [p.strip() for p in s.strip("|").split("|")]
        if all(re.fullmatch(r":?-{2,}:?", p) or not p for p in parts):
            if cells:  # wiersz separatora: poprzedni wiersz był nagłówkiem
                cells.pop()
            continue
        if parts:
            cells.append(_clean_cell(parts[0]))
    return cells


def _candidate_ok(name: str) -> bool:
    if not (3 <= len(name) <= 80) or not (name[0].isupper() or name[0].isdigit()):
        return False
    if re.search(r"[%]|\bzł\b|\bpln\b", name, re.I) or re.fullmatch(r"[\d\s.,/-]+", name):
        return False
    toks = fold(name)
    if toks.strip(" :.") in _BLOCK_CANDIDATES or not significant_tokens(name):
        return False
    if name.endswith(":") or re.search(r"\bvs\.?\b|\?", name, re.I):
        return False
    # Nazwa własna: najwyżej 5 słów, każde dłuższe słowo zaczyna się wielką literą lub cyfrą
    # (odrzuca śródtytuły typu "Wysokość prowizji", "Umowa otwarta na wyłączność").
    words = [w for w in re.split(r"[\s/&+,-]+", name) if w]
    if len(words) > 5:
        return False
    legal = {"sp", "z", "oo", "zoo", "sc", "sa", "sk", "spk", "spj", "i"}
    return all(not w[0].isalpha() or w[0].isupper() or fold(w).replace(".", "") in legal
               for w in words if len(w) >= 3)


def _line_bounds(text: str, start: int, end: int) -> tuple[int, int]:
    a = text.rfind("\n", 0, start) + 1
    b = text.find("\n", end)
    return a, len(text) if b < 0 else b


def extract_mentions(answer_text: str, highlighted: list[str], known_brands, citations=(), places: Iterable[str] = ()) -> list[Mention]:
    """Firmy wymienione w odpowiedzi, w kolejności pierwszego wystąpienia.

    known_brands: lista (brand_id, nazwa, domeny) opublikowanych firm miasta pytania. Dopasowanie po nazwie: bez wielkości
    liter i ogonków, z pominięciem słów ogólnych (nieruchomości, biuro, sp. z o.o.), co najmniej 4 znaki istotne
    (wyjątek: trzyliterowy skrót wielkimi literami, np. ABC). Kandydaci bez dopasowania (pierwsza kolumna tabeli,
    pogrubienia, wyróżnienia) dostają brand_id None. Cytowania z domeną znanej firmy tworzą albo uzupełniają wzmiankę
    (match_method "domain").
    """
    text = answer_text or ""
    folded = fold(text)
    brands = _prepare_brands(known_brands, geo_stems(places))
    hl = [h for h in (highlighted or []) if h and h.strip()]
    hl_folded = [fold(h) for h in hl]
    bold_spans = [m.span(1) for m in _BOLD_RE.finditer(text)]

    entries: dict[str, dict] = {}  # klucz -> {order, name, brand_id, method, rec, domain, spans}

    def entry(key: str, name: str, brand_id: str | None, method: str | None, order: int) -> dict:
        e = entries.get(key)
        if e is None:
            e = entries[key] = {"order": order, "name": name, "brand_id": brand_id, "method": method, "rec": False,
                                "domain": None, "spans": []}
        else:
            e["order"] = min(e["order"], order)
        return e

    def recommended_at(start: int, end: int) -> bool:
        a, b = _line_bounds(text, start, end)
        line = text[a:b]
        if line.lstrip().startswith("|"):
            return True
        if any(s <= start and end <= e for s, e in bold_spans):
            return True
        # słowa polecenia w tym samym zdaniu (granice: kropka, wykrzyknik, pytajnik, nowa linia)
        a = max((folded.rfind(c, 0, start) for c in ".!?\n"), default=-1) + 1
        ends = [i for i in (folded.find(c, end) for c in ".!?\n") if i >= 0]
        return bool(_RECOMMEND_RE.search(folded[a:min(ends) if ends else len(folded)]))

    # 1. firmy z katalogu znalezione po nazwie w tekście
    for brand in brands:
        spans = _brand_spans(brand, text, folded)
        if not spans:
            continue
        e = entry("b:" + brand.brand_id, text[spans[0][0]:spans[0][1]], brand.brand_id, "name_city", spans[0][0])
        e["spans"] = spans
        e["rec"] = any(recommended_at(s, t) for s, t in spans)
        if brand.pattern is not None and any(brand.pattern.search(fold(h) if not brand.case_sensitive else h) for h in hl):
            e["rec"] = True

    # 2. kandydaci: pierwsza kolumna tabeli, pogrubienia, wyróżnienia
    candidates: list[tuple[str, str]] = []  # (nazwa, źródło)
    candidates += [(c, "table") for c in _table_first_cells(text)]
    candidates += [(_clean_cell(m.group(1)), "bold") for m in _BOLD_RE.finditer(text)]
    candidates += [(_clean_cell(h), "highlight") for h in hl]
    seen_names: set[str] = set()
    for name, source in candidates:
        if not _candidate_ok(name):
            continue
        key_name = fold(name)
        if key_name in seen_names:
            continue
        seen_names.add(key_name)
        idx = folded.find(key_name)
        order = idx if idx >= 0 else len(text) + len(entries)
        matched = next((b for b in brands if b.pattern is not None
                        and b.pattern.search(name if b.case_sensitive else key_name)), None)
        if matched is not None:
            e = entry("b:" + matched.brand_id, name, matched.brand_id, "name_city", order)
            if not e["spans"]:
                e["name"] = name
        else:
            e = entry("n:" + key_name, name, None, None, order)
            if idx >= 0:
                e["spans"] = [(idx, idx + len(key_name))]
        e["rec"] = e["rec"] or source in ("table", "bold", "highlight")

    # 3. cytowania z domeną znanej firmy
    base = len(text) + len(entries) + 1
    for i, cit in enumerate(citations or []):
        domain = cit[1]
        for brand in brands:
            if any(domain == d or domain.endswith("." + d) for d in brand.domains):
                e = entry("b:" + brand.brand_id, brand.name, brand.brand_id, "domain", base + i)
                e["method"] = "domain"
                e["domain"] = e["domain"] or domain
                break

    ordered = sorted(entries.values(), key=lambda e: e["order"])
    mentions = []
    for pos, e in enumerate(ordered, 1):
        snippet = None
        if e["spans"]:
            a, b = _line_bounds(text, *e["spans"][0])
            line = re.sub(r"\s+", " ", text[a:b]).strip(" |")
            snippet = line[:300] or None
        mentions.append(Mention(pos, e["name"][:200], e["brand_id"], e["method"], bool(e["rec"]), e["domain"], snippet))
    return mentions


# ----------------------------------------------------------------------------- biblioteka pytań

# Miejscownik z przyimkiem dla największych miast (pełny słownik jest w apps/web/lib/cities.ts). Pozostałe miasta
# dostają formy bez przyimka ("... Gliwice").
LOCATIVE = {
    "Warszawa": "w Warszawie", "Kraków": "w Krakowie", "Łódź": "w Łodzi", "Wrocław": "we Wrocławiu",
    "Poznań": "w Poznaniu", "Gdańsk": "w Gdańsku", "Szczecin": "w Szczecinie", "Bydgoszcz": "w Bydgoszczy",
    "Lublin": "w Lublinie", "Białystok": "w Białymstoku", "Katowice": "w Katowicach", "Gdynia": "w Gdyni",
    "Częstochowa": "w Częstochowie", "Radom": "w Radomiu", "Rzeszów": "w Rzeszowie", "Toruń": "w Toruniu",
    "Sosnowiec": "w Sosnowcu", "Kielce": "w Kielcach", "Gliwice": "w Gliwicach", "Olsztyn": "w Olsztynie",
    "Opole": "w Opolu", "Zabrze": "w Zabrzu", "Bielsko-Biała": "w Bielsku-Białej", "Sopot": "w Sopocie",
}

# (intencja, szablon z miejscownikiem, szablon bez przyimka); kolejność = priorytet przy --per-city-prompts.
TEMPLATES = [
    ("recommendation", "jakie biuro nieruchomości polecacie {loc}", "polecane biuro nieruchomości {city}"),
    ("recommendation", "najlepsze biuro nieruchomości {city}", "najlepsze biuro nieruchomości {city}"),
    ("price", "ile kosztuje pośrednik nieruchomości {loc}", "prowizja pośrednika nieruchomości {city}"),
    ("comparison", "które biuro nieruchomości {loc} ma najlepsze opinie", "biuro nieruchomości {city} opinie"),
]


def city_places(city: str, industry: str = "nieruchomosci") -> list[str]:
    """Miasto i jego dzielnice z pakietu branży (packages/verticals/<branża>/districts.json), do odróżniania nazw firm
    od nazw miejsc ("Nieruchomości Wilanów" nie może pasować do samego słowa "Wilanów")."""
    from .verticals import verticals_dir

    places = [city]
    try:
        data = json.loads((verticals_dir() / industry / "districts.json").read_text(encoding="utf-8"))
        places += [d for d in data.get(city, []) if isinstance(d, str)]
    except (OSError, ValueError):
        pass
    return places


def library_prompts(industry: str = "nieruchomosci", cities: Iterable[str] = ()) -> list[dict]:
    """Pytania biblioteki: dla każdego miasta lista słowników {text, industry, city, intent} w kolejności priorytetu."""
    out = []
    for city in cities:
        loc = LOCATIVE.get(city)
        for intent, with_loc, without in TEMPLATES:
            template = with_loc if loc else without
            out.append({"text": template.format(loc=loc, city=city), "industry": industry, "city": city, "intent": intent})
    return out


# ----------------------------------------------------------------------------- planowanie i uruchomienie

@dataclass
class PlanItem:
    city: str
    city_id: str | None
    text: str
    intent: str
    industry: str
    platform: str
    cache_key: str
    cached_id: str | None = None


def build_plan(store, cities: list[dict], industry: str, platforms: list[str], per_city: int,
               max_age_days: int) -> list[PlanItem]:
    """Plan: miasto -> pytanie -> platforma. Świeży pomiar w bazie oznacza ponowne użycie (bez zapytania)."""
    plan = []
    for city in cities:
        prompts = library_prompts(industry, [city["name"]])[:max(0, per_city)]
        for p in prompts:
            for platform in platforms:
                key = platform_cache_key(p["text"], platform)
                plan.append(PlanItem(city["name"], city.get("id"), p["text"], p["intent"], industry, platform, key,
                                     store.fresh_measurement(key, max_age_days)))
    return plan


def _save_raw(directory: Path | None, item: PlanItem, params: dict, data) -> str | None:
    if directory is None:
        return None
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{item.platform}-{item.cache_key[:16]}.json"
    payload = {"prompt": item.text, "platform": item.platform, "city": item.city, "params": params, "response": data}
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    return str(path)


def measure_item(client, item: PlanItem) -> tuple[Parsed, dict, dict]:
    """Jedno płatne zapytanie. Zwraca (sparsowana odpowiedź, parametry, surowa odpowiedź)."""
    platform = PLATFORMS[item.platform]
    params = {platform.query_param: item.text, **platform.params}
    data = client._get(platform.kind, platform.path, params, retries=1, timeout=120.0)
    return PARSERS[item.platform](data), params, data


MAX_FAILED_IN_ROW = 3  # tyle nieudanych pomiarów z rzędu kończy przebieg (awaria dostawcy), bez zapisu kolejnych wierszy


def run(store, client, *, industry: str = "nieruchomosci", cities: int = 3, platforms: list[str] | None = None,
        per_city: int = 2, max_calls: int = 20, max_age_days: int = 7, save_raw: Path | None = None,
        dry_run: bool = False) -> dict:
    """Pomiary dla największych miast. client może być None tylko przy dry_run."""
    from .litescrape import LiteScrapeError, LiteScrapeUnavailable

    platforms = platforms or list(PLATFORMS)
    unknown = [p for p in platforms if p not in PLATFORMS]
    if unknown:
        raise ValueError(f"Nieznana platforma: {', '.join(unknown)} (dozwolone: {', '.join(PLATFORMS)})")
    cap = max(0, min(max_calls, HARD_CAP))
    city_rows = store.top_cities(cities)
    plan = build_plan(store, city_rows, industry, platforms, per_city, max_age_days)
    report: dict = {
        "cities": [c["name"] for c in city_rows], "cap": cap, "planned": len(plan),
        "cache_hits": sum(1 for i in plan if i.cached_id), "dry_run": dry_run,
    }
    to_call = [i for i in plan if not i.cached_id]
    report["to_call"] = len(to_call)
    if dry_run:
        report["plan"] = [
            {"city": i.city, "platform": i.platform, "prompt": i.text, "cached": bool(i.cached_id)} for i in plan
        ]
        report["calls_over_cap"] = max(0, len(to_call) - cap)
        return report

    if client is None:
        raise ValueError("Brak klienta LiteScrape (potrzebny klucz w panelu /admin/koszty).")
    calls = done = failed = streak = 0
    results = []
    brands_cache: dict[str, list] = {}
    for item in to_call:
        if calls >= cap or not client.available:
            report["stopped"] = "limit zapytań" if calls >= cap else "LiteScrape niedostępny"
            break
        calls += 1
        try:
            parsed, params, data = measure_item(client, item)
        except LiteScrapeUnavailable as exc:
            report["stopped"] = str(exc)[:200]
            break
        except LiteScrapeError as exc:
            store.save_measurement(item, None, [], status="failed", error=str(exc)[:500])
            failed += 1
            streak += 1
            results.append({"city": item.city, "platform": item.platform, "status": "failed", "error": str(exc)[:200]})
            if streak >= MAX_FAILED_IN_ROW:
                report["stopped"] = f"seria błędów ({streak} z rzędu), przerwano bez dalszych zapisów"
                break
            continue
        streak = 0
        raw_path = _save_raw(save_raw, item, params, data)
        if item.city_id not in brands_cache:
            brands_cache[item.city_id] = store.known_brands(item.city_id) if item.city_id else []
        mentions = extract_mentions(parsed.answer_text, parsed.highlighted, brands_cache[item.city_id], parsed.citations,
                                    city_places(item.city, item.industry))
        store.save_measurement(item, parsed, mentions, status="done", error=None)
        done += 1
        results.append({"city": item.city, "platform": item.platform, "status": "done", "chars": len(parsed.answer_text),
                        "mentions": len(mentions), "citations": len(parsed.citations), "raw": raw_path})
    report.update({"calls": calls, "done": done, "failed": failed, "results": results})
    return report


# ----------------------------------------------------------------------------- baza

class GeoStore:
    """Dostęp do bazy: miasta i firmy z katalogu (public) oraz pomiary w schemacie geo."""

    def __init__(self, conn, vertical_slug: str = "nieruchomosci") -> None:
        self.conn = conn
        self.vertical = vertical_slug

    def top_cities(self, n: int) -> list[dict]:
        rows = self.conn.execute(
            """select c.id, c.name, count(*) as listings
               from listings l join cities c on c.id = l.city_id join verticals v on v.id = l.vertical_id
               where l.status = 'published' and v.slug = %s
               group by c.id, c.name order by listings desc, c.name limit %s""",
            (self.vertical, max(0, n)),
        ).fetchall()
        self.conn.commit()
        return [{"id": str(r["id"]), "name": r["name"], "listings": r["listings"]} for r in rows]

    def known_brands(self, city_id: str) -> list[tuple[str, str, list[str]]]:
        rows = self.conn.execute(
            """select b.id, b.name, coalesce(array_agg(distinct d.host) filter (where d.host is not null), '{}') as hosts
               from listings l join brands b on b.id = l.brand_id join verticals v on v.id = l.vertical_id
               left join domains d on d.brand_id = b.id
               where l.status = 'published' and l.city_id = %s and v.slug = %s
               group by b.id, b.name""",
            (city_id, self.vertical),
        ).fetchall()
        self.conn.commit()
        return [(str(r["id"]), r["name"], list(r["hosts"])) for r in rows]

    def fresh_measurement(self, key: str, max_age_days: int) -> str | None:
        row = self.conn.execute(
            """select id from geo.measurements
               where cache_key = %s and status = 'done' and measured_at > now() - make_interval(days => %s)
               order by measured_at desc limit 1""",
            (key, max_age_days),
        ).fetchone()
        self.conn.commit()
        return str(row["id"]) if row else None

    def upsert_prompt(self, text: str, industry: str, city: str, intent: str) -> str:
        norm = normalize_prompt_text(text)
        row = self.conn.execute(
            """insert into geo.prompts (text, text_hash, language, industry, city, intent, source)
               values (%s, %s, %s, %s, %s, %s, 'template')
               on conflict (text_hash, language) do update set industry = coalesce(geo.prompts.industry, excluded.industry),
                 city = coalesce(geo.prompts.city, excluded.city), intent = coalesce(geo.prompts.intent, excluded.intent)
               returning id""",
            (norm, prompt_hash(norm), LANGUAGE, industry, city, intent),
        ).fetchone()
        return str(row["id"])

    def save_measurement(self, item: PlanItem, parsed: Parsed | None, mentions: list[Mention], *, status: str,
                         error: str | None) -> str:
        """Pytanie, pomiar, wzmianki i cytowania w jednej transakcji."""
        platform = PLATFORMS[item.platform]
        answer = parsed.answer_text if parsed else ""
        with self.conn.transaction():
            prompt_id = self.upsert_prompt(item.text, item.industry, item.city, item.intent)
            row = self.conn.execute(
                """insert into geo.measurements (prompt_id, platform, model, mode, web_search, location, language, provider,
                       cache_key, status, error, answer_excerpt, answer_hash, measured_at, cost_usd)
                   values (%s, %s, null, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                           case when %s = 'done' then now() end, null) returning id""",
                (prompt_id, platform.name, platform.mode, platform.web_search, LOCATION, LANGUAGE, PROVIDER, item.cache_key,
                 status, error, answer[:EXCERPT_CHARS] if parsed else None,
                 hashlib.sha256(answer.encode("utf-8")).hexdigest() if parsed else None, status),
            ).fetchone()
            mid = row["id"]
            for m in mentions:
                self.conn.execute(
                    """insert into geo.mentions (measurement_id, position, name, domain, brand_id, match_method, recommended, snippet)
                       values (%s, %s, %s, %s, %s, %s, %s, %s)""",
                    (mid, m.position, m.name, m.domain, m.brand_id, m.match_method, m.recommended, m.snippet),
                )
            for pos, (url, domain, title) in enumerate(parsed.citations if parsed else [], 1):
                self.conn.execute(
                    """insert into geo.citations (measurement_id, position, url, domain, title, is_own_portal)
                       values (%s, %s, %s, %s, %s, %s)""",
                    (mid, pos, url[:2000], domain[:253], title, domain == OWN_PORTAL_DOMAIN),
                )
        self.conn.commit()
        return str(mid)
