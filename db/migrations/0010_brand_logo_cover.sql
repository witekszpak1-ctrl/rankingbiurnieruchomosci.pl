-- Osobno logo firmy (do kółka i miniatur) i zdjęcie (do banera i kart). Wcześniej był jeden obrazek, często logo.
alter table brands add column logo_url text check (logo_url is null or logo_url ~ '^https://');
alter table brands add column cover_url text check (cover_url is null or cover_url ~ '^https://');
