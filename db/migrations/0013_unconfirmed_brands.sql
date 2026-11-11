-- Biura bez potwierdzenia w rejestrze (brak NIP na stronie) też trafiają do katalogu, z niższym rankingiem.
-- Ich marka nie ma podmiotu z rejestru.
alter table brands alter column legal_entity_id drop not null;
