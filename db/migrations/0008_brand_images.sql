-- Obrazek firmy ze strony (podgląd strony z og:image albo logo), do listy firm i karty firmy.
alter table brands add column image_url text check (image_url is null or image_url ~ '^https://');
alter table brands add column image_kind text check (image_kind is null or image_kind in ('og', 'logo', 'icon'));
alter table brands add column image_checked_at timestamptz;
