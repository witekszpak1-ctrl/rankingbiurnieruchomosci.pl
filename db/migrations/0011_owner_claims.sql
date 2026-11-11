-- Zgłoszenia właścicieli firm ze strony biura (przycisk "Jestem właścicielem tej firmy").
create table owner_claims (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid references listings(id) on delete set null,
  brand_id    uuid references brands(id) on delete set null,
  name        text not null check (char_length(name) between 2 and 120),
  role        text check (char_length(role) <= 80),
  email       text not null check (char_length(email) <= 254),
  phone       text check (char_length(phone) <= 30),
  nip         text check (nip is null or nip ~ '^[0-9]{10}$'),
  wants       text not null check (wants in ('update', 'claim', 'remove', 'other')),
  message     text check (char_length(message) <= 2000),
  status      text not null default 'new' check (status in ('new', 'done', 'rejected')),
  handled_by  text,
  handled_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index owner_claims_status_idx on owner_claims (status, created_at desc);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'katalog_app') then
    grant select, insert, update, delete on owner_claims to katalog_app;
  end if;
end
$$;
