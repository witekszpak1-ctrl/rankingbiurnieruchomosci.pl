# Zadanie dla Claude Code: spór klasyfikacji (typ `classify`), branża: kliniki weterynaryjne

Paczki z `queue/pending/weterynarze/classify/*.json`, wyniki w `queue/results/weterynarze/classify/<firm_id>.json` (firm_id to id domeny).

Pytanie: czy ta strona jest **oficjalną witryną jednej firmy** z branży (klinika, lecznica lub gabinet weterynaryjny), czy czymś innym.

## Etykiety (`verdict.label`)

- `official`: strona przedstawia jedną konkretną klinikę lub gabinet weterynaryjny i jego własne usługi.
- `directory`: katalog firm, ranking, porównywarka albo lista wielu niezależnych firm.
- `marketplace`: platforma umawiania wizyt lub porównywania lekarzy, gdzie placówki płacą za zapytania lub profil ("umów wizytę online u weterynarzy", "znajdź weterynarza").
- `media`: artykuł, blog o zwierzętach, poradnik dla opiekunów, serwis informacyjny, strona kursu lub szkolenia.
- `irrelevant`: firma spoza branży albo strona niezwiązana. Tu też: sklep zoologiczny i z karmą, hotel i przedszkole dla zwierząt, groomer bez usług weterynaryjnych, schronisko i fundacja, hodowla, tresura, producent leków, urząd i inspekcja weterynaryjna, firma spoza branży.
- `parked`: domena zaparkowana lub na sprzedaż.
- `uncertain`: za mało danych, by zdecydować (wtedy sprawa trafi do człowieka).

## Zasady

1. Decyzja inna niż `uncertain` wymaga `evidence_quote`: dosłownego cytatu z `source_text`, który ją uzasadnia.
2. `heuristic_reasons` i `signals` w paczce to podpowiedzi kodu, nie dowody. Możesz się z nimi nie zgodzić.
3. Placówka z jednym adresem lub sieć jednej marki z jedną ofertą to `official`. Portal z listą lekarzy i placówek to `directory` albo `marketplace`.
4. Placówka, która obok usług weterynaryjnych ma sklep lub groomera, jest `official`. Sam sklep zoologiczny, hotel dla zwierząt lub groomer bez weterynarii to `irrelevant`.
5. Lekarz weterynarii prowadzący indywidualną praktykę (także dojazdową) z własną ofertą to `official`. Zawód regulowany: wszelkie oznaczenia robi później pole wpisu, nie ty.
6. Lekarze weterynarii wykonują zawód regulowany (reguły reklamy i informowania o praktyce, samorząd zawodowy). Wpisy placówek oznaczamy osobnym polem i do czasu opinii prawnej nie sprzedajemy im pozycji w rankingu ani reklamy. Nie oceniamy jakości leczenia.

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
