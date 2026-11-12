-- Wszystkie wejścia na stronę publiczną, liczone po stronie serwera (bez skryptu w przeglądarce i bez plików cookie).
-- Nie zapisujemy adresu IP ani pełnego nagłówka User-Agent. Unikalnych odwiedzających liczymy po skrócie
-- (IP + przeglądarka + losowa sól dnia); sól jest usuwana po dobie, więc skrótu nie da się powiązać między dniami.
create table page_views (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  path          text not null check (char_length(path) <= 300),
  kind          text not null check (kind in ('page', 'nav')),   -- pełne wejście albo przejście w obrębie serwisu
  is_bot        boolean not null default false,
  bot           text check (char_length(bot) <= 60),
  visitor       text check (char_length(visitor) <= 32),
  referrer_host text check (char_length(referrer_host) <= 200),   -- tylko zewnętrzne źródło, bez ścieżki
  utm_source    text check (char_length(utm_source) <= 100),
  utm_medium    text check (char_length(utm_medium) <= 100),
  utm_campaign  text check (char_length(utm_campaign) <= 100),
  country       text check (char_length(country) <= 2),
  city          text check (char_length(city) <= 80),
  device        text check (device in ('mobile', 'tablet', 'desktop', 'other')),
  browser       text check (char_length(browser) <= 40),
  os            text check (char_length(os) <= 40)
);
create index page_views_created_idx on page_views (created_at);
create index page_views_path_idx on page_views (path, created_at);

create table visit_salts (
  day  date primary key,
  salt text not null
);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'katalog_app') then
    grant select, insert, update, delete on page_views, visit_salts to katalog_app;
  end if;
end
$$;
