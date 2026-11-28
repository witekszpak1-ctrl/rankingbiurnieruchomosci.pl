# Zadanie dla Claude Code: spór klasyfikacji (typ `classify`), branża: firmy budowlane (budowa domów)

Paczki z `queue/pending/budowlane/classify/*.json`, wyniki w `queue/results/budowlane/classify/<firm_id>.json` (firm_id to id domeny).

Pytanie: czy ta strona jest **oficjalną witryną jednej firmy** z branży (firma budowlana budująca domy), czy czymś innym.

## Etykiety (`verdict.label`)

- `official`: strona przedstawia jedną konkretną firmę wykonującą budowę domów i jej własne realizacje.
- `directory`: katalog firm, ranking, porównywarka albo lista wielu niezależnych firm.
- `marketplace`: platforma z zapytaniami ofertowymi, gdzie wykonawcy kupują leady ("zleć budowę", "porównaj oferty wykonawców").
- `media`: artykuł, blog, poradnik budowlany, magazyn o budowie domów, strona kursu lub szkolenia.
- `irrelevant`: firma spoza branży albo strona niezwiązana. Tu też: deweloper (sprzedaje gotowe lokale lub domy), pracownia projektowa bez wykonawstwa, sprzedawca projektów gotowych, hurtownia i skład budowlany, producent materiałów, urząd, firma rekrutująca, firma spoza branży.
- `parked`: domena zaparkowana lub na sprzedaż.
- `uncertain`: za mało danych, by zdecydować (wtedy sprawa trafi do człowieka).

## Zasady

1. Decyzja inna niż `uncertain` wymaga `evidence_quote`: dosłownego cytatu z `source_text`, który ją uzasadnia.
2. `heuristic_reasons` i `signals` w paczce to podpowiedzi kodu, nie dowody. Możesz się z nimi nie zgodzić.
3. Deweloper (oferta gotowych mieszkań i domów na sprzedaż, inwestycje) to `irrelevant`, nawet gdy sam buduje. Firma budująca na zlecenie inwestora indywidualnego to `official`.
4. Pracownia projektowa, która oferuje też kierownika budowy, ale nie wykonawstwo, to `irrelevant`. Firma z generalnym wykonawstwem i projektem to `official`.
5. Firma realizująca wyłącznie remonty i wykończenia (bez budowy) należy do innego portalu (remonty): `irrelevant`, chyba że strona wprost mówi o budowie domów.

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
