# Zadanie dla Claude Code: spór klasyfikacji (typ `classify`), branża: firmy przeprowadzkowe

Paczki z `queue/pending/przeprowadzki/classify/*.json`, wyniki w `queue/results/przeprowadzki/classify/<firm_id>.json` (firm_id to id domeny).

Pytanie: czy ta strona jest **oficjalną witryną jednej firmy** z branży (firma przeprowadzkowa), czy czymś innym.

## Etykiety (`verdict.label`)

- `official`: strona przedstawia jedną konkretną firmę wykonującą przeprowadzki i jej własne usługi.
- `directory`: katalog firm, ranking, porównywarka albo lista wielu niezależnych firm.
- `marketplace`: giełda transportowa lub platforma z zapytaniami, gdzie firmy kupują leady ("wyślij zapytanie do firm przeprowadzkowych", "porównaj oferty").
- `media`: artykuł, blog, poradnik o przeprowadzkach, serwis informacyjny, strona kursu.
- `irrelevant`: firma spoza branży albo strona niezwiązana. Tu też: firma kurierska i spedycyjna bez przeprowadzek, wypożyczalnia aut, magazyn self-storage bez przeprowadzek, firma sprzątająca, taksówki bagażowe, urząd, firma spoza branży.
- `parked`: domena zaparkowana lub na sprzedaż.
- `uncertain`: za mało danych, by zdecydować (wtedy sprawa trafi do człowieka).

## Zasady

1. Decyzja inna niż `uncertain` wymaga `evidence_quote`: dosłownego cytatu z `source_text`, który ją uzasadnia.
2. `heuristic_reasons` i `signals` w paczce to podpowiedzi kodu, nie dowody. Możesz się z nimi nie zgodzić.
3. Mała ekipa z jednym samochodem dostawczym i własną ofertą przeprowadzek jest `official`. Strona zbierająca wiele firm lub pośrednicząca w zleceniach to `directory` albo `marketplace`.
4. Firma, która robi przeprowadzki i wywóz mebli (utylizację), jest `official`. Firma wyłącznie wywożąca odpady to `irrelevant`.
5. Firma transportowa (towary, spedycja) bez wzmianki o przeprowadzkach to `irrelevant`: transport towarów to osobna branża.

## Format wyniku

```json
{
  "schema_version": 1,
  "firm_id": "<firm_id z paczki>",
  "bundle_sha256": "<bundle_sha256 z paczki, bez zmian>",
  "verdict": {
    "label": "official",
    "reason": "Jedna firma, jeden NIP w stopce, własna oferta usług.",
    "evidence_quote": "dosłowny cytat z source_text"
  }
}
```
