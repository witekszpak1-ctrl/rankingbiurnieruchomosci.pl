-- Etap 2 planu poprawy: skąd pochodzi miasto wpisu i przekierowania starych adresów profili.
-- city_source: adres_wyszukiwanie, rejestr_adres, rejestr, adres, wzmianka (katalog_worker/city.py).
alter table listings add column if not exists city_source text;
alter table listings add column if not exists city_source_at timestamptz;

-- Stary adres profilu (/miasto/slug) przeniesionego albo scalonego wpisu: strona odpowiada przekierowaniem stałym
-- na obecny adres wpisu.
create table if not exists listing_redirects (
  from_path  text primary key,
  listing_id uuid not null references listings(id) on delete cascade,
  created_at timestamptz not null default now()
);
