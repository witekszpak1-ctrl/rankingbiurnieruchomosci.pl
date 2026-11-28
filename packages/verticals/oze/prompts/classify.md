# Zadanie dla Claude Code: spór klasyfikacji (typ `classify`), branża: fotowoltaika, pompy ciepła i klimatyzacja

Paczki z `queue/pending/oze/classify/*.json`, wyniki w `queue/results/oze/classify/<firm_id>.json` (firm_id to id domeny).

Pytanie: czy ta strona jest **oficjalną witryną jednej firmy** z branży (firma instalacyjna (fotowoltaika, pompy ciepła, klimatyzacja, magazyny energii)), czy czymś innym.

## Etykiety (`verdict.label`)

- `official`: strona przedstawia jedną konkretną firmę instalacyjną i jej własne usługi montażu i serwisu.
- `directory`: katalog firm, ranking, porównywarka albo lista wielu niezależnych firm.
- `marketplace`: platforma z zapytaniami ofertowymi, pośrednik leadów ("porównaj oferty instalatorów", "wyślij zapytanie do 3 firm").
- `media`: artykuł, blog, poradnik, serwis informacyjny o energetyce odnawialnej, strona kursu lub szkolenia.
- `irrelevant`: firma spoza branży albo strona niezwiązana. Tu też: producent, importer lub hurtownia sprzętu bez własnych usług montażu, sklep internetowy z panelami i pompami, deweloper, urząd, kalkulator dotacji, firma rekrutująca instalatorów, firma spoza branży.
- `parked`: domena zaparkowana lub na sprzedaż.
- `uncertain`: za mało danych, by zdecydować (wtedy sprawa trafi do człowieka).

## Zasady

1. Decyzja inna niż `uncertain` wymaga `evidence_quote`: dosłownego cytatu z `source_text`, który ją uzasadnia.
2. `heuristic_reasons` i `signals` w paczce to podpowiedzi kodu, nie dowody. Możesz się z nimi nie zgodzić.
3. Firma, która sprzedaje sprzęt i oferuje własny montaż u klienta, jest `official`. Sklep internetowy bez montażu, hurtownia i producent to `irrelevant`.
4. Sieć franczyzowa z jedną marką to nadal strona oficjalna. Strona zbierająca zapytania i rozdzielająca je między wiele firm to `marketplace`.
5. Strona, która pod pozorem firmy instalacyjnej głównie zbiera dane kontaktowe do sprzedaży cudzych ofert (brak własnego zakresu, nazwy firmy, NIP), to `uncertain` z krótkim uzasadnieniem.

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
