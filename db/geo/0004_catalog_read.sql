-- Darmowy audyt widoczności w AI (apps/geo) czyta katalog firm tylko do odczytu: dopasowanie domeny do firmy,
-- miasto, profil w katalogu i ocena z Google. Rola geo_app dostaje wyłącznie SELECT na sześciu tabelach katalogu
-- (bez dostępu do danych kontaktowych, faktów, cen, zgłoszeń i leadów). Idempotentne.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'geo_app') then
    grant usage on schema public to geo_app;
    grant select on public.brands, public.domains, public.listings, public.cities, public.google_places, public.verticals to geo_app;
  end if;
end
$$;
