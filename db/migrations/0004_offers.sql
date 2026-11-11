-- Oferty nieruchomości ze stron biur: tylko tytuł i link do oferty na stronie firmy (bez opisów, cen i zdjęć).
-- Aktywne są oferty z ostatniego udanego odczytu strony z ofertami (najwyżej 20 na domenę, w kolejności ze strony).
create table offers (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references brands(id) on delete cascade,
  domain_id     uuid not null references domains(id) on delete cascade,
  url           text not null check (url ~ '^https?://'),
  url_key       text not null,                  -- adres kanoniczny (bez www i parametrów śledzących), do porównań
  title         text not null check (char_length(title) between 3 and 200),
  position      integer not null default 0,
  is_active     boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  unique (domain_id, url_key)
);
create index offers_brand_idx on offers (brand_id, is_active, position);

-- Strona z listą ofert znaleziona na stronie firmy (zapamiętana, żeby codziennie pobierać tylko ją).
alter table domains add column offers_url text;
alter table domains add column offers_checked_at timestamptz;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'katalog_app') then
    grant select, insert, update, delete on offers to katalog_app;
  end if;
end
$$;
