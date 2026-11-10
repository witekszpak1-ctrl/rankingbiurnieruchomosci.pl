"""Generuje db/seeds/dev.sql: fikcyjne dane do lokalnego rozwoju (strona i panel). NIE używać na produkcji.

Użycie: python3 db/seeds/generate_dev_seed.py > db/seeds/dev.sql
Firmy są wymyślone, domeny w TLD .example (zarezerwowanym, nie istnieje w sieci), NIP-y mają poprawną sumę kontrolną.
"""

from __future__ import annotations

import json
import uuid

NS = uuid.UUID("6f0f5d0e-0000-4000-8000-00000000d3ad")
WEIGHTS = (6, 5, 7, 2, 3, 4, 5, 6, 7)


def slugify(text: str) -> str:
    import re
    import unicodedata

    text = text.replace("ł", "l").replace("Ł", "L")
    folded = "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", folded.lower()).strip("-")


def uid(*parts: str) -> str:
    return str(uuid.uuid5(NS, "/".join(parts)))


def nip_from(seed: int) -> str:
    base = f"{600000000 + seed * 7919:09d}"
    check = sum(w * int(d) for w, d in zip(WEIGHTS, base)) % 11
    if check == 10:
        return nip_from(seed + 1000)
    return base + str(check)


def q(text: str | None) -> str:
    return "null" if text is None else "'" + text.replace("'", "''") + "'"


def jb(value) -> str:
    return q(json.dumps(value, ensure_ascii=False)) + "::jsonb"


SERVICES = [
    "sprzedaż mieszkań", "wynajem mieszkań", "sprzedaż domów", "nieruchomości komercyjne",
    "wycena nieruchomości", "obsługa prawna transakcji",
]

# (nazwa, miasto, slug_miasta, rok startu, liczba usług, prowizja % lub None, tryb VAT, wynik weryfikacji, status wpisu, opis)
FIRMS = [
    ("Alfa Nieruchomości", "Wrocław", "wroclaw", 2008, 5, 2.0, "net", 96, "published",
     "Wrocławskie biuro pośredniczące w sprzedaży i wynajmie mieszkań oraz domów. Na stronie podaje wysokość prowizji i zakres obsługi transakcji."),
    ("Beta Pośrednictwo", "Wrocław", "wroclaw", 2015, 3, 3.0, "plus_vat", 88, "published",
     "Agencja skupiona na mieszkaniach na rynku wtórnym we Wrocławiu. Jawnie opisuje stawkę prowizji i sposób rozliczenia."),
    ("Gamma Dom", "Wrocław", "wroclaw", 2019, 2, None, None, 82, "published",
     "Niewielkie biuro obsługujące najem długoterminowy i sprzedaż lokali we Wrocławiu. Cennik ustala indywidualnie."),
    ("Delta Estate", "Wrocław", "wroclaw", 2011, 6, 2.5, "plus_vat", 91, "published",
     "Biuro o szerokiej ofercie: od mieszkań i domów po lokale użytkowe i wyceny. Prowizję od sprzedaży publikuje w cenniku."),
    ("Epsilon Nieruchomości", "Wrocław", "wroclaw", 2021, 1, None, None, 79, "published",
     "Młode biuro koncentrujące się na wynajmie mieszkań we Wrocławiu. Brak jawnego cennika na stronie."),
    ("Zeta Invest", "Wrocław", "wroclaw", 2005, 4, 1.8, "net", 93, "published",
     "Wieloletnie biuro pośredniczące w transakcjach na rynku mieszkaniowym i komercyjnym. Podaje niską stawkę prowizji z adnotacją o podatku."),
    ("Eta Mieszkania", "Wrocław", "wroclaw", 2017, 3, 2.2, "net", 85, "verified",
     "Biuro specjalizujące się w mieszkaniach na sprzedaż. Wpis zweryfikowany, oczekuje na publikację."),
    ("Theta Biuro", "Wrocław", "wroclaw", 2013, 2, None, None, 58, "needs_review",
     "Wpis wymaga ręcznej weryfikacji."),
    ("Kappa Nieruchomości", "Kraków", "krakow", 2010, 4, 2.4, "plus_vat", 90, "published",
     "Krakowskie biuro obsługujące sprzedaż i wynajem mieszkań w centrum i na obrzeżach miasta."),
    ("Lambda Dom", "Kraków", "krakow", 2016, 3, None, None, 84, "published",
     "Agencja nieruchomości z Krakowa działająca głównie na rynku wynajmu."),
]


def main() -> None:
    out: list[str] = []
    w = out.append
    w("-- WYGENEROWANE przez generate_dev_seed.py. Fikcyjne dane deweloperskie, NIE stosować na produkcji.")
    w("begin;")
    vid = uid("vertical", "nieruchomosci")
    w(f"insert into verticals (id, slug, name, domain) values ('{vid}', 'nieruchomosci', 'Biura nieruchomości', 'rankingbiurnieruchomosci.pl') on conflict (id) do nothing;")
    cities: dict[str, str] = {}
    for _, city, slug, *_rest in FIRMS:
        if slug not in cities:
            cities[slug] = uid("city", slug)
            w(f"insert into cities (id, name, slug) values ('{cities[slug]}', {q(city)}, '{slug}') on conflict (id) do nothing;")

    for index, (name, city, city_slug, year, n_services, percent, tax, score, status, description) in enumerate(FIRMS, start=1):
        key = slugify(name)
        le, brand, dom, listing = uid("le", key), uid("brand", key), uid("domain", key), uid("listing", key)
        host = key + ".example"
        nip = nip_from(index)
        w(
            "insert into legal_entities (id, nip, name, legal_form, entity_kind, vat_status, start_date, pkd_main, pkd_codes, "
            f"registered_address, registry_source, registry_synced_at) values ('{le}', '{nip}', {q(name.upper() + ' SP. Z O.O.')}, "
            f"'SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ', 'spolka', 'Czynny', '{year}-03-01', '68.31.Z', array['68.31.Z'], "
            f"{jb({'street': 'UL. PRZYKŁADOWA ' + str(index), 'postcode': '50-001', 'city': city.upper()})}, 'krs', now()) on conflict (id) do nothing;"
        )
        w(f"insert into brands (id, legal_entity_id, name, slug) values ('{brand}', '{le}', {q(name)}, '{key}') on conflict (id) do nothing;")
        d_status = {"published": "verified", "verified": "verified", "needs_review": "needs_review"}[status]
        reasons = ["NIP ze strony zgodny z rejestrem", "kod pocztowy zgodny z rejestrem"] if d_status == "verified" else [
            "na stronie jest inny NIP niż w rejestrze", "miasto zgodne z rejestrem"]
        w(
            "insert into domains (id, host, canonical_url, city_hint, brand_id, legal_entity_id, classification, verification_score, "
            f"verification_reasons, verification_status, robots_status) values ('{dom}', '{host}', 'https://{host}/', {q(city)}, '{brand}', '{le}', "
            f"'official', {score}, {jb(reasons)}, '{d_status}', 'allowed') on conflict (id) do nothing;"
        )
        l_status = {"published": "published", "verified": "verified", "needs_review": "needs_review"}[status]
        published = "now() - interval '2 days'" if status == "published" else "null"
        noindex = "false" if status == "published" else "true"
        slug_value = q(key) if status == "published" else "null"
        w(
            "insert into listings (id, brand_id, vertical_id, city_id, status, slug, noindex, published_at) values "
            f"('{listing}', '{brand}', '{vid}', '{cities[city_slug]}', '{l_status}', {slug_value}, {noindex}, {published}) on conflict (id) do nothing;"
        )
        facts = [
            ("meta_description", description[:150], description[:150], "meta"),
            ("site_title", f"{name} | Biuro nieruchomości", f"{name} | Biuro nieruchomości", "meta"),
            ("address", f"ul. Przykładowa {index}, 50-001 {city}", f"ul. Przykładowa {index}, 50-001 {city}", "jsonld"),
            ("address_hint", f"50-001 {city}", f"ul. Przykładowa {index}, 50-001 {city}", "regex"),
            ("registry_start_date", f"{year}-03-01", f"data wpisu do KRS: {year}-03-01", "registry"),
        ]
        for service in SERVICES[:n_services]:
            facts.append(("service", service, f"oferujemy: {service}", "llm"))
        for f_index, (ftype, value, quote, method) in enumerate(facts):
            w(
                "insert into facts (id, brand_id, type, value, quote, source_url, method, confidence) values "
                f"('{uid('fact', key, str(f_index))}', '{brand}', '{ftype}', {jb(value)}, {q(quote)}, 'https://{host}/', '{method}', 0.8) on conflict (id) do nothing;"
            )
        if percent is not None:
            quote = f"prowizja od sprzedaży {str(percent).replace('.', ',')}% " + {"net": "netto", "plus_vat": "+ VAT"}[tax]
            w(
                "insert into price_items (id, brand_id, service, unit, amount_min, tax_mode, price_status, quote, source_url) values "
                f"('{uid('price', key)}', '{brand}', 'pośrednictwo w sprzedaży', 'percent', {percent}, '{tax}', 'public', {q(quote)}, 'https://{host}/cennik') on conflict (id) do nothing;"
            )
        if status != "needs_review":
            d_state = "published" if status == "published" else "validated"
            w(
                "insert into descriptions (id, brand_id, version, body, fact_ids, validator_report, author, status) values "
                f"('{uid('desc', key)}', '{brand}', 1, {q(description)}, '{{}}', {jb({'ok': True, 'errors': [], 'warnings': [], 'metrics': {'ngram_overlap': 0.0}})}, 'claude_code', '{d_state}') on conflict (id) do nothing;"
            )
    w("commit;")
    print("\n".join(out))


if __name__ == "__main__":
    main()
