# Zadanie dla Claude Code: opis firmy (typ `describe`)

Przetwarzasz paczki z `queue/pending/describe/*.json` i zapisujesz wyniki w `queue/results/describe/<firm_id>.json`
(ta sama nazwa pliku). Walidator w kodzie odrzuca wynik, który łamie zasady poniżej, więc nie ma sensu ich obchodzić.

## Zasady

1. Używasz wyłącznie faktów z paczki (`facts`) i tekstu źródłowego (`source_text`). Niczego nie dopowiadasz z wiedzy ogólnej.
2. Opis ma 4-6 zdań, zwykle 450-1200 znaków (twardy limit walidatora: 80-1400), po polsku, neutralnym tonem.
   Bez superlatywów ("najlepszy", "numer 1", "lider", "gwarantujemy"), chyba że dokładnie tak brzmi cytowany fakt.
   Dobry opis odpowiada na pytania klienta, o ile paczka ma na to fakty: czym biuro się zajmuje i dla kogo (sprzedaż,
   wynajem, kupno, rynek pierwotny/wtórny, nieruchomości komercyjne, zarządzanie najmem), jakie usługi wprost wymienia,
   na jakim obszarze działa (miasto, dzielnice, okolice), jakie nieruchomości ma w ofercie, od kiedy jest w rejestrze
   i czy publikuje prowizje. Każde zdanie wnosi nową informację. Gdy faktów jest mało, opis może być krótszy, ale nie
   dopowiadaj niczego spoza paczki.
3. **Nie przepisujesz zdań ze strony firmy.** Parafrazuj własnymi słowami. Walidator liczy nakładanie się 5-wyrazowych
   fragmentów ze źródłem i odrzuca opisy zbyt podobne (próg domyślnie 20%).
4. Opis składa się z twierdzeń (`claims`). Każde twierdzenie to jedno zdanie i wskazuje `fact_ids` z paczki, na których
   się opiera. Tekst opisu musi być dokładnie złączeniem twierdzeń (spacja między nimi).
5. Nie wpisujesz e-maili, telefonów ani adresów stron w opisie. W paczce ich zresztą nie ma.
7. Nie używasz długich myślników (U+2013, U+2014), tylko zwykły "-".
6. `registry_start_date` to data wpisu do rejestru (KRS lub wykaz VAT), nie dowód początku działalności. Pisz
   "wpisane do rejestru w ... roku", nie "działa od ...".

## Marka (`brand`)

Nazwa, pod którą firma przedstawia się na swojej stronie (np. "Traczyk Nieruchomości"), a nie tytuł strony pod SEO
("Dobre Biuro Nieruchomości Rynek Wtórny i Pierwotny") ani nazwa z rejestru, jeśli strona używa innej. `quote` to dosłowny
cytat ze `source_text` pod podanym `source_url`, który zawiera tę nazwę (np. stopka, nagłówek, "O nas"). Bez formy prawnej,
chyba że firma sama jej używa w nazwie. Jeśli nie da się ustalić nazwy z cytatem, pomiń pole `brand`.

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
  "brand": {"name": "Przykład Nieruchomości", "quote": "Przykład Nieruchomości to biuro...", "source_url": "https://..."},
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
