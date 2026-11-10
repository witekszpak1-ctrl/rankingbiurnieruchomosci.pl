"""Generowanie zapytań: macierz branża x specjalizacja x miasto oraz zapytania o konkretny podmiot."""

from __future__ import annotations

import itertools

from .verticals import SearchConfig
from .verify import normalize_name


def build_queries(search: SearchConfig, city: str, limit: int | None = None) -> list[str]:
    """Zapytania dla miasta z szablonów. Bez duplikatów, kolejność z szablonów zachowana."""
    seen: set[str] = set()
    queries: list[str] = []
    cap = limit if limit is not None else search.max_queries_per_city
    for template in search.templates:
        needs_synonym = "{synonym}" in template
        needs_spec = "{specialization}" in template
        synonyms = search.synonyms if needs_synonym else [""]
        specs = search.specializations if needs_spec else [""]
        for synonym, spec in itertools.product(synonyms, specs):
            query = " ".join(template.format(synonym=synonym, specialization=spec, city=city).split())
            key = query.casefold()
            if key in seen:
                continue
            seen.add(key)
            queries.append(query)
            if len(queries) >= cap:
                return queries
    return queries


def entity_queries(name: str, city: str, keyword: str = "nieruchomości") -> list[str]:
    """Zapytania, które mają znaleźć stronę konkretnego podmiotu z rejestru."""
    cleaned = " ".join(name.split())
    brand = normalize_name(name)  # bez form prawnych i diakrytyków, tylko do kontroli pustej nazwy
    queries = [f'"{cleaned}" {city}']
    if brand:
        queries.append(f"{cleaned} {city} {keyword}")
    return queries
