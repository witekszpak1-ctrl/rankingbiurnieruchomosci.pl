-- Indeks na domains.brand_id. Worker i strona szukają domen marki (where d.brand_id = b.id) w podzapytaniach
-- dla każdej marki, a bez indeksu każde takie zapytanie przeszukiwało całą tabelę domen.
-- Na produkcji założony ręcznie (create index concurrently) 27.11.2026 i wpisany do schema_migrations.
create index if not exists domains_brand_idx on domains (brand_id);
