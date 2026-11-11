"""Warstwa zapisu do bazy. Cienkie funkcje SQL bez ukrytej logiki. Transakcjami steruje wywołujący."""

from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timezone

import psycopg
from psycopg.types.json import Jsonb

from .extract import _ROLE_LOCALPARTS
from .registry.base import RegistryEntity
from .verticals import VerticalConfig


def slugify(text: str) -> str:
    text = text.replace("ł", "l").replace("Ł", "L")
    folded = "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", folded.lower()).strip("-")


class DbCache:
    """Cache odpowiedzi rejestrów w tabeli registry_cache (implementuje RegistryCache)."""

    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

    def get(self, source: str, key: str, max_age_days: int) -> dict | None:
        row = self._conn.execute(
            """select payload from registry_cache
               where source = %s and key = %s and fetched_at > now() - make_interval(days => %s)""",
            (source, key, max_age_days),
        ).fetchone()
        return row["payload"] if row else None

    def put(self, source: str, key: str, payload: dict) -> None:
        self._conn.execute(
            """insert into registry_cache (source, key, payload, fetched_at) values (%s, %s, %s, now())
               on conflict (source, key) do update set payload = excluded.payload, fetched_at = now()""",
            (source, key, Jsonb(payload)),
        )


class Repo:
    def __init__(self, conn: psycopg.Connection) -> None:
        self.conn = conn

    # ------------------------------------------------------------------ słowniki

    def ensure_vertical(self, cfg: VerticalConfig) -> str:
        row = self.conn.execute(
            """insert into verticals (slug, name, domain) values (%s, %s, %s)
               on conflict (slug) do update set name = excluded.name, domain = excluded.domain
               returning id""",
            (cfg.slug, cfg.name, cfg.domain),
        ).fetchone()
        return str(row["id"])

    def ensure_city(self, name: str) -> str:
        row = self.conn.execute(
            """insert into cities (name, slug) values (%s, %s)
               on conflict (slug) do update set name = cities.name returning id""",
            (name, slugify(name)),
        ).fetchone()
        return str(row["id"])

    def ensure_city_with_priority(self, name: str, priority: int) -> int:
        """Dodaje miasto z listy branży. Zwraca 1, gdy miasto było nowe. Istniejącemu ustawia kolejność tylko gdy jej brak."""
        row = self.conn.execute(
            """insert into cities (name, slug, search_priority) values (%s, %s, %s)
               on conflict (slug) do update set search_priority = coalesce(cities.search_priority, excluded.search_priority)
               returning (xmax = 0) as inserted""",
            (name, slugify(name), priority),
        ).fetchone()
        return int(bool(row["inserted"]))

    def mark_city_searched(self, name: str) -> None:
        self.conn.execute("update cities set last_searched_at = now() where slug = %s", (slugify(name),))

    def city_search_queue(self) -> list[dict]:
        return self.conn.execute(
            """select name, slug, last_searched_at, deep_requested_at,
                      (deep_search or coalesce(search_priority, 999) <= 12) as deep
               from cities where search_enabled
               order by (deep_requested_at is null), deep_requested_at,
                        (last_searched_at is not null), search_priority nulls last, name"""
        ).fetchall()

    # ------------------------------------------------------------------ przebiegi i wyszukiwanie

    def start_run(self, stage: str, vertical_id: str | None) -> str:
        row = self.conn.execute(
            "insert into pipeline_runs (stage, vertical_id) values (%s, %s) returning id", (stage, vertical_id)
        ).fetchone()
        return str(row["id"])

    def finish_run(self, run_id: str, status: str, counts: dict, cost_usd: float = 0.0, errors: list | None = None) -> None:
        self.conn.execute(
            """update pipeline_runs set status = %s, counts = %s, cost_usd = %s, errors = %s, finished_at = now()
               where id = %s""",
            (status, Jsonb(counts), cost_usd, Jsonb(errors or []), run_id),
        )

    def save_session_run(self, counts: dict, started_at: str, finished_at: str | None, status: str, errors) -> bool:
        """Zapisuje raport sesji Claude jako przebieg 'claude_session'. False, gdy ten plik już był zapisany."""
        exists = self.conn.execute(
            "select 1 from pipeline_runs where stage = 'claude_session' and counts->>'file' = %s", (counts["file"],)
        ).fetchone()
        if exists:
            return False
        self.conn.execute(
            """insert into pipeline_runs (stage, status, counts, errors, started_at, finished_at)
               values ('claude_session', %s, %s, %s, %s, coalesce(%s::timestamptz, %s::timestamptz))""",
            (status, Jsonb(counts), Jsonb(errors or []), started_at, finished_at, started_at),
        )
        return True

    def record_query(
        self, run_id: str, vertical_id: str, provider: str, query: str, params: dict,
        results_count: int, new_domains: int, cost_usd: float,
    ) -> str:
        row = self.conn.execute(
            """insert into search_queries (run_id, vertical_id, provider, query, params, results_count, new_domains, cost_usd)
               values (%s, %s, %s, %s, %s, %s, %s, %s) returning id""",
            (run_id, vertical_id, provider, query, Jsonb(params), results_count, new_domains, cost_usd),
        ).fetchone()
        return str(row["id"])

    def record_results(self, query_id: str, rows: list[tuple[str, str, int]]) -> None:
        """Zapisuje tylko adres, domenę i pozycję wyniku (bez tytułów i snippetów)."""
        for url, host, rank in rows:
            self.conn.execute(
                "insert into search_results (query_id, url, host, rank) values (%s, %s, %s, %s)",
                (query_id, url, host, rank),
            )

    def candidate_source_imported(self, source_sha256: str) -> bool:
        """Czy plik z wynikami wyszukiwania (po sumie SHA-256) został już zaimportowany."""
        row = self.conn.execute(
            "select 1 from search_queries where params->>'source_sha256' = %s limit 1", (source_sha256,)
        ).fetchone()
        return row is not None

    def known_hosts(self) -> set[str]:
        return {r["host"] for r in self.conn.execute("select host from domains").fetchall()}

    # ------------------------------------------------------------------ domeny

    def upsert_domain(self, host: str, canonical_url: str, city_hint: str | None = None) -> tuple[str, bool]:
        row = self.conn.execute(
            """insert into domains (host, canonical_url, city_hint) values (%s, %s, %s)
               on conflict (host) do nothing returning id""",
            (host, canonical_url, city_hint),
        ).fetchone()
        if row:
            return str(row["id"]), True
        existing = self.conn.execute("select id from domains where host = %s", (host,)).fetchone()
        return str(existing["id"]), False

    def domains_to_probe(self, limit: int) -> list[dict]:
        return self.conn.execute(
            """select id, host, canonical_url, city_hint from domains
               where classification = 'unknown' and verification_status = 'candidate'
                 and (last_checked_at is null or last_checked_at < now() - interval '1 day')
               order by first_seen_at limit %s""",
            (limit,),
        ).fetchall()

    def update_domain_classification(
        self, domain_id: str, label: str, reasons: list[str], *, robots_status: str | None = None,
        verification_status: str | None = None,
    ) -> None:
        self.conn.execute(
            """update domains set classification = %s, classification_reasons = %s,
                 robots_status = coalesce(%s, robots_status),
                 verification_status = coalesce(%s, verification_status), last_checked_at = now()
               where id = %s""",
            (label, Jsonb(reasons), robots_status, verification_status, domain_id),
        )

    def touch_domain(self, domain_id: str, reasons: list[str], robots_status: str | None = None) -> None:
        self.conn.execute(
            """update domains set classification_reasons = %s, robots_status = coalesce(%s, robots_status),
                 last_checked_at = now() where id = %s""",
            (Jsonb(reasons), robots_status, domain_id),
        )

    def domains_to_verify(self, limit: int) -> list[dict]:
        return self.conn.execute(
            """select id, host, canonical_url, city_hint, classification from domains
               where classification in ('official', 'uncertain') and verification_status = 'candidate'
               order by first_seen_at limit %s""",
            (limit,),
        ).fetchall()

    def update_domain_verification(
        self, domain_id: str, score: int, status: str, legal_entity_id: str | None, brand_id: str | None,
        reasons: list[str] | None = None,
    ) -> None:
        self.conn.execute(
            """update domains set verification_score = %s, verification_status = %s, legal_entity_id = %s,
                 brand_id = %s, verification_reasons = %s, last_checked_at = now() where id = %s""",
            (score, status, legal_entity_id, brand_id, Jsonb(reasons or []), domain_id),
        )

    def domains_for_deep_crawl(self, limit: int) -> list[dict]:
        return self.conn.execute(
            """select d.id, d.host, d.canonical_url from domains d
               where d.verification_status = 'verified'
                 and (select count(*) from crawl_pages p where p.domain_id = d.id) < 3
               order by d.first_seen_at limit %s""",
            (limit,),
        ).fetchall()

    def domains_awaiting_bundle(self, limit: int) -> list[dict]:
        """Zweryfikowane domeny marek, które czekają na paczkę opisu (do ponownego pobrania stron, gdy zrzutów brak)."""
        return self.conn.execute(
            """select distinct d.id, d.host, d.canonical_url, d.first_seen_at from domains d
               join brands b on b.id = d.brand_id
               join listings l on l.brand_id = b.id and l.status in ('verified', 'needs_review')
               where d.verification_status = 'verified'
                 and not exists (select 1 from descriptions x where x.brand_id = b.id and x.status <> 'rejected')
                 and not exists (select 1 from queue_items q where q.brand_id = b.id and q.type = 'describe'
                                 and q.status in ('pending', 'claimed'))
               order by d.first_seen_at limit %s""",
            (limit,),
        ).fetchall()

    # ------------------------------------------------------------------ strony

    def record_page(
        self, domain_id: str, url: str, http_status: int | None, content_hash: str | None,
        storage_path: str | None, method: str, robots_allowed: bool | None, size: int | None,
    ) -> str:
        row = self.conn.execute(
            """insert into crawl_pages (domain_id, url, http_status, content_hash, storage_path, fetch_method,
                                        robots_allowed, bytes)
               values (%s, %s, %s, %s, %s, %s, %s, %s)
               on conflict (domain_id, url, content_hash) do update set fetched_at = now() returning id""",
            (domain_id, url, http_status, content_hash, storage_path, method, robots_allowed, size),
        ).fetchone()
        return str(row["id"])

    def pages_for_domain(self, domain_id: str) -> list[dict]:
        return self.conn.execute(
            """select distinct on (url) id, url, storage_path, content_hash from crawl_pages
               where domain_id = %s and storage_path is not null order by url, fetched_at desc""",
            (domain_id,),
        ).fetchall()

    # ------------------------------------------------------------------ podmioty

    def upsert_legal_entity(self, entity: RegistryEntity) -> str:
        kind = "spolka" if entity.krs else "jdg"
        address = {"street": entity.street, "postcode": entity.postcode, "city": entity.city}
        row = self.conn.execute(
            """insert into legal_entities (nip, regon, krs, name, legal_form, entity_kind, vat_status, start_date,
                                           pkd_main, pkd_codes, registered_address, registry_source, registry_synced_at)
               values (%(nip)s, %(regon)s, %(krs)s, %(name)s, %(form)s, %(kind)s, %(vat)s, %(start)s,
                       %(pkd_main)s, %(pkd)s, %(addr)s, %(source)s, now())
               on conflict (nip) do update set
                 regon = coalesce(excluded.regon, legal_entities.regon),
                 krs = coalesce(excluded.krs, legal_entities.krs),
                 name = excluded.name,
                 legal_form = coalesce(excluded.legal_form, legal_entities.legal_form),
                 entity_kind = coalesce(excluded.entity_kind, legal_entities.entity_kind),
                 vat_status = coalesce(excluded.vat_status, legal_entities.vat_status),
                 start_date = coalesce(excluded.start_date, legal_entities.start_date),
                 pkd_main = coalesce(excluded.pkd_main, legal_entities.pkd_main),
                 pkd_codes = case when cardinality(excluded.pkd_codes) > 0 then excluded.pkd_codes
                                  else legal_entities.pkd_codes end,
                 registered_address = coalesce(excluded.registered_address, legal_entities.registered_address),
                 registry_source = excluded.registry_source,
                 registry_synced_at = now(), updated_at = now()
               returning id""",
            {
                "nip": entity.nip, "regon": entity.regon, "krs": entity.krs, "name": entity.name,
                "form": entity.legal_form, "kind": kind, "vat": entity.vat_status, "start": entity.start_date,
                "pkd_main": entity.pkd_codes[0] if entity.pkd_codes else None, "pkd": entity.pkd_codes,
                "addr": Jsonb(address), "source": entity.source,
            },
        ).fetchone()
        return str(row["id"])

    def upsert_brand(self, legal_entity_id: str, name: str) -> str:
        row = self.conn.execute(
            """insert into brands (legal_entity_id, name, slug) values (%s, %s, %s)
               on conflict (legal_entity_id, name) do update set name = excluded.name returning id""",
            (legal_entity_id, name, slugify(name)),
        ).fetchone()
        return str(row["id"])

    def upsert_listing(self, brand_id: str, vertical_id: str, city_id: str, status: str) -> str:
        row = self.conn.execute(
            """insert into listings (brand_id, vertical_id, city_id, status) values (%s, %s, %s, %s)
               on conflict (brand_id, vertical_id, city_id) do update set status = excluded.status
                 where listings.status not in ('published', 'removed')
               returning id""",
            (brand_id, vertical_id, city_id, status),
        ).fetchone()
        if row:
            return str(row["id"])
        existing = self.conn.execute(
            "select id from listings where brand_id = %s and vertical_id = %s and city_id = %s",
            (brand_id, vertical_id, city_id),
        ).fetchone()
        return str(existing["id"])

    # ------------------------------------------------------------------ fakty, ceny, opisy

    def add_fact(
        self, brand_id: str, type_: str, value, quote: str | None, source_url: str | None, method: str,
        confidence: float | None = None,
    ) -> str:
        """Dodaje fakt. Jeśli taki sam (typ i wartość) jest już bieżący, zwraca jego id."""
        existing = self.conn.execute(
            """select id from facts where brand_id = %s and type = %s and value = %s and is_current""",
            (brand_id, type_, Jsonb(value)),
        ).fetchone()
        if existing:
            return str(existing["id"])
        row = self.conn.execute(
            """insert into facts (brand_id, type, value, quote, source_url, method, confidence)
               values (%s, %s, %s, %s, %s, %s, %s) returning id""",
            (brand_id, type_, Jsonb(value), quote, source_url, method, confidence),
        ).fetchone()
        return str(row["id"])

    def replace_price_items(self, brand_id: str, items: list[dict]) -> int:
        """Oznacza dotychczasowe ceny tych usług jako nieaktualne i zapisuje nowe."""
        for item in items:
            self.conn.execute(
                "update price_items set is_current = false where brand_id = %s and service = %s and is_current",
                (brand_id, item["service"]),
            )
            self.conn.execute(
                """insert into price_items (brand_id, service, unit, amount_min, amount_max, tax_mode, conditions,
                                            price_status, quote, source_url)
                   values (%(brand_id)s, %(service)s, %(unit)s, %(amount_min)s, %(amount_max)s, %(tax_mode)s,
                           %(conditions)s, 'public', %(quote)s, %(source_url)s)""",
                {**item, "brand_id": brand_id},
            )
        return len(items)

    def add_description(
        self, brand_id: str, body: str, fact_ids: list[str], report: dict, author: str, status: str
    ) -> str:
        row = self.conn.execute(
            """insert into descriptions (brand_id, version, body, fact_ids, validator_report, author, status)
               values (%s, coalesce((select max(version) from descriptions where brand_id = %s), 0) + 1,
                       %s, %s::uuid[], %s, %s, %s) returning id""",
            (brand_id, brand_id, body, fact_ids, Jsonb(report), author, status),
        ).fetchone()
        return str(row["id"])

    def brands_needing_description(self, limit: int) -> list[dict]:
        return self.conn.execute(
            """select b.id as brand_id, b.name, l.city_id, c.name as city, d.id as domain_id, d.host
               from brands b
               join listings l on l.brand_id = b.id and l.status in ('verified', 'needs_review')
               join cities c on c.id = l.city_id
               join domains d on d.brand_id = b.id
               where not exists (select 1 from descriptions x where x.brand_id = b.id and x.status <> 'rejected')
                 and not exists (select 1 from queue_items q where q.brand_id = b.id and q.type = 'describe'
                                 and q.status in ('pending', 'claimed'))
               order by b.created_at limit %s""",
            (limit,),
        ).fetchall()

    def domains_needing_classification(self, limit: int) -> list[dict]:
        return self.conn.execute(
            """select d.id, d.host, d.canonical_url, d.classification_reasons from domains d
               where d.classification = 'uncertain' and d.verification_status = 'candidate'
                 and not exists (select 1 from queue_items q where q.domain_id = d.id and q.type = 'classify'
                                 and q.status in ('pending', 'claimed', 'done'))
               order by d.first_seen_at limit %s""",
            (limit,),
        ).fetchall()

    def rename_brand(self, brand_id: str, name: str) -> None:
        self.conn.execute("update brands set name = %s where id = %s and name <> %s", (name, brand_id, name))

    def setting(self, key: str, default):
        row = self.conn.execute("select value from settings where key = %s", (key,)).fetchone()
        return row["value"] if row else default

    def listings_ready_to_publish(self, min_facts: int, limit: int) -> list[dict]:
        """Wpisy spełniające bramkę publikacji: domena zweryfikowana, zwalidowany opis, minimum faktów."""
        return self.conn.execute(
            """select l.id, l.vertical_id, l.city_id, l.slug, c.name as city_name, b.id as brand_id, b.name as brand_name,
                      (select d.city_hint from domains d where d.brand_id = b.id and d.verification_status = 'verified'
                        order by d.verification_score desc nulls last limit 1) as city_hint,
                      (select x.id from descriptions x where x.brand_id = b.id and x.status <> 'rejected'
                        order by x.version desc limit 1) as description_id
               from listings l
               join brands b on b.id = l.brand_id
               join cities c on c.id = l.city_id
               where l.status = 'verified'
                 and exists (select 1 from domains d where d.brand_id = b.id and d.verification_status = 'verified')
                 and (select x.status from descriptions x where x.brand_id = b.id and x.status <> 'rejected'
                       order by x.version desc limit 1) = 'validated'
                 and (select count(*) from facts f where f.brand_id = b.id and f.is_current) >= %s
               order by l.created_at limit %s""",
            (min_facts, limit),
        ).fetchall()

    def brand_fact_text(self, brand_id: str) -> str:
        rows = self.conn.execute(
            "select value #>> '{}' as v, coalesce(quote, '') as q from facts where brand_id = %s and is_current",
            (brand_id,),
        ).fetchall()
        return " ".join(f"{r['v']} {r['q']}" for r in rows)

    def taken_slugs(self, vertical_id: str, city_id: str) -> set[str]:
        rows = self.conn.execute(
            "select slug from listings where vertical_id = %s and city_id = %s and slug is not null",
            (vertical_id, city_id),
        ).fetchall()
        return {r["slug"] for r in rows}

    def publish_listing(self, listing_id: str, city_id: str, slug: str, description_id: str | None) -> None:
        self.conn.execute(
            """update listings set status = 'published', city_id = %s, slug = %s, noindex = false,
                      published_at = coalesce(published_at, now()) where id = %s""",
            (city_id, slug, listing_id),
        )
        if description_id:
            self.conn.execute(
                "update descriptions set status = 'published' where id = %s and status = 'validated'", (description_id,)
            )

    def write_audit(self, actor: str, action: str, entity_type: str, entity_id: str, before, after) -> None:
        self.conn.execute(
            """insert into audit_log (actor, action, entity_type, entity_id, before, after)
               values (%s, %s, %s, %s, %s, %s)""",
            (actor, action, entity_type, entity_id, Jsonb(before), Jsonb(after)),
        )

    # ------------------------------------------------------------------ oferty

    def domains_for_offers(self, limit: int) -> list[dict]:
        """Zweryfikowane domeny marek z opublikowanym wpisem, najdawniej sprawdzane pierwsze."""
        return self.conn.execute(
            """select d.id, d.host, d.canonical_url, d.brand_id, d.offers_url, d.offers_checked_at from domains d
               where d.verification_status = 'verified' and d.brand_id is not null
                 and exists (select 1 from listings l where l.brand_id = d.brand_id and l.status = 'published')
               order by d.offers_checked_at nulls first, d.host limit %s""",
            (limit,),
        ).fetchall()

    def save_offers(self, domain_id: str, brand_id: str, offers: list) -> dict:
        """Zapisuje oferty z udanego odczytu. Oferty tej domeny spoza odczytu przestają być aktywne."""
        from .urls import canonical_url

        counts = {"new": 0, "updated": 0, "deactivated": 0}
        keys: list[str] = []
        for offer in offers:
            key = canonical_url(offer.url)
            if key in keys:
                continue
            keys.append(key)
            row = self.conn.execute(
                """insert into offers (brand_id, domain_id, url, url_key, title, position,
                                      price_amount, price_currency, price_period)
                   values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                   on conflict (domain_id, url_key) do update
                     set url = excluded.url, title = excluded.title, position = excluded.position,
                         price_amount = excluded.price_amount, price_currency = excluded.price_currency,
                         price_period = excluded.price_period,
                         brand_id = excluded.brand_id, is_active = true, last_seen_at = now()
                   returning (xmax = 0) as inserted""",
                (brand_id, domain_id, offer.url, key, offer.title, offer.position,
                 getattr(offer, "price_amount", None), getattr(offer, "price_currency", None),
                 getattr(offer, "price_period", None)),
            ).fetchone()
            counts["new" if row["inserted"] else "updated"] += 1
        counts["deactivated"] = self.conn.execute(
            "update offers set is_active = false where domain_id = %s and is_active and not (url_key = any(%s))",
            (domain_id, keys),
        ).rowcount
        return counts

    def domains_for_contacts(self, limit: int) -> list[dict]:
        """Zweryfikowane domeny marek z wpisem w katalogu albo w przygotowaniu, jedna domena na markę."""
        return self.conn.execute(
            """select distinct on (d.brand_id) d.id, d.host, d.canonical_url, d.brand_id from domains d
               where d.verification_status = 'verified' and d.brand_id is not null
                 and exists (select 1 from listings l where l.brand_id = d.brand_id
                             and l.status in ('published', 'verified', 'needs_review'))
               order by d.brand_id, d.verification_score desc nulls last limit %s""",
            (limit,),
        ).fetchall()

    def save_contacts(self, brand_id: str, found: dict) -> None:
        """Zastępuje telefony, e-maile i profile społecznościowe marki tymi z ostatniego odczytu strony."""
        self.conn.execute("delete from contacts where brand_id = %s", (brand_id,))
        for value, source in found.get("phones", []):
            self.conn.execute(
                "insert into contacts (brand_id, kind, value, source_url) values (%s, 'phone', %s, %s) on conflict do nothing",
                (brand_id, value, source),
            )
        for value, source in found.get("emails", []):
            self.conn.execute(
                """insert into contacts (brand_id, kind, value, email_kind, source_url)
                   values (%s, 'email', %s, %s, %s) on conflict do nothing""",
                (brand_id, value, "role" if value.split("@")[0] in _ROLE_LOCALPARTS else "unknown", source),
            )
        self.conn.execute("delete from social_links where brand_id = %s", (brand_id,))
        for network, url, source in found.get("socials", []):
            self.conn.execute(
                """insert into social_links (brand_id, network, url, verified, source_url)
                   values (%s, %s, %s, true, %s) on conflict do nothing""",
                (brand_id, network, url, source),
            )

    def brands_for_google_reviews(self, limit: int, max_age_days: int) -> list[dict]:
        return self.conn.execute(
            """select b.id as brand_id, b.name, c.name as city, d.canonical_url as website from listings l
               join brands b on b.id = l.brand_id join cities c on c.id = l.city_id
               left join lateral (select canonical_url from domains where brand_id = b.id
                                  order by verification_score desc nulls last limit 1) d on true
               left join google_places g on g.brand_id = b.id
               where l.status = 'published'
                 and (g.fetched_at is null or g.fetched_at < now() - make_interval(days => %s))
               order by g.fetched_at nulls first limit %s""",
            (max_age_days, limit),
        ).fetchall()

    def save_google_place(self, brand_id: str, result) -> None:
        """Zapisuje wynik. Przy błędzie API poprzednie dane zostają, zmienia się tylko status i data."""
        if result.status == "error":
            self.conn.execute(
                """insert into google_places (brand_id, status) values (%s, 'error')
                   on conflict (brand_id) do update set status = 'error', fetched_at = now()""",
                (brand_id,),
            )
            return
        self.conn.execute(
            """insert into google_places (brand_id, place_id, rating, rating_count, maps_url, reviews, status)
               values (%s, %s, %s, %s, %s, %s, %s)
               on conflict (brand_id) do update set place_id = excluded.place_id, rating = excluded.rating,
                 rating_count = excluded.rating_count, maps_url = excluded.maps_url, reviews = excluded.reviews,
                 status = excluded.status, fetched_at = now()""",
            (brand_id, result.place_id, result.rating, result.rating_count, result.maps_url,
             Jsonb(result.reviews), result.status),
        )

    def save_brand_logo_cover(self, brand_id: str, images: dict) -> None:
        """Logo i zdjęcie firmy. Brak w nowym odczycie nie kasuje poprzedniej wartości."""
        self.conn.execute(
            "update brands set logo_url = coalesce(%s, logo_url), cover_url = coalesce(%s, cover_url) where id = %s",
            (images.get("logo"), images.get("cover"), brand_id),
        )

    def save_brand_image(self, brand_id: str, image: tuple[str, str] | None) -> None:
        """Zapamiętuje obrazek firmy. Gdy odczyt nic nie dał, poprzedni obrazek zostaje."""
        if image:
            self.conn.execute(
                "update brands set image_url = %s, image_kind = %s, image_checked_at = now() where id = %s",
                (image[0], image[1], brand_id),
            )
        else:
            self.conn.execute("update brands set image_checked_at = now() where id = %s", (brand_id,))

    def mark_offers_checked(self, domain_id: str, offers_url: str | None) -> None:
        """Zapamiętuje stronę z ofertami (gdy się udało) i czas sprawdzenia."""
        self.conn.execute(
            "update domains set offers_url = coalesce(%s, offers_url), offers_checked_at = now() where id = %s",
            (offers_url, domain_id),
        )

    # ------------------------------------------------------------------ kolejka

    def enqueue(self, type_: str, bundle_path: str, bundle_sha256: str, *, brand_id: str | None = None,
                domain_id: str | None = None) -> str:
        existing = self.conn.execute(
            """select id, status from queue_items where type = %s and bundle_sha256 = %s
                 and brand_id is not distinct from %s and domain_id is not distinct from %s""",
            (type_, bundle_sha256, brand_id, domain_id),
        ).fetchone()
        if existing:
            if existing["status"] == "failed":
                # ta sama paczka zbudowana ponownie (np. po utracie pliku): zadanie wraca do kolejki
                self.conn.execute(
                    """update queue_items set status = 'pending', bundle_path = %s, updated_at = now() where id = %s""",
                    (bundle_path, existing["id"]),
                )
            return str(existing["id"])
        row = self.conn.execute(
            """insert into queue_items (type, brand_id, domain_id, bundle_path, bundle_sha256)
               values (%s, %s, %s, %s, %s) returning id""",
            (type_, brand_id, domain_id, bundle_path, bundle_sha256),
        ).fetchone()
        return str(row["id"])

    def pending_queue_items(self, type_: str | None = None) -> list[dict]:
        return self.conn.execute(
            """select id, type, brand_id, domain_id, bundle_path, bundle_sha256 from queue_items
               where status = 'pending' and (%s::text is null or type = %s) order by created_at""",
            (type_, type_),
        ).fetchall()

    def finish_queue_item(self, item_id: str, status: str, result_path: str | None, report: dict) -> None:
        self.conn.execute(
            """update queue_items set status = %s, result_path = %s, validator_report = %s,
                 attempts = attempts + 1, updated_at = now() where id = %s""",
            (status, result_path, Jsonb(report), item_id),
        )

    # ------------------------------------------------------------------ status

    def status_counts(self) -> dict:
        def counts(sql: str) -> dict:
            return {r["k"]: r["n"] for r in self.conn.execute(sql).fetchall()}

        return {
            "domains_by_status": counts(
                "select verification_status as k, count(*)::int as n from domains group by 1 order by 1"
            ),
            "domains_by_classification": counts(
                "select classification as k, count(*)::int as n from domains group by 1 order by 1"
            ),
            "listings_by_status": counts("select status as k, count(*)::int as n from listings group by 1 order by 1"),
            "queue_by_status": counts(
                "select type || ':' || status as k, count(*)::int as n from queue_items group by 1 order by 1"
            ),
            "descriptions_by_status": counts(
                "select status as k, count(*)::int as n from descriptions group by 1 order by 1"
            ),
        }


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def dumps(data) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2)
