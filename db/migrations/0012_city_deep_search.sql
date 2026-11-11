-- Dokładne przeszukiwanie miasta (zapytania po dzielnicach i rodzajach usług), zlecane z panelu albo dla dużych miast.
alter table cities add column deep_search boolean not null default false;
alter table cities add column deep_requested_at timestamptz;
