# Darmowy audyt widoczności w AI (wersja pierwsza)

Strony: `/audyt` (formularz) i `/audyt/<domena>` (wynik) w `apps/geo`. Wynik jest renderowany na żądanie, nie jest
indeksowany (`noindex`), a obliczony audyt jest trzymany w pamięci podręcznej serwera przez godzinę (tylko odczyt).

## Co pokazuje wynik

Dla firmy z naszego katalogu biur nieruchomości (dopasowanie po domenie, z `www` i bez):

- ile pomiarów użyto, z jakich platform (Gemini, Google AI Mode, Google AI Overview) i z jakich dat (od-do),
- czy firma jest wymieniana w odpowiedziach AI (po `brand_id` albo po domenie), ile razy, ile razy wprost polecana,
  ile razy jej strona jest cytowana jako źródło,
- wskaźniki (wzmianki, polecenia, cytowania) z przedziałami Wilsona 95% oraz wynik widoczności 0-100, liczone przez
  `apps/geo/lib/measure.ts` (`visibility`, `visibilityScore`), bez własnych wzorów,
- tabela platform, najczęściej wymieniani konkurenci w mieście (liczba odpowiedzi, udział, czy mają wpis w katalogu),
  najczęściej cytowane strony (i czy cytowany jest nasz portal rankingbiurnieruchomosci.pl),
- krótka lista wniosków wynikających wyłącznie z tych liczb, w tym "masz profil w katalogu, uzupełnij go" albo "nie masz profilu",
- lista pytań, na które odpowiadało AI.

Gdy próba jest mniejsza niż `MIN_SAMPLE` (10 odpowiedzi), strona pisze "za mało danych" i pokazuje same liczby bez procentów
i wyniku. Gdy domeny nie ma w katalogu albo jej miasto nie ma pomiarów z ostatnich 30 dni, strona mówi to wprost i
oferuje zapis na listę oczekujących na pełny audyt (`joinWaitlistAction`).

## Skąd dane

| Dane | Źródło |
|---|---|
| Firma, miasto, adres profilu | `public.domains`, `brands`, `listings` (tylko `published`, branża `nieruchomosci`), `cities`, `verticals` |
| Pomiary | `geo.measurements` (status `done`, ostatnie 30 dni, najnowszy na `cache_key`) z `geo.prompts` (`industry = nieruchomosci`, `city` = miasto firmy) |
| Wzmianki i cytowania | `geo.mentions` (z nazwą firmy z `public.brands` przy dopasowaniu), `geo.citations` |
| Adres profilu | `https://rankingbiurnieruchomosci.pl/<slug-miasta>/<slug-wpisu>` |

Pomiary są wspólne dla wszystkich firm w mieście (biblioteka uzupełniana co tydzień przez robota dla 20 największych miast).
To nie jest pytanie zadane specjalnie o daną firmę i strona tak to opisuje.

## Uprawnienia i bezpieczeństwo

- Migracja `db/geo/0004_catalog_read.sql` daje roli `geo_app` wyłącznie `SELECT` na `public.brands`, `domains`, `listings`,
  `cities`, `google_places`, `verticals` (oraz `USAGE` na schemacie `public`). Stosuje ją właściciel bazy
  (`npm run migrate` z `GEO_MIGRATE_URL`) przed wdrożeniem kodu strony audytu.
- `normalizeDomain` (`apps/geo/lib/audit.ts`): zostawia samą domenę, odrzuca adresy IP (także zapisane dziesiętnie i
  szesnastkowo), IPv6, `localhost`, końcówki sieci lokalnych, dane logowania, porty, schematy inne niż http(s), znaki białe
  i wejście dłuższe niż 300 znaków. Audyt niczego jeszcze nie pobiera, ale ta ochrona jest gotowa na pomiary na żywo i skan strony.
- Brak płatnych zapytań: strona czyta tylko bazę.

## Ograniczenia

- Tylko firmy z opublikowanym wpisem w katalogu biur nieruchomości i tylko miasta z pomiarami z ostatnich 30 dni.
- Konkurenci to nazwy z odpowiedzi AI; część wzmianek nie jest dopasowana do katalogu (kolumna "W katalogu").
- Brak pomiarów ChatGPT (później, osobny dostawca).
- Jedno miasto na audyt: gdy firma ma wpisy w kilku miastach, wybieramy to z największą liczbą pomiarów.

## Dalsze kroki

1. Pomiar na żywo dla firm spoza biblioteki (własne pytania, własne miasto) za budżetem i zgodą właściciela (licznik w `settings.api_usage`).
2. Techniczny skan strony firmy (robots, dane strukturalne, `llms.txt`, szybkość), po dodaniu bezpiecznego pobierania z ochroną SSRF
   opartą na `normalizeDomain`.
3. Rozpoznawanie branży przez model AI (po udostępnieniu klucza przez bezpieczny formularz środowiska), żeby audyt działał też
   poza biurami nieruchomości.
4. Przycisk "sprawdź widoczność w AI" na profilach portalu (zadanie w `docs/ops/TASKS.md`).
