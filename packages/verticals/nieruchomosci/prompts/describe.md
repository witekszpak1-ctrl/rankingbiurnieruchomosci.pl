# Zadanie dla Claude Code: opis firmy (typ `describe`)

Przetwarzasz paczki z `queue/pending/describe/*.json` i zapisujesz wyniki w `queue/results/describe/<firm_id>.json`
(ta sama nazwa pliku). Walidator w kodzie odrzuca wynik, który łamie zasady poniżej, więc nie ma sensu ich obchodzić.

## Zasady

1. Używasz wyłącznie faktów z paczki (`facts`) i tekstu źródłowego (`source_text`). Niczego nie dopowiadasz z wiedzy ogólnej.
2. Opis ma 2-3 zdania, od 80 do 700 znaków, po polsku, neutralnym tonem. Bez superlatywów ("najlepszy", "numer 1",
   "lider", "gwarantujemy"), chyba że dokładnie tak brzmi cytowany fakt.
3. **Nie przepisujesz zdań ze strony firmy.** Parafrazuj własnymi słowami. Walidator liczy nakładanie się 5-wyrazowych
   fragmentów ze źródłem i odrzuca opisy zbyt podobne (próg domyślnie 20%).
4. Opis składa się z twierdzeń (`claims`). Każde twierdzenie to jedno zdanie i wskazuje `fact_ids` z paczki, na których
   się opiera. Tekst opisu musi być dokładnie złączeniem twierdzeń (spacja między nimi).
5. Nie wpisujesz e-maili, telefonów ani adresów stron w opisie. W paczce ich zresztą nie ma.
6. `registry_start_date` to data wpisu do rejestru (KRS lub wykaz VAT), nie dowód początku działalności. Pisz
   "wpisane do rejestru w ... roku", nie "działa od ...".

## Usługi (`services`)

Lista usług, które firma wprost wymienia. Każda ma `quote`: dosłowny cytat ze strony (po normalizacji spacji i wielkości
liter musi występować w `source_text` pod podanym `source_url`).

## Ceny (`prices`)

Tylko dla kandydatów z `price_candidates`, gdy fragment naprawdę opisuje cenę usługi.

- `candidate_id` z paczki, `source_url` strony, z której pochodzi kandydat.
- `quote`: dosłowny cytat z `snippet` kandydata, zawierający liczbę (np. `od 2,5% + VAT`).
- `unit`: `percent`, `pln`, `pln_per_month` albo `other`. Wartości `amount_min` i `amount_max` muszą występować w cytacie.
- `tax_mode`: `plus_vat` gdy cytat ma "+ VAT", `net` gdy "netto", `gross` gdy "brutto", w przeciwnym razie `unknown`.
  Nie zgaduj trybu VAT, którego nie ma w cytacie.
- Jeśli nie jesteś pewien, pomiń cenę. Brak ceny jest lepszy niż błędna.

## Format wyniku

```json
{
  "schema_version": 1,
  "firm_id": "<firm_id z paczki>",
  "bundle_sha256": "<bundle_sha256 z paczki, bez zmian>",
  "description": {
    "text": "Zdanie pierwsze. Zdanie drugie.",
    "claims": [
      {"text": "Zdanie pierwsze.", "fact_ids": ["f1", "f3"]},
      {"text": "Zdanie drugie.", "fact_ids": ["f2"]}
    ]
  },
  "services": [
    {"name": "sprzedaż mieszkań", "quote": "dosłowny cytat", "source_url": "https://..."}
  ],
  "prices": [
    {
      "candidate_id": "p1",
      "service": "pośrednictwo w sprzedaży",
      "unit": "percent",
      "amount_min": 2.5,
      "amount_max": null,
      "tax_mode": "plus_vat",
      "quote": "od 2,5% + VAT",
      "source_url": "https://...",
      "conditions": null
    }
  ]
}
```

## Jak pracować partiami

1. Weź partię 50-70 paczek. Rozdziel je na subagentów po ok. 10 (każdy w czystym kontekście).
2. Po zapisaniu wyniku sprawdź go: `katalog validate --bundle <paczka> --result <wynik>`. Kod wyjścia 0 = poprawny.
3. Wynik odrzucony popraw tylko wtedy, gdy powód jest jasny. W razie wątpliwości zostaw plik bez wyniku. Import
   (`katalog import`) odrzuci niepoprawny wynik z kodem błędu w `queue_items.validator_report`.
