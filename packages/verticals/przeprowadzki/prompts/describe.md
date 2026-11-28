# Zadanie dla Claude Code: opis firmy (typ `describe`), branża: firmy przeprowadzkowe

Przetwarzasz paczki z `queue/pending/przeprowadzki/describe/*.json` i zapisujesz wyniki w `queue/results/przeprowadzki/describe/<firm_id>.json`
(ta sama nazwa pliku). Walidator w kodzie odrzuca wynik, który łamie zasady poniżej, więc nie ma sensu ich obchodzić.

## Zasady

1. Używasz wyłącznie faktów z paczki (`facts`) i tekstu źródłowego (`source_text`). Niczego nie dopowiadasz z wiedzy ogólnej.
2. Opis ma 4-6 zdań, zwykle 450-1200 znaków (twardy limit walidatora: 80-1400), po polsku, neutralnym tonem.
   Bez superlatywów ("najlepszy", "numer 1", "lider", "gwarantujemy"), chyba że dokładnie tak brzmi cytowany fakt.
   Dobry opis odpowiada na pytania klienta, o ile paczka ma na to fakty: czym firma się zajmuje (przeprowadzki mieszkań, domów, biur, transport mebli i pianin), jakie usługi wprost wymienia (pakowanie, wniesienie, demontaż i montaż mebli, magazynowanie, utylizacja), na jakim obszarze działa (miasto, kraj, zagranica), jak wycenia (stawka godzinowa, ryczałt, wycena na miejscu), jakie ma ubezpieczenie (tylko z faktu), od kiedy jest w rejestrze i czy publikuje cennik.
   Każde zdanie wnosi nową informację. Gdy faktów jest mało, opis może być krótszy, ale nie dopowiadaj niczego spoza paczki.
3. **Nie przepisujesz zdań ze strony firmy.** Parafrazuj własnymi słowami. Walidator liczy nakładanie się 5-wyrazowych
   fragmentów ze źródłem i odrzuca opisy zbyt podobne (próg domyślnie 20%).
4. Opis składa się z twierdzeń (`claims`). Każde twierdzenie to jedno zdanie i wskazuje `fact_ids` z paczki, na których
   się opiera. Tekst opisu musi być dokładnie złączeniem twierdzeń (spacja między nimi).
5. Nie wpisujesz e-maili, telefonów ani adresów stron w opisie. W paczce ich zresztą nie ma.
6. `registry_start_date` to data wpisu do rejestru (KRS, CEIDG lub wykaz VAT), nie dowód początku działalności. Pisz
   "wpisane do rejestru w ... roku", nie "działa od ...".
7. Nie używasz długich myślników (U+2013, U+2014), tylko zwykły "-".
8. Ubezpieczenie (OC przewoźnika, ubezpieczenie przewożonych rzeczy), licencje i pozwolenia transportowe, członkostwo w stowarzyszeniu opisujesz **tylko wtedy, gdy strona o nich wprost mówi**, i wtedy jako deklarację firmy ("według strony firma ubezpiecza przewożone rzeczy"). Nie wnioskuj ich z nazwy ani z branży. Nie piszesz, że firma jest "ubezpieczona" lub "licencjonowana", jeśli tego nie ma w paczce.
9. Nie obiecujesz rezultatów ("bez szkód", "bezstresowa przeprowadzka", "najtańsza oferta", "stała cena"), nawet gdy tak pisze strona. Opisujesz zakres usług i sposób wyceny, nie rezultat.

## Marka (`brand`)

Nazwa, pod którą firma przedstawia się na swojej stronie (np. "Przykład Przeprowadzki"), a nie tytuł strony pod SEO
("Przeprowadzki Wrocław - tanie przeprowadzki mieszkań i biur") ani nazwa z rejestru, jeśli strona używa innej. `quote` to dosłowny cytat ze `source_text` pod
podanym `source_url`, który zawiera tę nazwę (np. stopka, nagłówek, "O nas"). Bez formy prawnej, chyba że firma sama jej
używa w nazwie. Jeśli nie da się ustalić nazwy z cytatem, pomiń pole `brand`.

## Usługi (`services`)

Lista usług, które firma wprost wymienia. Każda ma `quote`: dosłowny cytat ze strony (po normalizacji spacji i wielkości
liter musi występować w `source_text` pod podanym `source_url`).

## Ceny (`prices`)

Tylko dla kandydatów z `price_candidates`, gdy fragment naprawdę opisuje cenę usługi firmy (nie cenę sprzętu w sklepie,
kursu, ani opłaty urzędowej).

- `candidate_id` z paczki, `source_url` strony, z której pochodzi kandydat.
- `quote`: dosłowny cytat z `snippet` kandydata, zawierający liczbę ("od 120 zł za godzinę z dwiema osobami", "przeprowadzka mieszkania od 600 zł", "transport pianina 400 zł").
- `service`: nazwa usługi, której dotyczy cena.
- `unit`: `other` dla stawki godzinowej, za kondygnację, za m2 biura lub za pomieszczenie (opisz w `conditions`, np. "za godzinę, 2 osoby i samochód"), `pln` dla ceny jednorazowej (przeprowadzka mieszkania, pianino), `pln_per_month` dla magazynowania, `percent` praktycznie nie występuje. W `conditions` wpisz, czy cena zawiera dojazd, wniesienie i materiały, jeśli cytat to podaje. Wartości `amount_min` i `amount_max` muszą występować w cytacie.
- `tax_mode`: `plus_vat` gdy cytat ma "+ VAT", `net` gdy "netto", `gross` gdy "brutto", w przeciwnym razie `unknown`.
  Nie zgaduj trybu VAT, którego nie ma w cytacie.
- `conditions`: warunki, które cytat wprost podaje.
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
  "brand": {"name": "Przykład Przeprowadzki", "quote": "Przykład Przeprowadzki to firma...", "source_url": "https://..."},
  "services": [
    {"name": "nazwa usługi", "quote": "dosłowny cytat", "source_url": "https://..."}
  ],
  "prices": [
    {
      "candidate_id": "p1",
      "service": "stawka godzinowa (ekipa z samochodem)",
      "unit": "other",
      "amount_min": 300,
      "amount_max": null,
      "tax_mode": "net",
      "quote": "od 300 zł netto",
      "source_url": "https://...",
      "conditions": "warunek z cytatu"
    }
  ]
}
```

## Jak pracować partiami

1. Weź partię 50-70 paczek. Rozdziel je na subagentów po ok. 10 (każdy w czystym kontekście).
2. Po zapisaniu wyniku sprawdź go: `katalog validate --bundle <paczka> --result <wynik>`. Kod wyjścia 0 = poprawny.
3. Wynik odrzucony popraw tylko wtedy, gdy powód jest jasny. W razie wątpliwości zostaw plik bez wyniku. Import
   (`katalog import --vertical przeprowadzki`) odrzuci niepoprawny wynik z kodem błędu w `queue_items.validator_report`.
