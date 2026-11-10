# Zadanie dla Claude Code: spór klasyfikacji (typ `classify`)

Paczki z `queue/pending/classify/*.json`, wyniki w `queue/results/classify/<firm_id>.json` (firm_id to id domeny).

Pytanie: czy ta strona jest **oficjalną witryną jednej firmy** z branży (biura nieruchomości), czy czymś innym.

## Etykiety (`verdict.label`)

- `official`: strona przedstawia jedną konkretną firmę i jej własne usługi.
- `directory`: katalog firm, ranking, porównywarka lub lista wielu niezależnych firm.
- `marketplace`: portal ogłoszeniowy lub agregator ofert wielu sprzedających.
- `media`: artykuł, blog, serwis informacyjny.
- `irrelevant`: firma spoza branży albo strona niezwiązana.
- `parked`: domena zaparkowana lub na sprzedaż.
- `uncertain`: za mało danych, by zdecydować (wtedy sprawa trafi do człowieka).

## Zasady

1. Decyzja inna niż `uncertain` wymaga `evidence_quote`: dosłownego cytatu z `source_text`, który ją uzasadnia.
2. `heuristic_reasons` i `signals` w paczce to podpowiedzi kodu, nie dowody. Możesz się z nimi nie zgodzić.
3. Wiele NIP-ów, lista wielu firm albo "dodaj firmę" zwykle oznaczają katalog. Jedna firma z jednym NIP-em w stopce
   i własną ofertą zwykle oznacza stronę oficjalną. Sieć franczyzowa z jedną marką to nadal strona oficjalna.

## Format wyniku

```json
{
  "schema_version": 1,
  "firm_id": "<firm_id z paczki>",
  "bundle_sha256": "<bundle_sha256 z paczki, bez zmian>",
  "verdict": {
    "label": "official",
    "reason": "Jedna firma, jeden NIP w stopce, własna oferta pośrednictwa.",
    "evidence_quote": "dosłowny cytat z source_text"
  }
}
```
