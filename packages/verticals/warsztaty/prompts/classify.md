# Zadanie dla Claude Code: spór klasyfikacji (typ `classify`), branża: warsztaty samochodowe

Paczki z `queue/pending/warsztaty/classify/*.json`, wyniki w `queue/results/warsztaty/classify/<firm_id>.json` (firm_id to id domeny).

Pytanie: czy ta strona jest **oficjalną witryną jednej firmy** z branży (warsztat samochodowy lub serwis aut), czy czymś innym.

## Etykiety (`verdict.label`)

- `official`: strona przedstawia jeden konkretny warsztat (lub sieć jednej marki) i jego własne usługi napraw.
- `directory`: katalog firm, ranking, porównywarka albo lista wielu niezależnych firm.
- `marketplace`: platforma rezerwacji i porównywania warsztatów, gdzie warsztaty płacą za zapytania lub rezerwacje ("zarezerwuj termin w warsztacie", "porównaj ceny serwisów").
- `media`: artykuł, blog motoryzacyjny, poradnik, serwis informacyjny, test aut, strona kursu.
- `irrelevant`: firma spoza branży albo strona niezwiązana. Tu też: sklep z częściami i hurtownia, salon lub komis aut, wypożyczalnia, myjnia i detailing bez napraw, stacja paliw, stacja kontroli pojazdów bez napraw, złomowisko, firma ubezpieczeniowa, urząd, firma spoza branży.
- `parked`: domena zaparkowana lub na sprzedaż.
- `uncertain`: za mało danych, by zdecydować (wtedy sprawa trafi do człowieka).

## Zasady

1. Decyzja inna niż `uncertain` wymaga `evidence_quote`: dosłownego cytatu z `source_text`, który ją uzasadnia.
2. `heuristic_reasons` i `signals` w paczce to podpowiedzi kodu, nie dowody. Możesz się z nimi nie zgodzić.
3. Warsztat sprzedający też części, ale naprawiający auta, jest `official`. Sklep z częściami bez napraw to `irrelevant`.
4. Autoryzowany serwis marki z jednym adresem to `official`. Strona producenta lub importera marki z listą serwisów to `directory` lub `irrelevant`.
5. Wiele warsztatów ma tylko profil w Mapach lub w mediach społecznościowych: takie adresy (facebook.com, strony Map) są poza zakresem klasyfikatora i nie trafiają tutaj.

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
