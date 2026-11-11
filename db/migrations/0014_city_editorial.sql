-- Własna treść redakcyjna strony miasta (opcjonalna), wpisywana w panelu.
alter table cities add column editorial text check (editorial is null or char_length(editorial) <= 4000);
