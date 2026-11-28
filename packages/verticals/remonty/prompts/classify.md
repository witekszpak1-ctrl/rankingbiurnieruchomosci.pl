# Zadanie dla Claude Code: spór klasyfikacji (typ `classify`), branża: firmy remontowe i wykończeniowe

Paczki z `queue/pending/remonty/classify/*.json`, wyniki w `queue/results/remonty/classify/<firm_id>.json` (firm_id to id domeny).

Pytanie: czy ta strona jest **oficjalną witryną jednej firmy** z branży (firma remontowa lub wykończeniowa), czy czymś innym.

## Etykiety (`verdict.label`)

- `official`: strona przedstawia jedną konkretną firmę wykonującą remonty i wykończenia oraz jej własne usługi.
- `directory`: katalog firm, ranking, porównywarka albo lista wielu niezależnych firm.
- `marketplace`: platforma z zapytaniami ofertowymi lub bazą fachowców, gdzie wykonawcy kupują leady ("zleć remont", "wyślij zapytanie do wykonawców").
- `media`: artykuł, blog, poradnik remontowy, serwis informacyjny, magazyn o budowie i wnętrzach, strona kursu.
- `irrelevant`: firma spoza branży albo strona niezwiązana. Tu też: sklep budowlany i markety, producent materiałów, deweloper, biuro projektowe bez wykonawstwa, firma sprzątająca, urząd, firma rekrutująca ekipy, firma spoza branży.
- `parked`: domena zaparkowana lub na sprzedaż.
- `uncertain`: za mało danych, by zdecydować (wtedy sprawa trafi do człowieka).

## Zasady

1. Decyzja inna niż `uncertain` wymaga `evidence_quote`: dosłownego cytatu z `source_text`, który ją uzasadnia.
2. `heuristic_reasons` i `signals` w paczce to podpowiedzi kodu, nie dowody. Możesz się z nimi nie zgodzić.
3. Jednoosobowy fachowiec lub mała ekipa z własną ofertą remontów jest `official`, o ile na stronie występuje jedna firma (nazwa lub NIP). Portal zbierający wielu fachowców to `directory` albo `marketplace`.
4. Firma, która robi wyłącznie jeden zakres (np. tylko malowanie albo tylko płytki), to nadal `official`: rozróżnienie zakresu robi później prompt opisów.
5. Firma budowlana stawiająca domy (stan surowy, pod klucz) bez ofert remontowych należy do innego portalu (budowlane): w takim razie `irrelevant`, chyba że strona wprost oferuje remonty.

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
