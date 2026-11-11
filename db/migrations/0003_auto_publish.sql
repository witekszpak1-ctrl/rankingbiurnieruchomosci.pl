-- Automatyczna publikacja wpisów spełniających bramkę (katalog publish-ready). Wyłączenie: value = 'false'.
-- Tylko DML, więc migrację może zastosować rola aplikacji bez prawa tworzenia tabel.
insert into settings (key, value) values ('auto_publish', 'true') on conflict (key) do nothing;
