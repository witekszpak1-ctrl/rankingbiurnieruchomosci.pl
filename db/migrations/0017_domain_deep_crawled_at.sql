-- Kiedy automat ostatnio próbował dobrać podstrony domeny (etap crawl-deep).
-- Małe witryny mają mniej niż 3 podstrony i nigdy nie dobijają do progu; bez tej daty liczyły się
-- jako praca do zrobienia w każdym przebiegu i napędzały kolejne przebiegi bez końca.
alter table domains add column if not exists deep_crawled_at timestamptz;
