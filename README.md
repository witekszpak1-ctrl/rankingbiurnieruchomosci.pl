# katalog

Platforma katalogów firm pod wyszukiwarki AI. Pierwsza branża: biura nieruchomości (`rankingbiurnieruchomosci.pl`,
cała Polska w rozbiciu na miasta). Pełny plan: [docs/PLAN.md](docs/PLAN.md).

## Co jest zrobione (F0, F1 oraz pierwszy wycinek F2 i F3)

- `db/migrations/0001_init.sql`: schemat rdzenia (branże, miasta, podmioty, domeny, fakty, ceny, opisy, kolejka, przebiegi).
- `apps/worker`: worker w Pythonie. Pipeline S1-S7, klienci rejestrów, adaptery wyszukiwania, walidator wyników.
- `packages/verticals/nieruchomosci`: konfiguracja branży, prompty dla Claude Code, szablony zestawu wzorcowego.
- `apps/web`: Next.js: strona publiczna (miasta, profile firm, ranking v0, JSON-LD, sitemap, robots, llms.txt) i panel admina
  (logowanie, przegląd, firmy, kolejka weryfikacji, publikacja z bramką, przebiegi, audyt). Szczegóły: `apps/web/README.md`.
- `db/seeds`: fikcyjne dane deweloperskie do lokalnego rozwoju.

## Uruchomienie

```bash
cd apps/worker
python3 -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
python -m pytest            # testy bazy wymagają lokalnego Postgresa, patrz niżej
```

Testy bazy używają `TEST_ADMIN_URL` (domyślnie `postgresql://postgres@127.0.0.1:54329/postgres`) i tworzą w tym
serwerze tymczasowe bazy. Bez serwera testy bazy są pomijane. Konfiguracja produkcyjna: skopiuj `.env.example` do `.env`.

## Pipeline

Każdy etap to osobne polecenie (`katalog --help`). Kolejność:

| Polecenie | Etap | Co robi |
|---|---|---|
| `katalog migrate` | | stosuje migracje (wymaga `DATABASE_URL`) |
| `katalog discover --city Wrocław --provider brave` | S1 | zapytania -> domeny kandydatów |
| `katalog probe` | S3 | strona główna i kontakt (a gdy brak NIP, polityka prywatności lub regulamin), klasyfikacja heurystyczna |
| `katalog verify` | S4 | NIP ze strony -> biała lista VAT i KRS -> weryfikacja domeny |
| `katalog crawl-deep` | S5 | kolejne podstrony zweryfikowanych domen |
| `katalog bundle` | S6 | paczki dla Claude Code w `queue/pending/` |
| `katalog import` | S7 | walidacja wyników z `queue/results/` i zapis w bazie |
| `katalog offers [--dry-run]` | | najnowsze oferty (tytuł i link, najwyżej 20) ze stron opublikowanych biur |
| `katalog status` | | liczby rekordów według statusów |
| `katalog validate --bundle B --result R` | | walidacja jednego wyniku (kod wyjścia 0 = OK) |
| `katalog ab-search --csv entities.csv` | | test A/B dostawców wyszukiwania |

## Kolejka dla Claude Code

`katalog bundle` zapisuje paczki JSON (bez e-maili i telefonów) do `queue/pending/<typ>/<id>.json`.
Claude Code czyta je według instrukcji z `packages/verticals/nieruchomosci/prompts/` i zapisuje wyniki do
`queue/results/<typ>/<id>.json`. `katalog import` waliduje wynik w kodzie: cytaty muszą występować w źródle, każde
zdanie opisu wskazuje fakty, opis nie kopiuje źródła, liczby i tryb VAT w cenach zgadzają się z cytatem.
Katalogi `queue/` i `snapshots/` są w `.gitignore` (dane trzymamy poza gałęzią `main`).

### Automat (bez klikania)

- **pipeline** codziennie o 03:17 UTC: import wyników, publikacja wpisów spełniających bramkę, nowi kandydaci z plików,
  probe, verify, crawl-deep, paczki.
- **import** co 3 godziny: wyniki z gałęzi `queue-data` do bazy i publikacja (`katalog publish-ready`).
- **Codzienna sesja Claude Code** o 05:41 czasu polskiego (zaplanowane zadanie na koncie claude.ai, które budzi jedną stałą
  sesję z podpiętym tym repozytorium): pisze opisy dla nowych paczek i zbiera kandydatów z kolejnego miasta
  z `packages/verticals/nieruchomosci/cities.txt`, według `packages/verticals/nieruchomosci/prompts/daily.md`.
  Paczkę, która nie dotyczy biura nieruchomości, oznacza plikiem `queue/results/skipped/describe/<id>.json`,
  a import zamyka wtedy to zadanie.
- **offers** codziennie o 05:07 UTC: najnowsze oferty nieruchomości ze stron opublikowanych biur (tytuł i link do oferty
  na stronie firmy, najwyżej 20 na biuro, w kolejności ze strony). Crawler znajduje podstronę z ofertami (np. `/oferty`),
  zapamiętuje ją i potem pobiera tylko ją. Oferty bierze z JSON-LD albo z powtarzalnych linków o wspólnym wzorcu adresu,
  których tytuły lub adresy wyglądają na nieruchomości. Nie zapisuje opisów, cen ani zdjęć, a ofert z kontaktem w tytule
  pomija. Gdy odczyt się nie uda, zostają poprzednie oferty, a strona ukrywa te niewidziane od 14 dni. Strony, które
  ładują oferty skryptem (bez HTML), na razie nie dają ofert.
- **Vercel** wdraża stronę sam po każdym pushu na `main`, który zmienia `apps/web` (projekt jest połączony z repozytorium,
  katalog główny `apps/web`). Inne gałęzie, w tym `queue-data`, i commity bez zmian w `apps/web` są pomijane.
- Kolejność w ciągu doby (UTC): 03:17 pipeline buduje paczki, 04:41 sesja Claude Code pisze opisy, import co 3 godziny
  (od 00:37) zapisuje je w bazie i publikuje wpisy.
- Automatyczna publikacja działa, gdy w tabeli `settings` jest `auto_publish = true` (migracja 0003). Bramka: domena
  zweryfikowana NIP-em, zwalidowany opis, minimum faktów. Każda publikacja ma wpis w audycie (aktor `pipeline`), wpis można
  wycofać w panelu. Miasto wpisu: miasto z wyszukiwania, jeśli strona firmy je wymienia (zamiast wsi z adresu w rejestrze).
  Nazwa marki: pole `brand` z wyniku opisu (z cytatem ze strony), zamiast tytułu strony.

### Obieg na produkcji (GitHub Actions + sesja Claude Code)

Sesje Claude Code nie mają dostępu do artefaktów Actions ani do bazy, więc kolejka przechodzi przez gałąź `queue-data`
tego samego repozytorium (bez wspólnej historii z `main`, tylko katalog `queue/`). Obsługuje ją `scripts/queue_sync.sh`.

0. Kandydaci bez klucza wyszukiwarki: sesja Claude Code zbiera wyniki własnym narzędziem WebSearch (z wykluczonymi
   portalami i katalogami, żeby trafiały strony samych firm), zapisuje je w `queue/candidates/<miasto>-<data>.json`
   (format w `katalog_worker/search/file.py`) i wysyła `bash scripts/queue_sync.sh push-candidates`. Ten sam plik
   importuje się tylko raz (suma SHA-256 w `search_queries.params`).
1. Workflow **pipeline** (ręcznie, źródło `file`, `serper` albo `brave`): pobiera kolejkę z `queue-data`, odtwarza zadania,
   których pliki paczek zginęły (`katalog requeue-lost`), przywraca zrzuty stron z cache Actions, potem discover (dla `file`
   z plików kandydatów), probe, verify, crawl-deep (strony bez zrzutów pobiera od nowa) i bundle. Paczka z kontaktem,
   którego redakcja nie usunęła, jest pomijana i opisana w logu nazwą pola (bez treści). Publikacja paczek
   (`push-pending`, istniejących nie nadpisuje) i zapis zrzutów wykonują się także po błędzie.
2. Sesja Claude Code: `bash scripts/queue_sync.sh pull`, opis każdej paczki z `queue/pending/` według
   `packages/verticals/nieruchomosci/prompts/`, wynik do `queue/results/<typ>/<id>.json`, sprawdzenie
   `katalog validate --bundle B --result R`, potem `bash scripts/queue_sync.sh push-results`.
3. Workflow **import** (co 3 godziny albo ręcznie): pobiera kolejkę z `queue-data`, `katalog import` waliduje wyniki,
   zapisuje je w bazie i publikuje wpisy spełniające bramkę.

Wymagane w ustawieniach repozytorium: sekret `DATABASE_URL`. Zmienna `CRAWLER_USER_AGENT` jest nieobowiązkowa (domyślnie
`KatalogBot/0.1 (+https://rankingbiurnieruchomosci.pl/bot)`, a strona `/bot` prowadzi do formularza kontaktowego). Klucze `SERPER_API_KEY` lub `BRAVE_API_KEY` są potrzebne tylko dla źródeł `serper` i `brave`. Skrypt kolejki przetestowano lokalnie na
tymczasowym zdalnym repozytorium. Workflow pipeline przeszedł w Actions na produkcyjnej bazie (15 paczek, 14 opisów).

## Zasady

- Do katalogu trafiają tylko firmy ze zweryfikowaną stroną (NIP ze strony zgodny z rejestrem).
- Zapisujemy tylko dane firmowe. Z białej listy VAT odrzucamy przedstawicieli, PESEL i rachunki, z KRS nie czytamy
  działu z osobami. Dla osób fizycznych bez adresu działalności zachowujemy tylko miasto i kod pocztowy.
- Crawler respektuje robots.txt, ma własny User-Agent z kontaktem i odstęp między zapytaniami do jednego hosta.

## Stan weryfikacji

Przetestowane: schemat bazy (lokalny Postgres 16), moduły ekstrakcji i weryfikacji, walidator, przepływ S1-S7 z
atrapami (128 testów workera), klienci KRS i białej listy VAT także na żywych API (jedno zapytanie każdy),
aplikacja web: 23 testy jednostkowe, typecheck, build bez bazy oraz test end-to-end w przeglądarce (16 kroków) na danych deweloperskich.
Nieprzetestowane na żywo: adaptery Brave i Serper (kontrakt z pamięci, brak kluczy), crawler na prawdziwych stronach,
Crawl4AI (nie jest jeszcze użyty, fetcher używa httpx bez renderowania JS), workflow GitHub Actions, CEIDG,
logowanie do panelu na produkcji (hasło sprawdzone względem hasha, ta sama ścieżka kodu przeszła test lokalny).

## Wdrożenie produkcyjne

- Vercel: zespół `witek1`, projekt `rankingbiurnieruchomosc.pl` (nazwa projektu ma literówkę względem domeny, można zmienić
  w ustawieniach). Wdrożenie z katalogu `apps/web`, region fra1, build przeszedł, strona i `/llms.txt` odpowiadają,
  zapytania do bazy działają. Zespół ma plan Pro (widać w panelu Vercel), więc użycie komercyjne z reklamami i leadami jest dozwolone.
- Baza: Neon, projekt `witek-dm-agent-db`, osobna baza `katalog` z rolą `katalog_app` (tylko odczyt i zapis w tej bazie).
  To rozwiązanie zastępcze, bo konto Neon jest zarządzane przez Vercel i nie da się tworzyć nowych projektów przez API.
  Zastosowane migracje `0001_init` (23 tabele) i `0002_requests` (zgłoszenia ze strony dla firm), `0003_auto_publish` stosuje workflow, `0004_offers` (oferty) zastosowana z roli właściciela. Obliczenia są współdzielone z innymi bazami tego projektu. Przeniesienie
  do własnego projektu: `pg_dump` i `katalog migrate` na nowej bazie, potem zmiana `DATABASE_URL`.
- Zmienne środowiska produkcyjnego ustawione w Vercel: `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`,
  `ADMIN_SESSION_SECRET`, `SITE_URL`. Brakuje `NEXT_PUBLIC_CONTACT_EMAIL` (strona `/bot` pokazuje wtedy
  User-Agent bez adresu, a `/dla-firm` ma formularz zgłoszeń i nie wymaga adresu).
- Baza produkcyjna jest pusta (bez danych deweloperskich). Domena `rankingbiurnieruchomosci.pl` (z `www`) jest dodana do projektu, ale nie jest jeszcze kupiona ani skierowana w DNS.
- Projekt Vercel jest połączony z repozytorium: push na `main` ze zmianą w `apps/web` wdraża produkcję (ustawienia projektu:
  katalog główny `apps/web`, krok pomijania buildów dla innych gałęzi i commitów bez zmian w `apps/web`). Migracje z DDL
  trzeba zastosować na bazie produkcyjnej przed wdrożeniem (rola aplikacji nie może tworzyć tabel, takie migracje idą
  z roli właściciela bazy). Migracje bez DDL stosuje sam workflow (`katalog migrate`).
- Adres produkcyjny do czasu podpięcia domeny: `https://rankingbiurnieruchomoscpl-witek1.vercel.app`. Ma włączoną ochronę
  Vercel (widzą go tylko zalogowani członkowie zespołu `witek1`). Domena własna będzie publiczna, bo ochrona obejmuje
  wszystko poza domenami własnymi.
