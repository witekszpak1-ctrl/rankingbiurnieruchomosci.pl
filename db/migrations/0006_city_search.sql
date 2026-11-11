-- Kolejka wyszukiwania biur po miastach, sterowana z panelu (zakładka Miasta).
alter table cities add column search_enabled boolean not null default true;
alter table cities add column search_priority integer;
alter table cities add column last_searched_at timestamptz;
create index cities_search_idx on cities (search_enabled, search_priority);
