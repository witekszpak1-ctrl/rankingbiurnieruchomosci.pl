# Zadanie dla Claude Code: opis firmy (typ `describe`), branża: firmy remontowe i wykończeniowe

Przetwarzasz paczki z `queue/pending/remonty/describe/*.json` i zapisujesz wyniki w `queue/results/remonty/describe/<firm_id>.json`
(ta sama nazwa pliku). Walidator w kodzie odrzuca wynik, który łamie zasady poniżej, więc nie ma sensu ich obchodzić.

## Zasady

1. Używasz wyłącznie faktów z paczki (`facts`) i tekstu źródłowego (`source_text`). Niczego nie dopowiadasz z wiedzy ogólnej.
2. Opis ma 4-6 zdań, zwykle 450-1200 znaków (twardy limit walidatora: 80-1400), po polsku, neutralnym tonem.
   Bez superlatywów ("najlepszy", "numer 1", "lider", "gwarantujemy"), chyba że dokładnie tak brzmi cytowany fakt.
   Dobry opis odpowiada na pytania klienta, o ile paczka ma na to fakty: czym firma się zajmuje (remonty mieszkań, domów, łazienek, kuchni, wykończenia pod klucz), dla kogo (osoby prywatne, deweloperzy, firmy), jakie usługi wprost wymienia (gładzie, malowanie, płytki, podłogi, instalacje, projekt wnętrza), na jakim obszarze działa, czy wycenia na piśmie i jak (za metr, za zakres, kosztorys), jaką daje gwarancję, od kiedy jest w rejestrze i czy publikuje cennik.
   Każde zdanie wnosi nową informację. Gdy faktów jest mało, opis może być krótszy, ale nie dopowiadaj niczego spoza paczki.
3. **Nie przepisujesz zdań ze strony firmy.** Parafrazuj własnymi słowami. Walidator liczy nakładanie się 5-wyrazowych
   fragmentów ze źródłem i odrzuca opisy zbyt podobne (próg domyślnie 20%).
4. Opis składa się z twierdzeń (`claims`). Każde twierdzenie to jedno zdanie i wskazuje `fact_ids` z paczki, na których
   się opiera. Tekst opisu musi być dokładnie złączeniem twierdzeń (spacja między nimi).
5. Nie wpisujesz e-maili, telefonów ani adresów stron w opisie. W paczce ich zresztą nie ma.
6. `registry_start_date` to data wpisu do rejestru (KRS, CEIDG lub wykaz VAT), nie dowód początku działalności. Pisz
   "wpisane do rejestru w ... roku", nie "działa od ...".
7. Nie używasz długich myślników (U+2013, U+2014), tylko zwykły "-".
8. Uprawnienia, gwarancje i ubezpieczenie (uprawnienia budowlane, gwarancja na wykonane prace, ubezpieczenie OC wykonawcy, członkostwo w cechu lub stowarzyszeniu) opisujesz **tylko wtedy, gdy strona o nich wprost mówi**, i wtedy jako deklarację firmy. Nie wnioskuj ich z nazwy ani z branży. Nie piszesz "terminowo", "bez ukrytych kosztów" ani "solidnie", jeśli to nie jest cytowany fakt.
9. Nie obiecujesz terminów, cen ani jakości ("remont w 14 dni", "najniższe ceny", "bez dopłat"), nawet gdy tak pisze strona. Opisujesz zakres usług i sposób wyceny, nie rezultat.

## Marka (`brand`)

Nazwa, pod którą firma przedstawia się na swojej stronie (np. "Przykład Remonty"), a nie tytuł strony pod SEO
("Firma remontowa Wrocław - remonty mieszkań, wykończenia pod klucz") ani nazwa z rejestru, jeśli strona używa innej. `quote` to dosłowny cytat ze `source_text` pod
podanym `source_url`, który zawiera tę nazwę (np. stopka, nagłówek, "O nas"). Bez formy prawnej, chyba że firma sama jej
używa w nazwie. Jeśli nie da się ustalić nazwy z cytatem, pomiń pole `brand`.

## Usługi (`services`)

Lista usług, które firma wprost wymienia. Każda ma `quote`: dosłowny cytat ze strony (po normalizacji spacji i wielkości
liter musi występować w `source_text` pod podanym `source_url`).

## Ceny (`prices`)

Tylko dla kandydatów z `price_candidates`, gdy fragment naprawdę opisuje cenę usługi firmy (nie cenę sprzętu w sklepie,
kursu, ani opłaty urzędowej).

- `candidate_id` z paczki, `source_url` strony, z której pochodzi kandydat.
- `quote`: dosłowny cytat z `snippet` kandydata, zawierający liczbę ("remont mieszkania pod klucz od 1800 zł za m2", "malowanie ścian 25 zł za m2", "remont łazienki od 15 000 zł").
- `service`: nazwa usługi, której dotyczy cena.
- `unit`: `pln` dla ceny jednorazowej za zakres (remont łazienki, robocizna za pokój), `other` dla stawek za metr kwadratowy, za punkt lub za godzinę (opisz w `conditions`, np. "za m2, bez materiału"), `pln_per_month` praktycznie nie występuje, `percent` tylko gdy strona podaje procent (np. nadzór od wartości remontu). Zawsze zapisz w `conditions`, czy cena obejmuje materiały i robociznę, jeśli cytat to mówi. Wartości `amount_min` i `amount_max` muszą występować w cytacie.
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
  "brand": {"name": "Przykład Remonty", "quote": "Przykład Remonty to firma...", "source_url": "https://..."},
  "services": [
    {"name": "nazwa usługi", "quote": "dosłowny cytat", "source_url": "https://..."}
  ],
  "prices": [
    {
      "candidate_id": "p1",
      "service": "remont mieszkania pod klucz (za m2)",
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
   (`katalog import --vertical remonty`) odrzuci niepoprawny wynik z kodem błędu w `queue_items.validator_report`.
