-- Zapytania klientów z formularza na stronie firmy. Trafiają do panelu admina (zakładka Zapytania klientów).
create table leads (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid references listings(id) on delete set null,
  brand_id    uuid references brands(id) on delete set null,
  topic       text not null check (topic in ('kupno', 'sprzedaz', 'wynajem', 'najem', 'wycena', 'inne')),
  name        text not null check (char_length(name) between 2 and 100),
  email       text not null check (char_length(email) <= 254),
  phone       text check (char_length(phone) <= 30),
  message     text not null check (char_length(message) between 10 and 2000),
  status      text not null default 'new' check (status in ('new', 'done')),
  handled_by  text,
  handled_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index leads_status_idx on leads (status, created_at desc);
create index leads_brand_idx on leads (brand_id, created_at desc);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'katalog_app') then
    grant select, insert, update, delete on leads to katalog_app;
  end if;
end
$$;
