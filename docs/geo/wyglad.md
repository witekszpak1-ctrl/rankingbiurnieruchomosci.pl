# Wygląd GeoTrace: system projektowy (`apps/geo`)

Jeden spójny system dla strony publicznej, raportu audytu, pulpitu klienta, panelu partnera i panelu administratora.
Bez bibliotek wykresów i bez nowych zależności: wykresy to ręcznie pisane SVG, czcionka Inter z istniejącego linku Google Fonts.
Liczby na stronach pochodzą wyłącznie z bazy; przy próbie poniżej `MIN_SAMPLE` (10 odpowiedzi) pokazujemy "za mało danych".

## Tokeny (`app/globals.css`)

- Jasny motyw jako domyślny, ciemny przez `prefers-color-scheme`. Płótno jest złamaną bielą (`--canvas`), karty białe (`--surface`).
- Jeden mocny kolor marki: elektryczny indygo (`--brand`), akcent morski (`--accent`). Semantyka: `--good`, `--warn`, `--bad` (każdy z wersją `-soft` do tła pigułek).
- Kolory kategorii wykresów `--c1..--c5`, promienie `--r-sm..--r-xl`, cienie `--sh-sm/md/lg`, pierścień fokusa `--ring`.
- Układ: siatki `.g2/.g3/.g4`, `.g-score` (karta wyniku + analiza), progi responsywności 1180, 1000 i 720 px; telefon 390 px bez przewijania poziomego (tabele przewijają się wewnątrz karty).

## Komponenty

| Plik | Zawartość |
|---|---|
| `components/ui/ui.tsx` | `Pill`, `Card` (nagłówek, akcje, `flush` dla tabel), `PageHeader`, `StatTile`, `Segmented` (linki z parametrem adresu), `DataTable`, `BarList`, `EmptyState`, `Checklist` (kółka jak w onboardingu), `Gauge` (pierścień 0-100 z pasmami, pigułką stanu i pustym stanem "za mało danych"), `Donut`, `Sparkline` |
| `components/ui/LineChart.tsx` | jedyny komponent kliencki wykresów: wykres liniowy rysowany w pikselach według szerokości kontenera (podpisy osi mają stały rozmiar na telefonie), oś X według dat, puste punkty dla małej próby |
| `components/ui/Icon.tsx` | zestaw ikon inline SVG i znak firmowy |
| `components/shell/AppShell.tsx` | powłoka zalogowanych stron: pasek boczny (przełącznik firmy, grupy Widoczność / Rozwój / Konto, Administracja tylko dla administratora, licznik kroków "2/4", karta pakietu), górny pasek z wyszukiwaniem domeny i skrótem `/` (`SlashFocus`), menu wysuwane na telefonie (`MobileNav`) |
| `app/(site)/layout.tsx` | nagłówek i stopka stron publicznych |
| `lib/chart.ts`, `lib/score.ts` | czyste funkcje: geometria łuków, osie, daty, pasma wyniku (0-39 Wymaga pracy, 40-69 Dobra, 70-100 Bardzo dobra), ocena metryki względem celu |

Strony publiczne leżą w grupie tras `app/(site)`, strony z powłoką (`/panel`, `/partner/panel`, `/admin/*`) wołają `AppShell` z adresem pozycji menu (`current`).

## Raport audytu (`/audyt/<domena>`)

- Karta wyniku (Gauge), karta "Analiza wyniku" z przełącznikiem Rozbicie / Historia (`?widok=historia`), kafle wskaźników, platformy, konkurenci (z Twoją firmą wyróżnioną), źródła, lista wniosków z kółkami i odnośnikami, pytania, zapis na pełny audyt.
- Rozbicie: tabela Metryka / Wynik / Cel. Cel to średnia wskaźników 3 najczęściej wymienianych firm w tym samym mieście (konkurentów, bez badanej firmy; przy mniejszej liczbie konkurentów podpis mówi, ile firm uśredniono). Metryki: wzmianki, polecenia, cytowania strony (tylko firmy ze znaną domeną), udział w odpowiedziach, średnia pozycja. Kolor wyniku: zielony od celu, żółty od połowy celu, czerwony poniżej (dla pozycji odwrotnie: do celu, do 1,5 celu). Przy próbie poniżej progu nie ma celu ani tabeli, tylko wyjaśnienie.
- Historia: odsetek odpowiedzi z wzmianką o firmie w każdym tygodniu (od poniedziałku, UTC), z wszystkich gotowych pomiarów miasta z 12 tygodni (`loadCityHistory`), bez deduplikacji po kluczu pamięci podręcznej. Od 2 tygodni rysujemy wykres, wcześniej pusty stan "Historia pojawi się po kolejnym tygodniowym pomiarze". Tygodnie z próbą poniżej 10 odpowiedzi mają puste punkty i notkę.
- Logika w `lib/audit.ts` (`computeBenchmark`, `buildMetrics`, `weeklyHistory`, `topMentioned`), testy w `tests/audit-report.test.ts` i `tests/ui-helpers.test.ts`. Pamięć podręczna audytu (`lib/audit-cache.ts`, klucz `audyt-v2`) jest wspólna dla strony audytu i pulpitu.

## Strona główna

Dane z `lib/landing-repo.ts` (odczyt, pamięć podręczna 1 godzina): liczba odpowiedzi AI, miast, firm z katalogu wymienionych w odpowiedziach i platform oraz przykład z miasta z największą liczbą pomiarów (3 najczęściej wymieniane firmy i wynik najczęściej wymienianej firmy z katalogu), podpisany "Przykład z pomiaru z <data>, <miasto>". Bez bazy strona pokazuje neutralną ilustrację bez liczb, a pasek liczb znika. Cennik z `geo.plans` (`lib/plans.ts`, uprawnienia opisane po polsku; przycisk "Wkrótce", bo płatności nie działają), zapowiedź programu partnerskiego z `geo.affiliate_terms`, pytania i odpowiedzi, zapis na listę oczekujących. Nie ma żadnych wymyślonych ocen ani opinii.

## Pulpit klienta (`/panel`)

Gauge wyniku dla domeny konta (gdy jest w katalogu i ma pomiary), kroki startowe z prawdziwym stanem (domena dodana, audyt dostępny, partner, płatny pakiet; `lib/panel.ts`), lista "Wymaga uwagi" wyliczana z danych konta i audytu, kafle i tabela firm. `/panel/ustawienia` pokazuje dane konta (edycja później).

## Administracja (`/admin`)

Przegląd z wykresami: pomiary na dzień z 30 dni (`loadMeasurementsPerDay`, `fillDays`), podział na platformy, najczęściej cytowane źródła. Pozostałe strony zachowują dane i filtry, w nowym układzie kart i powłoki.

## Sprawdzenie wyglądu

Lokalny PostgreSQL 16, nowa baza z migracjami, danymi dev i przykładowymi pomiarami (4 tygodnie, 2 miasta), konta administratora i zwykłego użytkownika, `next build` i `next start`, Playwright: zrzuty 1440 i 390 px strony głównej, `/audyt`, raportu (rozbicie, historia, za mało danych, brak w katalogu), `/panel`, `/partner/panel`, `/panel/ustawienia`, `/admin` i podstron; brak przewijania poziomego strony.
