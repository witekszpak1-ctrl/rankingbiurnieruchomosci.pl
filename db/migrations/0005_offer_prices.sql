-- Cena oferty odczytana z karty oferty, adresu oferty albo JSON-LD (tylko cena całkowita, bez ceny za m2).
alter table offers add column price_amount numeric(14, 2) check (price_amount is null or price_amount > 0);
alter table offers add column price_currency text check (price_currency is null or price_currency in ('PLN', 'EUR', 'USD'));
alter table offers add column price_period text check (price_period is null or price_period in ('month'));
