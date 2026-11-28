-- Robot wielobranżowy: domeny i kolejka miast per branża (nieruchomości działają na produkcji, biura rachunkowe są następne).
-- Migracja addytywna: nic nie jest usuwane ani zmieniane w istniejących kolumnach. Wymaga roli właściciela bazy
-- (alter table, create table); automat (katalog migrate z rolą bez DDL) jej nie wykona, więc stosuje ją właściciel.

-- 1. Branża domeny. Domena należy do branży wyszukiwania, w którym ją znaleziono (domains.host zostaje unikalny globalnie,
--    więc domena znaleziona najpierw w jednej branży nie jest dodawana drugi raz w drugiej).
--    Kolumna nullable: kod traktuje brak wartości jak nieruchomości (domeny dodane przez stary kod między migracją a wdrożeniem).
alter table domains add column if not exists vertical_id uuid references verticals(id);

-- Istniejące domeny to nieruchomości. Na pustej bazie (testy) wiersza branży jeszcze nie ma, więc update nic nie zmienia.
update domains set vertical_id = (select id from verticals where slug = 'nieruchomosci') where vertical_id is null;

create index if not exists domains_vertical_idx on domains (vertical_id, verification_status);

-- 2. Kolejka miast per branża dla branż innych niż nieruchomości. Nieruchomości zostają przy kolumnach cities.*
--    (search_enabled, search_priority, last_searched_at, deep_requested_at, deep_search), bo steruje nimi panel
--    administracyjny (zakładka Miasta). Dlatego nie kopiujemy ich tu: kopia od razu by się rozjechała z panelem.
create table if not exists vertical_cities (
  vertical_id       uuid not null references verticals(id) on delete cascade,
  city_id           uuid not null references cities(id) on delete cascade,
  search_enabled    boolean not null default true,
  search_priority   integer,
  deep_search       boolean not null default false,
  last_searched_at  timestamptz,
  deep_requested_at timestamptz,
  primary key (vertical_id, city_id)
);
create index if not exists vertical_cities_queue_idx on vertical_cities (vertical_id, search_enabled, search_priority);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'katalog_app') then
    grant select, insert, update, delete on vertical_cities to katalog_app;
  end if;
end
$$;
