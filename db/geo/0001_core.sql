-- Platforma GEO: konta klientów, pakiety (silnik uprawnień), abonamenty i program partnerski.
-- Osobny schemat "geo" w tej samej bazie co katalog, żeby później łączyć klientów z centralnym rejestrem firm
-- (brands, domains) bez kopiowania danych. Kwoty zawsze w groszach (bigint), waluta PLN.
-- Migracje tego schematu stosuje apps/geo/scripts/migrate.mjs (tabela geo.schema_migrations), nie `katalog migrate`.

create schema if not exists geo;

-- Użytkownik (osoba logująca się). Jeden użytkownik może być klientem, partnerem albo jednym i drugim.
create table geo.users (
  id             uuid primary key default gen_random_uuid(),
  email          text not null check (char_length(email) between 3 and 254),
  email_norm     text generated always as (lower(trim(email))) stored,
  password_hash  text not null,
  name           text check (char_length(name) <= 120),
  created_at     timestamptz not null default now(),
  last_login_at  timestamptz,
  is_admin       boolean not null default false,
  disabled_at    timestamptz
);
create unique index users_email_uidx on geo.users (email_norm);

-- Konto klienta (firma, która płaci). Właściciel to użytkownik; domena główna do audytu i monitoringu.
create table geo.accounts (
  id             uuid primary key default gen_random_uuid(),
  owner_user_id  uuid not null references geo.users (id),
  name           text not null check (char_length(name) between 1 and 200),
  primary_domain text check (char_length(primary_domain) <= 253),
  brand_id       uuid,  -- powiązanie z public.brands (rejestr firm katalogu), ustawiane po dopasowaniu
  nip            text check (nip ~ '^[0-9]{10}$'),
  created_at     timestamptz not null default now()
);
create index accounts_owner_idx on geo.accounts (owner_user_id);

-- Pakiety i uprawnienia: limity w JSON, zmiana pakietu bez zmiany kodu. Wersja pakietu jest niezmienna po
-- przypisaniu do abonamentu (nowa cena = nowy wiersz), żeby historia rozliczeń się zgadzała.
create table geo.plans (
  id             text primary key check (id ~ '^[a-z0-9_-]{2,40}$'),
  name           text not null,
  price_monthly_grosze bigint not null check (price_monthly_grosze >= 0),
  price_yearly_grosze  bigint check (price_yearly_grosze >= 0),
  entitlements   jsonb not null default '{}'::jsonb,
  is_public      boolean not null default true,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);

insert into geo.plans (id, name, price_monthly_grosze, price_yearly_grosze, entitlements, sort_order) values
  ('free', 'Free', 0, null,
   '{"prompts": 5, "platforms": ["chatgpt", "gemini"], "frequency": "once", "domains": 1, "competitors": 5, "premium_profile": false, "autofix": false, "reports": ["basic"]}', 0),
  ('monitor', 'Monitor', 9900, 99000,
   '{"prompts": 50, "platforms": ["chatgpt", "gemini"], "frequency": "weekly", "domains": 1, "competitors": 10, "premium_profile": false, "autofix": false, "reports": ["basic", "history", "sources"], "alerts": true}', 10),
  ('growth', 'Growth', 29900, 299000,
   '{"prompts": 100, "platforms": ["chatgpt", "gemini"], "frequency": "weekly", "domains": 1, "competitors": 20, "premium_profile": true, "autofix": true, "reports": ["basic", "history", "sources", "source_gap"], "alerts": true}', 20),
  ('agency', 'Agency', 79000, 790000,
   '{"prompts": 300, "platforms": ["chatgpt", "gemini"], "frequency": "weekly", "domains": 10, "competitors": 20, "premium_profile": true, "autofix": true, "reports": ["basic", "history", "sources", "source_gap", "white_label"], "alerts": true}', 30);

-- Abonament konta. Źródło prawdy o płatnościach to operator płatności (Stripe), tu kopia stanu z webhooków.
create table geo.subscriptions (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references geo.accounts (id),
  plan_id          text not null references geo.plans (id),
  status           text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete')),
  provider         text not null default 'stripe',
  provider_customer_id     text,
  provider_subscription_id text unique,
  current_period_end timestamptz,
  canceled_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index subscriptions_account_idx on geo.subscriptions (account_id);

-- Płatności klientów (każda opłacona faktura), z kwotą netto bez VAT. Unikalny identyfikator operatora daje
-- idempotencję webhooków: ten sam event zapisany dwa razy nie podwaja prowizji.
create table geo.payments (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references geo.accounts (id),
  provider         text not null default 'stripe',
  provider_payment_id text not null,
  kind             text not null check (kind in ('payment', 'refund', 'chargeback')),
  amount_net_grosze bigint not null,     -- płatność dodatnia, zwrot i obciążenie zwrotne ujemne
  amount_gross_grosze bigint not null,
  currency         text not null default 'PLN' check (currency = 'PLN'),
  description      text,
  occurred_at      timestamptz not null,
  created_at       timestamptz not null default now(),
  unique (provider, provider_payment_id, kind)
);
create index payments_account_idx on geo.payments (account_id, occurred_at);

-- ===== Program partnerski =====

-- Warunki programu w wersjach. Prowizja zapisuje wersję i stawkę, więc zmiana warunków nie zmienia historii.
create table geo.affiliate_terms (
  version        text primary key,
  rate_bps       int not null check (rate_bps between 0 and 10000),    -- 2000 = 20%
  cookie_days    int not null check (cookie_days between 1 and 365),
  hold_days      int not null check (hold_days between 0 and 180),     -- okres na zwroty przed wypłatą
  min_payout_grosze bigint not null check (min_payout_grosze >= 0),
  lifetime       boolean not null default true,
  valid_from     timestamptz not null default now(),
  text_url       text
);
insert into geo.affiliate_terms (version, rate_bps, cookie_days, hold_days, min_payout_grosze, lifetime)
values ('2026-11', 2000, 90, 30, 10000, true);

create table geo.affiliates (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references geo.users (id),
  code           text not null check (code ~ '^[a-z0-9]{4,24}$'),
  status         text not null default 'active' check (status in ('active', 'suspended', 'banned')),
  rate_bps       int check (rate_bps between 0 and 10000),             -- indywidualna stawka, null = z warunków
  terms_version  text not null references geo.affiliate_terms (version),
  terms_accepted_at timestamptz not null,
  payout_name    text check (char_length(payout_name) <= 200),
  payout_iban    text check (payout_iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$'),
  payout_is_company boolean,
  payout_nip     text check (payout_nip ~ '^[0-9]{10}$'),
  created_at     timestamptz not null default now()
);
create unique index affiliates_code_uidx on geo.affiliates (code);

-- Kliknięcia linków. Bez adresu IP: tylko skrót z solą dnia (jak w page_views katalogu).
create table geo.affiliate_clicks (
  id             bigint generated always as identity primary key,
  affiliate_id   uuid not null references geo.affiliates (id),
  created_at     timestamptz not null default now(),
  landing_path   text check (char_length(landing_path) <= 300),
  campaign       text check (char_length(campaign) <= 60),
  referrer_host  text check (char_length(referrer_host) <= 200),
  visitor        text check (char_length(visitor) <= 32)
);
create index affiliate_clicks_aff_idx on geo.affiliate_clicks (affiliate_id, created_at);

-- Polecenie: konto klienta przypisane do partnera raz i na stałe (prowizja dożywotnia).
create table geo.referrals (
  account_id     uuid primary key references geo.accounts (id),
  affiliate_id   uuid not null references geo.affiliates (id),
  click_id       bigint references geo.affiliate_clicks (id),
  campaign       text check (char_length(campaign) <= 60),
  attributed_at  timestamptz not null default now(),
  status         text not null default 'active' check (status in ('active', 'rejected')),
  rejected_reason text
);
create index referrals_aff_idx on geo.referrals (affiliate_id);

create table geo.affiliate_payouts (
  id             uuid primary key default gen_random_uuid(),
  affiliate_id   uuid not null references geo.affiliates (id),
  amount_grosze  bigint not null check (amount_grosze > 0),
  status         text not null default 'pending' check (status in ('pending', 'paid', 'canceled')),
  created_at     timestamptz not null default now(),
  paid_at        timestamptz,
  reference      text check (char_length(reference) <= 200)   -- tytuł przelewu, numer rachunku lub faktury partnera
);

-- Pozycje prowizji: jedna na płatność (dodatnia) albo zwrot (ujemna). Zawsze z zapisaną stawką i podstawą.
create table geo.commissions (
  id             uuid primary key default gen_random_uuid(),
  affiliate_id   uuid not null references geo.affiliates (id),
  account_id     uuid not null references geo.accounts (id),
  payment_id     uuid not null unique references geo.payments (id),
  base_net_grosze bigint not null,
  rate_bps       int not null,
  amount_grosze  bigint not null,
  terms_version  text not null references geo.affiliate_terms (version),
  status         text not null default 'pending' check (status in ('pending', 'approved', 'void', 'paid')),
  available_at   timestamptz not null,                          -- data płatności + okres na zwroty
  payout_id      uuid references geo.affiliate_payouts (id),
  created_at     timestamptz not null default now()
);
create index commissions_aff_idx on geo.commissions (affiliate_id, status, available_at);

-- Lista oczekujących na start (prawdziwy formularz na stronie, zanim ruszy audyt).
create table geo.waitlist (
  id             uuid primary key default gen_random_uuid(),
  email          text not null check (char_length(email) between 3 and 254),
  domain         text check (char_length(domain) <= 253),
  affiliate_code text check (char_length(affiliate_code) <= 24),
  created_at     timestamptz not null default now()
);
create unique index waitlist_email_uidx on geo.waitlist (lower(email));

do $$
begin
  -- Osobna rola aplikacji GEO (geo_app). Rola portali (katalog_app) nie ma dostępu do danych klientów i partnerów.
  if exists (select 1 from pg_roles where rolname = 'geo_app') then
    grant usage on schema geo to geo_app;
    grant select, insert, update, delete on all tables in schema geo to geo_app;
    grant usage, select on all sequences in schema geo to geo_app;
  end if;
end
$$;
