-- Kiedy automat ostatnio ponownie sprawdzał w rejestrze biuro bez potwierdzenia (etap reverify).
-- Pierwsza weryfikacja widzi tylko stronę główną, kontakt i politykę prywatności; ponowna korzysta ze wszystkich
-- pobranych podstron, na których NIP często dopiero się pojawia.
alter table domains add column if not exists reverified_at timestamptz;
