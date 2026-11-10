-- Zgłoszenia ze strony /dla-firm: korekta danych, usunięcie wpisu, inne sprawy.
-- Przechowujemy tylko to, co potrzebne do rozpatrzenia i odpowiedzi (adres e-mail zgłaszającego, opcjonalnie NIP).
create table requests (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('correction', 'removal', 'other')),
  nip             text check (nip ~ '^[0-9]{10}$'),
  requester_email text not null check (char_length(requester_email) <= 254),
  message         text not null check (char_length(message) between 10 and 2000),
  status          text not null default 'new' check (status in ('new', 'in_progress', 'done', 'rejected')),
  admin_note      text check (char_length(admin_note) <= 1000),
  handled_by      text,
  handled_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index requests_status_idx on requests (status, created_at desc);

-- Rola aplikacji webowej (jeśli istnieje w tej bazie) dostaje dostęp do nowej tabeli.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'katalog_app') then
    grant select, insert, update, delete on requests to katalog_app;
  end if;
end
$$;
