-- Warstwa Premium profilu: treści dostarczone przez firmę ("Informacje od firmy"), osobno od danych zweryfikowanych.
-- Migracja addytywna i idempotentna: nic nie jest usuwane ani zmieniane w istniejących tabelach. Wymaga roli właściciela
-- bazy (create table); automat (katalog migrate z rolą bez DDL) jej nie wykona, więc stosuje ją właściciel.
--
-- Zasada (docs/ops/DECISIONS.md, pkt 4): Premium tylko odsłania więcej danych i nie wpływa na wynik w rankingu.
-- Kod punktacji (apps/web/lib/ranking.ts, lib/catalog.ts) nie czyta tej tabeli; pilnuje tego test.
--
-- Zapisy będą pochodzić z platformy GeoTrace (osobna rola i osobna migracja nada im prawa zapisu). Rola portali
-- (katalog_app) dostaje tylko SELECT: strona publiczna wyłącznie czyta.

create table if not exists listing_premium (
  listing_id  uuid primary key references listings(id) on delete cascade,
  -- draft: widoczny tylko w podglądzie /podglad/<token>; published: widoczny na profilu.
  status      text not null default 'draft' check (status in ('draft', 'published')),
  -- Pola: long_description (tekst), specializations (tablica tekstów), service_areas (tablica tekstów),
  -- faq [{q, a}], team [{name, role}], gallery [{url, alt}], video_url, cta_label, cta_url.
  -- Strona waliduje i przycina każde pole przy odczycie (apps/web/lib/premium.ts), więc zła treść nie psuje profilu.
  content     jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  -- Skąd treść: np. "formularz firmy w GeoTrace, zgłoszenie z 28.11.2026" (ślad zgody i pochodzenia).
  source      text,
  approved_at timestamptz,
  updated_at  timestamptz not null default now()
);

create index if not exists listing_premium_status_idx on listing_premium (status);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'katalog_app') then
    grant select on listing_premium to katalog_app;
  end if;
end
$$;
