-- Rejestr pytań (promptów) i pomiarów odpowiedzi AI, wspólny dla wszystkich klientów.
-- Zasada: jedna odpowiedź zapisana raz, a klienci, firmy i źródła są z nią tylko powiązani. Pełna treść odpowiedzi
-- i surowa odpowiedź dostawcy trafiają do magazynu plików (raw_key), w bazie zostają indeksy i krótki fragment.

-- Pytanie: dokładny tekst i parametry, które zmieniają odpowiedź. Dwa podobne pytania to dwa różne wiersze.
create table geo.prompts (
  id             uuid primary key default gen_random_uuid(),
  text           text not null check (char_length(text) between 3 and 500),
  text_hash      text not null,                         -- sha256 z tekstu po normalizacji spacji (bez zmiany treści)
  language       text not null default 'pl' check (language ~ '^[a-z]{2}$'),
  industry       text check (char_length(industry) <= 60),          -- np. nieruchomosci, rachunkowe
  city           text check (char_length(city) <= 80),
  service        text check (char_length(service) <= 120),
  intent         text check (intent in ('recommendation', 'price', 'comparison', 'information', 'brand')),
  is_branded     boolean not null default false,        -- pytanie z nazwą konkretnej firmy
  source         text not null default 'template' check (source in ('template', 'site', 'autocomplete', 'people_also_ask', 'manual', 'competitor')),
  created_at     timestamptz not null default now(),
  unique (text_hash, language)
);
create index prompts_scope_idx on geo.prompts (industry, city);

-- Pomiar: jedna odpowiedź jednej platformy na jedno pytanie w danych warunkach.
-- Klucz pamięci podręcznej (cache_key) to skrót z: pytania, platformy, modelu, trybu, języka, lokalizacji i wyszukiwania.
create table geo.measurements (
  id             uuid primary key default gen_random_uuid(),
  prompt_id      uuid not null references geo.prompts (id),
  platform       text not null check (platform in ('chatgpt', 'gemini', 'perplexity', 'claude', 'copilot', 'google_ai_overview', 'google_ai_mode')),
  model          text check (char_length(model) <= 80),
  mode           text not null check (mode in ('ui', 'api')),          -- prawdziwy interfejs czy API modelu
  web_search     boolean not null default true,
  location       text check (char_length(location) <= 80),            -- np. "Poland" albo kod lokalizacji dostawcy
  language       text not null default 'pl',
  provider       text not null check (char_length(provider) <= 40),   -- np. dataforseo, litescrape
  provider_task_id text check (char_length(provider_task_id) <= 120),
  cache_key      text not null,
  status         text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  error          text check (char_length(error) <= 500),
  answer_excerpt text check (char_length(answer_excerpt) <= 2000),     -- początek odpowiedzi do podglądu
  answer_hash    text,
  raw_key        text check (char_length(raw_key) <= 300),             -- ścieżka pełnej odpowiedzi w magazynie plików
  cost_usd       numeric(10, 6),
  requested_at   timestamptz not null default now(),
  measured_at    timestamptz                                          -- czas pomiaru u dostawcy (to pokazujemy klientowi)
);
create index measurements_cache_idx on geo.measurements (cache_key, measured_at desc) where status = 'done';
create index measurements_prompt_idx on geo.measurements (prompt_id, platform, measured_at desc);
create unique index measurements_task_uidx on geo.measurements (provider, provider_task_id) where provider_task_id is not null;

-- Firmy wymienione w odpowiedzi. brand_id: dopasowanie do rejestru firm katalogu (public.brands), null = jeszcze nie.
create table geo.mentions (
  id             bigint generated always as identity primary key,
  measurement_id uuid not null references geo.measurements (id) on delete cascade,
  position       int not null check (position >= 1),                  -- kolejność w odpowiedzi
  name           text not null check (char_length(name) <= 200),      -- nazwa jak w odpowiedzi
  domain         text check (char_length(domain) <= 253),
  brand_id       uuid,
  match_method   text check (match_method in ('domain', 'name_city', 'manual')),
  recommended    boolean not null default false,                      -- wprost polecona, a nie tylko wymieniona
  snippet        text check (char_length(snippet) <= 500)
);
create index mentions_measurement_idx on geo.mentions (measurement_id);
create index mentions_brand_idx on geo.mentions (brand_id) where brand_id is not null;
create index mentions_domain_idx on geo.mentions (domain) where domain is not null;

-- Cytowane źródła (adresy stron, na które powołuje się odpowiedź).
create table geo.citations (
  id             bigint generated always as identity primary key,
  measurement_id uuid not null references geo.measurements (id) on delete cascade,
  position       int not null check (position >= 1),
  url            text not null check (char_length(url) <= 2000),
  domain         text not null check (char_length(domain) <= 253),
  title          text check (char_length(title) <= 300),
  is_own_portal  boolean not null default false                       -- nasz portal (np. rankingbiurnieruchomosci.pl)
);
create index citations_measurement_idx on geo.citations (measurement_id);
create index citations_domain_idx on geo.citations (domain);

-- Pytania monitorowane: biblioteka branży i miasta albo lista konkretnego konta. Jedno pytanie mierzone raz
-- dla wszystkich kont, które je śledzą.
create table geo.tracked_prompts (
  id             uuid primary key default gen_random_uuid(),
  prompt_id      uuid not null references geo.prompts (id),
  account_id     uuid references geo.accounts (id),                    -- null = biblioteka wspólna
  platforms      text[] not null default array['chatgpt', 'gemini'],
  frequency      text not null default 'weekly' check (frequency in ('daily', 'weekly', 'monthly')),
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (prompt_id, account_id)
);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'geo_app') then
    grant select, insert, update, delete on geo.prompts, geo.measurements, geo.mentions, geo.citations, geo.tracked_prompts to geo_app;
    grant usage, select on all sequences in schema geo to geo_app;
  end if;
end
$$;
