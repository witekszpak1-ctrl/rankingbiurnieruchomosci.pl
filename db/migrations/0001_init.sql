-- 0001_init.sql
-- Schemat rdzenia (F0/F1): branże, miasta, podmioty, domeny, dowody (fakty), ceny, opisy,
-- kolejka dla Claude Code, przebiegi pipeline i zapytania wyszukiwarki.
-- Migracje są tylko w przód (bez down). Uruchamiane przez: katalog migrate

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------- słowniki

create table verticals (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  domain      text unique,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table vertical_versions (
  id          uuid primary key default gen_random_uuid(),
  vertical_id uuid not null references verticals(id) on delete cascade,
  version     integer not null check (version > 0),
  config      jsonb not null,
  created_by  text,
  created_at  timestamptz not null default now(),
  unique (vertical_id, version)
);

create table cities (
  id          uuid primary key default gen_random_uuid(),
  simc        text unique check (simc ~ '^[0-9]{7}$'),   -- identyfikator miejscowości z TERYT
  name        text not null,
  slug        text not null unique,
  voivodeship text,
  powiat      text,
  population  integer check (population >= 0),
  tier        text check (tier in ('A', 'B', 'C', 'D')),
  created_at  timestamptz not null default now()
);
create index cities_name_idx on cities (lower(name));

-- ---------------------------------------------------------------- podmioty

create table legal_entities (
  id                 uuid primary key default gen_random_uuid(),
  nip                text not null unique check (nip ~ '^[0-9]{10}$'),
  regon              text check (regon ~ '^([0-9]{9}|[0-9]{14})$'),
  krs                text check (krs ~ '^[0-9]{10}$'),
  ceidg_id           text,
  name               text not null,
  legal_form         text,
  entity_kind        text check (entity_kind in ('jdg', 'spolka', 'inne')),
  registry_status    text,          -- np. aktywny, zawieszony, wykreslony (znormalizowane)
  vat_status         text,          -- Czynny, Zwolniony, Niezarejestrowany (z białej listy)
  start_date         date,
  pkd_main           text,
  pkd_codes          text[] not null default '{}',
  registered_address jsonb,         -- {street, building, unit, postcode, city, simc}
  registry_source    text,          -- mf_vat | krs | ceidg
  registry_synced_at timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index legal_entities_regon_idx on legal_entities (regon);
create index legal_entities_krs_idx on legal_entities (krs);
create index legal_entities_name_trgm on legal_entities using gin (name gin_trgm_ops);

create table brands (
  id              uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references legal_entities(id) on delete cascade,
  name            text not null,
  slug            text,
  created_at      timestamptz not null default now(),
  unique (legal_entity_id, name)
);
create index brands_name_trgm on brands using gin (name gin_trgm_ops);

create table domains (
  id                     uuid primary key default gen_random_uuid(),
  host                   text not null unique,    -- domena rejestrowalna, np. przyklad.pl
  canonical_url          text,
  city_hint              text,                    -- miasto z zapytania, w którym znaleziono domenę
  brand_id               uuid references brands(id) on delete set null,
  legal_entity_id        uuid references legal_entities(id) on delete set null,
  classification         text not null default 'unknown'
                         check (classification in ('unknown', 'official', 'directory', 'marketplace',
                                                   'media', 'irrelevant', 'parked', 'uncertain')),
  classification_reasons jsonb not null default '[]'::jsonb,
  verification_score     integer check (verification_score between 0 and 100),
  verification_reasons   jsonb not null default '[]'::jsonb,
  verification_status    text not null default 'candidate'
                         check (verification_status in ('candidate', 'verified', 'probable',
                                                        'needs_review', 'rejected')),
  robots_status          text check (robots_status in ('allowed', 'disallowed', 'unknown')),
  first_seen_at          timestamptz not null default now(),
  last_checked_at        timestamptz,
  created_at             timestamptz not null default now()
);
create index domains_status_idx on domains (verification_status);
create index domains_entity_idx on domains (legal_entity_id);

create table locations (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references brands(id) on delete cascade,
  kind       text not null check (kind in ('siedziba', 'oddzial')),
  street     text,
  building   text,
  unit       text,
  postcode   text,
  city_id    uuid references cities(id),
  city_name  text,
  lat        double precision,
  lng        double precision,
  phone      text,
  created_at timestamptz not null default now()
);
create index locations_brand_idx on locations (brand_id);
create index locations_city_idx on locations (city_id);

create table contacts (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references brands(id) on delete cascade,
  kind          text not null check (kind in ('email', 'phone')),
  value         text not null,
  email_kind    text check (email_kind in ('role', 'unknown')),   -- adresy osobiste nie są zapisywane
  mx_ok         boolean,
  source_url    text,
  created_at    timestamptz not null default now(),
  unique (brand_id, kind, value)
);

create table social_links (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references brands(id) on delete cascade,
  network    text not null,
  url        text not null,
  verified   boolean not null default false,
  source_url text,
  created_at timestamptz not null default now(),
  unique (brand_id, url)
);

create table listings (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references brands(id) on delete cascade,
  vertical_id  uuid not null references verticals(id),
  city_id      uuid not null references cities(id),
  status       text not null default 'candidate'
               check (status in ('candidate', 'needs_review', 'verified', 'published', 'rejected', 'removed')),
  slug         text,
  noindex      boolean not null default true,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (brand_id, vertical_id, city_id),
  unique (vertical_id, city_id, slug)
);
create index listings_status_idx on listings (vertical_id, city_id, status);

-- ---------------------------------------------------------------- dowody

create table crawl_pages (
  id            uuid primary key default gen_random_uuid(),
  domain_id     uuid not null references domains(id) on delete cascade,
  url           text not null,
  fetched_at    timestamptz not null default now(),
  http_status   integer,
  content_hash  text,
  storage_path  text,
  fetch_method  text check (fetch_method in ('httpx', 'crawl4ai')),
  robots_allowed boolean,
  bytes         integer,
  unique (domain_id, url, content_hash)
);
create index crawl_pages_domain_idx on crawl_pages (domain_id, fetched_at desc);

create table facts (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  type            text not null,
  value           jsonb not null,
  quote           text,
  source_page_id  uuid references crawl_pages(id) on delete set null,
  source_url      text,
  method          text not null check (method in ('registry', 'jsonld', 'meta', 'regex', 'llm', 'manual')),
  confidence      real check (confidence between 0 and 1),
  observed_at     timestamptz not null default now(),
  supersedes      uuid references facts(id),
  is_current      boolean not null default true,
  created_at      timestamptz not null default now()
);
create index facts_brand_type_idx on facts (brand_id, type) where is_current;

create table price_items (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references brands(id) on delete cascade,
  service       text not null,
  unit          text check (unit in ('percent', 'pln', 'pln_per_month', 'other')),
  amount_min    numeric(14, 4),
  amount_max    numeric(14, 4),
  currency      text not null default 'PLN',
  tax_mode      text check (tax_mode in ('net', 'gross', 'plus_vat', 'unknown')),
  conditions    text,
  price_status  text not null check (price_status in ('public', 'on_request', 'not_found', 'in_image')),
  quote         text,
  source_url    text,
  observed_at   timestamptz not null default now(),
  is_current    boolean not null default true,
  created_at    timestamptz not null default now()
);
create index price_items_brand_idx on price_items (brand_id) where is_current;

create table review_links (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references brands(id) on delete cascade,
  kind       text not null check (kind in ('google_place', 'facebook', 'opineo', 'other')),
  url        text,
  place_id   text,
  source_url text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- treść

create table descriptions (
  id               uuid primary key default gen_random_uuid(),
  brand_id         uuid not null references brands(id) on delete cascade,
  version          integer not null check (version > 0),
  body             text not null,
  fact_ids         uuid[] not null default '{}',
  validator_report jsonb,
  author           text not null check (author in ('claude_code', 'api', 'human')),
  status           text not null default 'draft' check (status in ('draft', 'validated', 'rejected', 'published')),
  created_at       timestamptz not null default now(),
  unique (brand_id, version)
);

-- ---------------------------------------------------------------- kolejka i przebiegi

create table pipeline_runs (
  id           uuid primary key default gen_random_uuid(),
  stage        text not null,
  vertical_id  uuid references verticals(id),
  status       text not null default 'running' check (status in ('running', 'ok', 'failed')),
  counts       jsonb not null default '{}'::jsonb,
  cost_usd     numeric(10, 4) not null default 0,
  errors       jsonb not null default '[]'::jsonb,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz
);

create table search_queries (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid references pipeline_runs(id) on delete set null,
  vertical_id   uuid references verticals(id),
  provider      text not null,
  query         text not null,
  params        jsonb not null default '{}'::jsonb,
  results_count integer not null default 0,
  new_domains   integer not null default 0,
  cost_usd      numeric(10, 6) not null default 0,
  created_at    timestamptz not null default now()
);
create index search_queries_provider_idx on search_queries (provider, created_at desc);

-- Zapisujemy tylko adres i pozycję, bez snippetów (ograniczenie warunków dostawców API).
create table search_results (
  id         uuid primary key default gen_random_uuid(),
  query_id   uuid not null references search_queries(id) on delete cascade,
  url        text not null,
  host       text not null,
  rank       integer not null,
  domain_id  uuid references domains(id) on delete set null
);
create index search_results_query_idx on search_results (query_id);

create table queue_items (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in ('classify', 'describe')),
  brand_id      uuid references brands(id) on delete cascade,
  domain_id     uuid references domains(id) on delete cascade,
  bundle_path   text not null,
  bundle_sha256 text not null,
  status        text not null default 'pending'
                check (status in ('pending', 'claimed', 'done', 'failed', 'rejected')),
  attempts      integer not null default 0,
  result_path   text,
  validator_report jsonb,
  claimed_by    text,
  claimed_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (brand_id is not null or domain_id is not null)
);
create index queue_items_status_idx on queue_items (type, status);

-- Cache surowych odpowiedzi rejestrów (dane publiczne). Limity API są niskie, więc cache jest obowiązkowy.
create table registry_cache (
  source     text not null,
  key        text not null,
  payload    jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (source, key)
);

-- ---------------------------------------------------------------- system

create table audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor       text not null,
  action      text not null,
  entity_type text,
  entity_id   text,
  before      jsonb,
  after       jsonb
);
create index audit_log_entity_idx on audit_log (entity_type, entity_id, at desc);

create table settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into settings (key, value) values
  ('publish_min_facts', '6'),
  ('validator_max_ngram_overlap', '0.2')
on conflict (key) do nothing;
