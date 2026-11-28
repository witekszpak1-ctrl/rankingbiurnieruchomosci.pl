# Zadanie dla Claude Code: opis firmy (typ `describe`), branża: kliniki weterynaryjne

Przetwarzasz paczki z `queue/pending/weterynarze/describe/*.json` i zapisujesz wyniki w `queue/results/weterynarze/describe/<firm_id>.json`
(ta sama nazwa pliku). Walidator w kodzie odrzuca wynik, który łamie zasady poniżej, więc nie ma sensu ich obchodzić.

## Zasady

1. Używasz wyłącznie faktów z paczki (`facts`) i tekstu źródłowego (`source_text`). Niczego nie dopowiadasz z wiedzy ogólnej.
2. Opis ma 4-6 zdań, zwykle 450-1200 znaków (twardy limit walidatora: 80-1400), po polsku, neutralnym tonem.
   Bez superlatywów ("najlepszy", "numer 1", "lider", "gwarantujemy"), chyba że dokładnie tak brzmi cytowany fakt.
   Dobry opis odpowiada na pytania klienta, o ile paczka ma na to fakty: czym klinika lub gabinet się zajmuje (konsultacje, szczepienia, chirurgia, stomatologia, diagnostyka), jakie gatunki przyjmuje, jakie usługi wprost wymienia, gdzie jest i kiedy otwarta (tylko z faktu, "całodobowo" tylko z faktu), czy przyjmuje nagłe przypadki lub jeździ do pacjentów, jak informuje o cenach, od kiedy jest w rejestrze i czy publikuje cennik.
   Każde zdanie wnosi nową informację. Gdy faktów jest mało, opis może być krótszy, ale nie dopowiadaj niczego spoza paczki.
3. **Nie przepisujesz zdań ze strony kliniki.** Parafrazuj własnymi słowami. Walidator liczy nakładanie się 5-wyrazowych
   fragmentów ze źródłem i odrzuca opisy zbyt podobne (próg domyślnie 20%).
4. Opis składa się z twierdzeń (`claims`). Każde twierdzenie to jedno zdanie i wskazuje `fact_ids` z paczki, na których
   się opiera. Tekst opisu musi być dokładnie złączeniem twierdzeń (spacja między nimi).
5. Nie wpisujesz e-maili, telefonów ani adresów stron w opisie. W paczce ich zresztą nie ma.
6. `registry_start_date` to data wpisu do rejestru (KRS, CEIDG lub wykaz VAT), nie dowód początku działalności. Pisz
   "wpisane do rejestru w ... roku", nie "działa od ...".
7. Nie używasz długich myślników (U+2013, U+2014), tylko zwykły "-".
8. Kwalifikacje, specjalizacje, wpis do rejestru zakładów leczniczych dla zwierząt, członkostwo w izbie lub towarzystwie, sprzęt i dostępność całodobowa opisujesz **tylko wtedy, gdy strona o nich wprost mówi**, i wtedy jako deklarację placówki ("według strony klinika wykonuje badania USG"). Nie wnioskuj ich z nazwy ani z branży. Nie piszesz "specjalista", "najlepszy lekarz" ani "całodobowo" bez faktu w paczce. Nie podajesz imion i nazwisk lekarzy (to dane osób, a lekarz weterynarii to zawód regulowany).
9. Nie oceniasz jakości leczenia i nie obiecujesz skutków ("skuteczne leczenie", "bezbolesny zabieg", "szybki powrót do zdrowia", "gwarantujemy"), nie opisujesz przypadków leczenia, nie stawiasz diagnoz i nie porównujesz z innymi placówkami, nawet gdy tak pisze strona. Opisujesz zakres usług i dostępność, nie rezultat. To zawód regulowany: reguły reklamy wymagają opinii prawnej (docs/geo/branze-3-8.md), więc opis ma być sucho informacyjny.

## Marka (`brand`)

Nazwa, pod którą firma przedstawia się na swojej stronie (np. "Przykład Weterynaria"), a nie tytuł strony pod SEO
("Klinika weterynaryjna Wrocław - weterynarz 24h, szczepienia, chirurgia") ani nazwa z rejestru, jeśli strona używa innej. `quote` to dosłowny cytat ze `source_text` pod
podanym `source_url`, który zawiera tę nazwę (np. stopka, nagłówek, "O nas"). Bez formy prawnej, chyba że firma sama jej
używa w nazwie. Jeśli nie da się ustalić nazwy z cytatem, pomiń pole `brand`.

## Usługi (`services`)

Lista usług, które firma wprost wymienia. Każda ma `quote`: dosłowny cytat ze strony (po normalizacji spacji i wielkości
liter musi występować w `source_text` pod podanym `source_url`).

## Ceny (`prices`)

Tylko dla kandydatów z `price_candidates`, gdy fragment naprawdę opisuje cenę usługi firmy (nie cenę sprzętu w sklepie,
kursu, ani opłaty urzędowej).

- `candidate_id` z paczki, `source_url` strony, z której pochodzi kandydat.
- `quote`: dosłowny cytat z `snippet` kandydata, zawierający liczbę ("konsultacja 120 zł", "szczepienie psa 90 zł", "sterylizacja kotki od 450 zł").
- `service`: nazwa usługi, której dotyczy cena.
- `unit`: `pln` dla ceny wizyty lub zabiegu (konsultacja, szczepienie, sterylizacja, USG, RTG), `other` praktycznie nie występuje (ewentualnie stawka za wizytę domową, opisz w `conditions`), `pln_per_month` i `percent` praktycznie nie występują. W `conditions` wpisz gatunek, wagę zwierzęcia lub rodzaj wizyty (dyżur, wizyta domowa), jeśli cytat to podaje. Nie wpisuj ceny leków ani karmy. Wartości `amount_min` i `amount_max` muszą występować w cytacie.
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
  "brand": {"name": "Przykład Weterynaria", "quote": "Przykład Weterynaria to firma...", "source_url": "https://..."},
  "services": [
    {"name": "nazwa usługi", "quote": "dosłowny cytat", "source_url": "https://..."}
  ],
  "prices": [
    {
      "candidate_id": "p1",
      "service": "konsultacja (wizyta)",
      "unit": "pln",
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
   (`katalog import --vertical weterynarze`) odrzuci niepoprawny wynik z kodem błędu w `queue_items.validator_report`.
