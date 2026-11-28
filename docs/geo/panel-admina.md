# Panel administratora GeoTrace (`/admin`)

Część "Master Dashboard" właściciela, w `apps/geo`. Wszystkie strony są renderowane na żądanie z samych danych w bazie:
nie wysyłają zapytań do dostawców AI ani do żadnych płatnych API.

## Dostęp i bezpieczeństwo

- Każda strona `/admin/*` wywołuje `requireAdmin` (`lib/auth.ts`): bez sesji przekierowanie na logowanie (z powrotem na tę
  samą stronę), zalogowany bez uprawnień administratora trafia na `/`. Uprawnienia: `geo.users.is_admin`, konto nie może być wyłączone.
- Akcja serwerowa `toggleAdminAction` (`app/admin/actions.ts`) najpierw woła `requireAdmin`, odrzuca zmianę własnych uprawnień
  (nie da się odebrać sobie administratora) i niepoprawne identyfikatory.
- Eksport CSV (`/admin/lista/export`) dla osoby bez uprawnień odpowiada 404 bez treści (przeglądarka pobierająca plik nie
  powinna dostać strony logowania w miejscu pliku).
- Nagłówki `Cache-Control: private, no-store` i `X-Robots-Tag: noindex, nofollow` dla `/admin/*` ustawia `next.config.mjs`;
  eksport CSV ustawia je też sam.
- Panel nic nie loguje (adresy e-mail i treści odpowiedzi nie trafiają do logów). Parametry adresu są walidowane
  (`parseMeasurementFilters`): nieznane wartości są odrzucane, do SQL idą tylko parametry zapytania.
- Cytowane adresy URL są wyświetlane jako tekst, nie jako linki (adresy pochodzą z odpowiedzi AI).
- CSV: komórki zaczynające się od `=`, `+`, `-`, `@` dostają apostrof (ochrona przed wstrzyknięciem formuły w arkuszu).

## Strony

| Adres | Zawartość |
|---|---|
| `/admin` | Przegląd: użytkownicy, konta według pakietu, lista oczekujących, partnerzy, kliknięcia 30 dni, polecone konta, prowizje (w okresie zwrotów, do wypłaty, wypłacone), pytania, miasta z pomiarem, pomiary gotowe i błędy według platformy, ostatni pomiar, wzmianki dopasowane i niedopasowane do katalogu, cytowania naszego portalu |
| `/admin/pomiary` | Tabela pomiarów, filtry w parametrach adresu: `miasto`, `platforma`, `status`, `od`, `do` (data `RRRR-MM-DD`, według czasu pomiaru, a gdy go brak, zlecenia), `strona`; po 100 na stronie |
| `/admin/pomiary/[id]` | Pytanie, platforma, model, dostawca, data, fragment odpowiedzi, wzmianki (pozycja, nazwa, domena, firma z katalogu albo "kandydat", polecona), cytowane źródła (adres, domena, czy nasz portal) |
| `/admin/zrodla` | Najczęściej cytowane domeny (odpowiedzi, udział, cytowania, miasta), nasz portal wyróżniony; filtr `miasto`; tabela źródeł w podziale na miasta (odpowiedzi, ze źródłami, cytujące nasz portal, najczęstsza domena) |
| `/admin/firmy` | Najczęściej wymieniane firmy: z katalogu (dopasowane po `brand_id`) i kandydaci (bez dopasowania, grupowani po nazwie znormalizowanej do małych liter i pojedynczych spacji); odpowiedzi, wprost polecona, liczba miast, najczęstsze miasto z udziałem; filtry `miasto`, `typ` (`matched`, `unmatched`) |
| `/admin/lista` | Lista oczekujących (e-mail, domena, kod partnera, data) i przycisk pobrania CSV |
| `/admin/uzytkownicy` | Użytkownicy (data utworzenia, ostatnie logowanie, liczba kont, kod partnera, administrator) z przełącznikiem "nadaj/odbierz", konta firm z pakietem i statusem abonamentu |
| `/admin/partnerzy` | Rozliczanie wypłat prowizji (istniejąca strona, dodana nawigacja) |

## Jak liczymy

- Udziały to liczba odpowiedzi z danym zjawiskiem podzielona przez liczbę gotowych odpowiedzi (status `done`) w tym samym
  zakresie (miasto albo całość). Poniżej `MIN_SAMPLE` = 10 odpowiedzi (jak w audycie) strona pisze "za mało danych (n)"
  zamiast procentu (`lib/admin-stats.ts`: `sharePct`, `formatShare`).
- "Odpowiedź" to jeden pomiar; firma albo domena jest liczona raz na odpowiedź, nawet gdy pojawia się w niej kilka razy.
- Prowizje na przeglądzie liczone tak samo jak saldo partnera (`lib/affiliate.ts`): pozycje ujemne i po okresie na zwroty to
  "do wypłaty", wcześniejsze to "w okresie zwrotów", wypłacone to status `paid`; wstrzymane (`void`) pomijamy.
- Pakiet konta to najnowszy abonament konta (`geo.subscriptions`), bez abonamentu "brak".
- Miasto to `geo.prompts.city` (pytania bez miasta trafiają do grupy "(bez miasta)").
- Kandydaci do katalogu: wzmianki z `brand_id` pustym. Ta sama firma pod różnymi nazwami (skrót, forma prawna) będzie
  osobną pozycją, bo nie zgadujemy dopasowań; przegląd i dopisanie do katalogu robi człowiek.

## Pliki

- `lib/admin-repo.ts`: zapytania SQL (tylko odczyt, poza `setUserAdmin`), rola `geo_app` (katalog: SELECT z `0004_catalog_read.sql`).
- `lib/admin-stats.ts`: czyste funkcje (filtry, udziały, agregacja firm, CSV, daty), testy w `tests/admin-stats.test.ts`.
- `components/AdminNav.tsx`: nawigacja; `app/admin/**`: strony i akcja.
- Bez zmian schematu bazy (nie potrzeba migracji).

## Sprawdzenie

Lokalny PostgreSQL 16: nowa baza z `db/migrations`, `db/seeds/dev.sql`, `db/geo` (`scripts/migrate.mjs`), przykładowe dane
(użytkownicy z administratorem, 24 pomiary z wzmiankami i cytowaniami, lista oczekujących, partner), `next build` i
`next start`, Playwright: logowanie administratora, wszystkie 9 stron i nagłówki, filtry, szczegóły pomiaru, CSV
(w tym ochrona formuł), przełączanie administratora (brak przycisku przy własnym koncie), zwykły użytkownik i anonim
przekierowani, CSV bez uprawnień 404.
