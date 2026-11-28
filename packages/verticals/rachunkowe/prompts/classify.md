# Zadanie dla Claude Code: spór klasyfikacji (typ `classify`)

Paczki z `queue/pending/classify/*.json`, wyniki w `queue/results/classify/<firm_id>.json` (firm_id to id domeny).

Pytanie: czy ta strona jest **oficjalną witryną jednej firmy** z branży (biuro rachunkowe, księgowa, kancelaria
podatkowa), czy czymś innym.

## Etykiety (`verdict.label`)

- `official`: strona przedstawia jedną konkretną firmę (biuro rachunkowe, księgową prowadzącą działalność, kancelarię
  podatkową) i jej własne usługi.
- `directory`: katalog firm, ranking, porównywarka biur albo lista wielu niezależnych firm.
- `marketplace`: platforma z zapytaniami ofertowymi, portal ogłoszeniowy lub agregator, gdzie biura kupują leady.
- `media`: artykuł, blog, poradnik podatkowy, serwis informacyjny, strona kursu lub szkolenia z księgowości.
- `irrelevant`: firma spoza branży albo strona niezwiązana. Tu też: oprogramowanie księgowe (programy do fakturowania
  i księgowości online), urząd, strona sprzedająca wyłącznie szkolenia, firma, która tylko zatrudnia księgowych
  (rekrutacja), biuro, które nie świadczy usług księgowych.
- `parked`: domena zaparkowana lub na sprzedaż.
- `uncertain`: za mało danych, by zdecydować (wtedy sprawa trafi do człowieka).

## Zasady

1. Decyzja inna niż `uncertain` wymaga `evidence_quote`: dosłownego cytatu z `source_text`, który ją uzasadnia.
2. `heuristic_reasons` i `signals` w paczce to podpowiedzi kodu, nie dowody. Możesz się z nimi nie zgodzić.
3. Wiele NIP-ów, lista wielu firm albo "dodaj firmę" zwykle oznaczają katalog. Jedna firma z jednym NIP-em w stopce
   i własną ofertą usług księgowych zwykle oznacza stronę oficjalną. Sieć franczyzowa z jedną marką to nadal strona
   oficjalna.
4. Doradca podatkowy lub kancelaria podatkowa z własną ofertą (rozliczenia, reprezentacja przed urzędem) to `official`
   (zawód regulowany: rozróżnienie robi później pole wpisu, nie ty). Kancelaria prawna bez usług księgowych ani
   podatkowych to `irrelevant`.
5. Strona jednego biura, które ma w menu "program do księgowości" jako narzędzie dla własnych klientów, nadal jest
   `official`. Strona, której głównym produktem jest oprogramowanie (cennik abonamentów programu, "wypróbuj za darmo"),
   to `irrelevant`.

## Format wyniku

```json
{
  "schema_version": 1,
  "firm_id": "<firm_id z paczki>",
  "bundle_sha256": "<bundle_sha256 z paczki, bez zmian>",
  "verdict": {
    "label": "official",
    "reason": "Jedna firma, jeden NIP w stopce, własna oferta usług księgowych i kadrowych.",
    "evidence_quote": "dosłowny cytat z source_text"
  }
}
```
