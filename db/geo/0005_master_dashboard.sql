-- Master Dashboard (apps/geo, /admin): rejestr portali i widoki tylko do odczytu na dane katalogu, robota, ruchu i kosztów.
-- Wymaga roli właściciela bazy (create table, create view). Idempotentne.
--
-- Widoki są w schemacie geo i należą do roli, która stosuje migrację (właściciel bazy), więc wykonują się z jej prawami:
-- geo_app dostaje SELECT wyłącznie na widokach, a nie na tabelach public.* (w szczególności nie na public.settings,
-- gdzie leży klucz LiteScrape). v_api_usage czyta z settings tylko klucz 'api_usage'.

-- ================================================================ rejestr portali

create table if not exists geo.portals (
  slug           text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  name           text not null check (char_length(name) between 2 and 120),
  url            text check (char_length(url) <= 300),
  domain         text check (char_length(domain) <= 253),
  vercel_project text check (char_length(vercel_project) <= 100),
  status         text not null default 'planned' check (status in ('live', 'private', 'planned')),
  notes          text check (char_length(notes) <= 1000),
  sort_order     int not null default 0,
  updated_at     timestamptz not null default now()
);

insert into geo.portals (slug, name, url, domain, vercel_project, status, notes, sort_order) values
  ('nieruchomosci', 'Ranking Biur Nieruchomości', 'https://rankingbiurnieruchomosci.pl', 'rankingbiurnieruchomosci.pl', 'rankingbiurnieruchomosc.pl', 'live', 'Portal nr 1, działa na produkcji.', 1),
  ('rachunkowe', 'Ranking Biur Rachunkowych', 'https://portal-rachunkowe-witek1.vercel.app', null, 'portal-rachunkowe', 'private', 'Wdrożony prywatnie, widoczny po zalogowaniu do Vercel.', 2),
  ('oze', 'Prąd i Ciepło', 'https://portal-oze-witek1.vercel.app', null, 'portal-oze', 'private', 'Fotowoltaika, pompy ciepła i klimatyzacja. Nazwa robocza.', 3),
  ('remonty', 'Odnowa Domu', 'https://portal-remonty-witek1.vercel.app', null, 'portal-remonty', 'private', 'Firmy remontowe i wykończeniowe. Nazwa robocza.', 4),
  ('budowlane', 'Pod Klucz', 'https://portal-budowlane-witek1.vercel.app', null, 'portal-budowlane', 'private', 'Firmy budowlane (domy). Nazwa robocza.', 5),
  ('warsztaty', 'Pod Maską', 'https://portal-warsztaty-witek1.vercel.app', null, 'portal-warsztaty', 'private', 'Warsztaty samochodowe. Nazwa robocza.', 6),
  ('przeprowadzki', 'Nowy Adres', 'https://portal-przeprowadzki-witek1.vercel.app', null, 'portal-przeprowadzki', 'private', 'Firmy przeprowadzkowe. Nazwa robocza.', 7),
  ('weterynarze', 'Cztery Łapy', 'https://portal-weterynarze-witek1.vercel.app', null, 'portal-weterynarze', 'private', 'Kliniki weterynaryjne. Przed publikacją opinia prawna. Nazwa robocza.', 8),
  ('architekci', 'Architekci', null, null, null, 'planned', 'Portal nr 9 z kolejności w DECISIONS.md.', 9),
  ('wnetrza', 'Projektanci wnętrz', null, null, null, 'planned', 'Portal nr 10.', 10),
  ('instalacje', 'Firmy instalacyjne (hydraulika, elektryka)', null, null, null, 'planned', 'Portal nr 11.', 11),
  ('marketing', 'Agencje marketingowe', null, null, null, 'planned', 'Portal nr 12.', 12),
  ('informatyka', 'Firmy informatyczne', null, null, null, 'planned', 'Portal nr 13.', 13),
  ('stomatologia', 'Dentyści i kliniki stomatologiczne', null, null, null, 'planned', 'Portal nr 14, po opinii prawnej (reklama lekarzy), bez nagrań sesji.', 14),
  ('medycyna-estetyczna', 'Medycyna estetyczna', null, null, null, 'planned', 'Portal nr 15, po opinii prawnej.', 15),
  ('kancelarie', 'Kancelarie prawne', null, null, null, 'planned', 'Portal nr 16, po opinii prawnej (zakaz reklamy adwokatów i radców).', 16),
  ('transport', 'Firmy transportowe', null, null, null, 'planned', 'Portal nr 17, słabe dopasowanie do lokalnego katalogu, na koniec.', 17),
  ('ubezpieczenia', 'Ubezpieczenia', null, null, null, 'planned', 'Portal nr 18, jak wyżej.', 18)
on conflict (slug) do nothing;

-- ================================================================ widoki: katalog

-- Statystyki per branża (slug branży = slug portalu). Domeny, firmy, oferty, profile i oceny z Google.
create or replace view geo.v_portal_stats as
select
  v.slug,
  v.name as vertical_name,
  coalesce(d.total, 0) as domains_total,
  coalesce(d.queue_probe, 0) as domains_queue_probe,
  coalesce(d.queue_verify, 0) as domains_queue_verify,
  coalesce(d.st_candidate, 0) as domains_candidate,
  coalesce(d.st_verified, 0) as domains_verified,
  coalesce(d.st_probable, 0) as domains_probable,
  coalesce(d.st_needs_review, 0) as domains_needs_review,
  coalesce(d.st_rejected, 0) as domains_rejected,
  coalesce(d.cl_unknown, 0) as domains_cl_unknown,
  coalesce(d.cl_official, 0) as domains_cl_official,
  coalesce(d.cl_directory, 0) as domains_cl_directory,
  coalesce(d.cl_marketplace, 0) as domains_cl_marketplace,
  coalesce(d.cl_media, 0) as domains_cl_media,
  coalesce(d.cl_irrelevant, 0) as domains_cl_irrelevant,
  coalesce(d.cl_parked, 0) as domains_cl_parked,
  coalesce(d.cl_uncertain, 0) as domains_cl_uncertain,
  d.last_seen_at as domains_last_seen_at,
  d.last_checked_at as domains_last_checked_at,
  coalesce(l.brands, 0) as brands,
  coalesce(l.n_candidate, 0) as listings_candidate,
  coalesce(l.n_needs_review, 0) as listings_needs_review,
  coalesce(l.n_verified, 0) as listings_verified,
  coalesce(l.n_published, 0) as listings_published,
  coalesce(l.n_rejected, 0) as listings_rejected,
  coalesce(l.n_removed, 0) as listings_removed,
  coalesce(l.published_cities, 0) as published_cities,
  l.last_published_at,
  coalesce(g.rated, 0) as google_rated_brands,
  g.avg_rating as google_avg_rating
from public.verticals v
left join (
  select vertical_id,
         count(*)::int as total,
         count(*) filter (where classification = 'unknown' and verification_status = 'candidate')::int as queue_probe,
         count(*) filter (where classification in ('official', 'uncertain') and verification_status = 'candidate')::int as queue_verify,
         count(*) filter (where verification_status = 'candidate')::int as st_candidate,
         count(*) filter (where verification_status = 'verified')::int as st_verified,
         count(*) filter (where verification_status = 'probable')::int as st_probable,
         count(*) filter (where verification_status = 'needs_review')::int as st_needs_review,
         count(*) filter (where verification_status = 'rejected')::int as st_rejected,
         count(*) filter (where classification = 'unknown')::int as cl_unknown,
         count(*) filter (where classification = 'official')::int as cl_official,
         count(*) filter (where classification = 'directory')::int as cl_directory,
         count(*) filter (where classification = 'marketplace')::int as cl_marketplace,
         count(*) filter (where classification = 'media')::int as cl_media,
         count(*) filter (where classification = 'irrelevant')::int as cl_irrelevant,
         count(*) filter (where classification = 'parked')::int as cl_parked,
         count(*) filter (where classification = 'uncertain')::int as cl_uncertain,
         max(first_seen_at) as last_seen_at,
         max(last_checked_at) as last_checked_at
    from public.domains group by vertical_id
) d on d.vertical_id = v.id
left join (
  select vertical_id,
         count(distinct brand_id) filter (where status not in ('rejected', 'removed'))::int as brands,
         count(*) filter (where status = 'candidate')::int as n_candidate,
         count(*) filter (where status = 'needs_review')::int as n_needs_review,
         count(*) filter (where status = 'verified')::int as n_verified,
         count(*) filter (where status = 'published')::int as n_published,
         count(*) filter (where status = 'rejected')::int as n_rejected,
         count(*) filter (where status = 'removed')::int as n_removed,
         count(distinct city_id) filter (where status = 'published')::int as published_cities,
         max(published_at) as last_published_at
    from public.listings group by vertical_id
) l on l.vertical_id = v.id
left join (
  select b.vertical_id, count(*)::int as rated, round(avg(b.rating), 2) as avg_rating
    from (
      select distinct li.vertical_id, li.brand_id, gp.rating
        from public.listings li
        join public.google_places gp on gp.brand_id = li.brand_id
       where li.status = 'published' and gp.rating is not null
    ) b
   group by b.vertical_id
) g on g.vertical_id = v.id;

-- Opublikowane profile per miasto i branża (wykres w szczegółach portalu).
create or replace view geo.v_portal_cities as
select v.slug, c.name as city, count(*)::int as published
  from public.listings li
  join public.verticals v on v.id = li.vertical_id
  join public.cities c on c.id = li.city_id
 where li.status = 'published'
 group by v.slug, c.name;

-- Nowe domeny znalezione danego dnia (UTC) per branża, ostatnie 120 dni.
create or replace view geo.v_domains_daily as
select ((d.first_seen_at at time zone 'UTC')::date) as day, v.slug, count(*)::int as new_domains
  from public.domains d
  join public.verticals v on v.id = d.vertical_id
 where d.first_seen_at > now() - interval '120 days'
 group by 1, 2;

-- ================================================================ widoki: robot

-- Przebiegi robota. Błąd: pierwszy wpis listy errors, skrócony do 300 znaków.
create or replace view geo.v_pipeline_runs as
select r.id,
       r.stage,
       v.slug as vertical,
       r.status,
       r.started_at,
       r.finished_at,
       r.counts,
       r.cost_usd,
       case when jsonb_typeof(r.errors) = 'array' and jsonb_array_length(r.errors) > 0
            then left(coalesce(r.errors -> 0 ->> 'message', r.errors ->> 0), 300) end as error
  from public.pipeline_runs r
  left join public.verticals v on v.id = r.vertical_id;

-- Zapytania wyszukiwania per dzień (UTC), branża i dostawca. Zapytania sprzed wielobranżowości (bez branży) to nieruchomości.
create or replace view geo.v_search_daily as
select ((q.created_at at time zone 'UTC')::date) as day,
       coalesce(v.slug, 'nieruchomosci') as vertical,
       q.provider,
       count(*)::int as queries,
       coalesce(sum(q.results_count), 0)::int as results,
       coalesce(sum(q.new_domains), 0)::int as new_domains
  from public.search_queries q
  left join public.verticals v on v.id = q.vertical_id
 where q.created_at > now() - interval '120 days'
 group by 1, 2, 3;

-- ================================================================ widoki: koszty

-- Liczniki płatnych API z settings.api_usage (miesiąc, usługa, liczba). Czytamy wyłącznie ten jeden klucz.
create or replace view geo.v_api_usage as
select m.key as month,
       s.key as service,
       case when jsonb_typeof(s.value) = 'number' then (s.value #>> '{}')::numeric::bigint end as count
  from public.settings st
 cross join lateral jsonb_each(case when jsonb_typeof(st.value -> 'months') = 'object' then st.value -> 'months' else '{}'::jsonb end) m
 cross join lateral jsonb_each(case when jsonb_typeof(m.value) = 'object' then m.value else '{}'::jsonb end) s
 where st.key = 'api_usage';

-- Limity miesięczne z tego samego klucza (usługa, limit).
create or replace view geo.v_api_limits as
select l.key as service,
       case when jsonb_typeof(l.value) = 'number' then (l.value #>> '{}')::numeric::bigint end as monthly_limit
  from public.settings st
 cross join lateral jsonb_each(case when jsonb_typeof(st.value -> 'limits') = 'object' then st.value -> 'limits' else '{}'::jsonb end) l
 where st.key = 'api_usage';

-- ================================================================ widoki: ruch (portal nieruchomości, page_views nie ma kolumny host)

create or replace view geo.v_traffic_daily as
select ((created_at at time zone 'UTC')::date) as day,
       is_bot,
       bot,
       count(*)::int as views,
       count(distinct visitor)::int as visitors
  from public.page_views
 where created_at > now() - interval '120 days'
 group by 1, 2, 3;

create or replace view geo.v_referrers_30d as
select referrer_host, count(*)::int as views, count(distinct visitor)::int as visitors
  from public.page_views
 where created_at > now() - interval '30 days' and is_bot = false and referrer_host is not null
 group by referrer_host;

-- ================================================================ widoki: zgłoszenia (bez danych osobowych)

create or replace view geo.v_leads_daily as
select ((created_at at time zone 'UTC')::date) as day, count(*)::int as count
  from public.leads
 group by 1;

create or replace view geo.v_requests_count as
select count(*)::int as total, count(*) filter (where status = 'new')::int as new from public.requests;

create or replace view geo.v_claims_count as
select count(*)::int as total, count(*) filter (where status = 'new')::int as new from public.owner_claims;

-- ================================================================ uprawnienia

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'geo_app') then
    grant usage on schema geo to geo_app;
    grant select, update on geo.portals to geo_app;
    grant select on geo.v_portal_stats, geo.v_portal_cities, geo.v_domains_daily, geo.v_pipeline_runs, geo.v_search_daily,
                    geo.v_api_usage, geo.v_api_limits, geo.v_traffic_daily, geo.v_referrers_30d, geo.v_leads_daily,
                    geo.v_requests_count, geo.v_claims_count to geo_app;
  end if;
end
$$;
