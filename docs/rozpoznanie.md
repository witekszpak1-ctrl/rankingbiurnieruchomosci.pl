# Rozpoznanie projektu (etap 0 planu poprawy)

Stan na 14 listopada 2026 r. Opis tego, jak działa projekt, zanim zaczną się zmiany. Liczby z bazy produkcyjnej
z tego dnia.

## 1. Technologia i wdrażanie

| Część | Technologia | Gdzie |
| --- | --- | --- |
| Strona i panel | Next.js 15 (katalog `app`), React 19, TypeScript, biblioteka `pg` | `apps/web` |
| Robot i automat | Python 3, polecenie `katalog` (argparse), psycopg | `apps/worker` |
| Baza danych | PostgreSQL w Neon (projekt `katalog`) | migracje SQL w `db/migrations` (0001-0018) |
| Wdrażanie strony | Vercel, automatycznie po każdym wypchnięciu na `main` | projekt `rankingbiurnieruchomosc.pl` |
| Automat danych | GitHub Actions: `pipeline.yml`, `offers.yml`, `import.yml` | `.github/workflows` |
| Opisy firm | sesje Claude Code co godzinę, wyniki przez prywatne repozytorium kolejki | `packages/verticals/nieruchomosci/prompts/daily.md`, `scripts/queue_sync.sh` |

Harmonogramy GitHub (`cron` w plikach workflow) w praktyce nie uruchamiają się. Workflow `pipeline.yml` uruchamia
sesja Claude co godzinę, a także sam pipeline, gdy została praca (krok "Kolejny przebieg"). `offers.yml` sesja
uruchamia rano, `import.yml` ma własny harmonogram.

Migracje uruchamia krok "Migracje" w każdym workflow. Rola bazy używana przez automat nie jest właścicielem tabel,
więc migracje zmieniające tabele (np. `alter table`) trzeba wykonać ręcznie jako właściciel i dopisać do
`schema_migrations` (wersja i suma sha256 pliku).

## 2. Schemat danych

Główne tabele (pełne definicje w `db/migrations`):

- **`brands`** - firma widoczna w katalogu (nazwa, zdjęcie, logo). `legal_entity_id` wskazuje wpis w rejestrze,
  `null` oznacza firmę bez potwierdzenia w rejestrze.
- **`legal_entities`** - dane z rejestrów: NIP, REGON, KRS, nazwa, forma prawna, adres siedziby
  (`registered_address`), data rozpoczęcia działalności (`start_date`).
- **`domains`** - strony internetowe firm. `city_hint` to miasto, w którym robot znalazł stronę w wyszukiwarce.
  Są tu też klasyfikacja strony, wynik weryfikacji (`verification_score`) oraz daty: pogłębionego przeszukania
  (`deep_crawled_at`), ponownej weryfikacji (`reverified_at`) i sprawdzenia ofert.
- **`cities`** - miasta. Pola wyszukiwania (`search_enabled`, `last_searched_at`, `deep_requested_at`) i tekst
  redakcyjny `editorial`.
- **`listings`** - wpis firmy w mieście: `brand_id`, `vertical_id`, `city_id`, `slug`, `status`
  (`needs_review`, `verified`, `published`, `removed`, `rejected`), `published_at`, `noindex`.
  Unikalność: marka, branża i miasto.
- **`facts`** - fakty o firmie odczytane ze strony (usługi, adresy, telefony itd.) z cytatem i adresem źródła.
  `is_current` oznacza fakt aktualny.
- **`price_items`** - ceny usług (prowizje) ze stron firm.
- **`offers`** - oferty nieruchomości ze stron firm (tytuł, adres, cena, `is_active`, `last_seen_at`).
- **`descriptions`** - opisy firm pisane przez sesje Claude (wersje, status `validated` lub `published`).
- **`google_places`** - ocena, liczba opinii i opinie z Google (Places API).
- **`crawl_pages`** - pobrane strony (zrzuty), `queue_items` - zadania kolejki opisów, `search_queries`
  i `search_results` - historia wyszukiwań.
- **`audit_log`** - dziennik zmian (kto, co, przed i po). Z niego wiadomo, które wpisy dodał krok miast dodatkowych
  (`listing.publish_extra_city`).
- **Formularze i statystyki:** `leads` (zapytania do biur), `requests` (zgłoszenia na `/dla-firm`),
  `owner_claims` (zgłoszenia właścicieli), `page_views`.
- **Ustawienia:** `settings` (np. `auto_publish`, `publish_min_facts` = 3), `pipeline_runs` (historia przebiegów).

Osobnej tabeli wyników nie ma: wynik w rankingu liczy strona przy każdym wyświetleniu (punkt 4).

Liczby z 14.11.2026:

| Co | Liczba |
| --- | --- |
| Marki (`brands`) | 2342 |
| Domeny | 3265 |
| Firmy z rejestru (`legal_entities`) | 963 |
| Wpisy opublikowane | 2146 |
| w tym wpisy w miastach dodatkowych | 200 |
| Marki z co najmniej jednym opublikowanym wpisem | 1945 |
| Opublikowane wpisy firm bez potwierdzenia w rejestrze | 1282 |

## 3. Skąd robot bierze biura i ich miasto

Kolejne etapy (`apps/worker/katalog_worker/pipeline.py`):

1. **Wyszukiwanie** - `stage_discover_queue` i `stage_discover`. Zapytania "biuro nieruchomości {miasto}",
   "agencja nieruchomości {miasto}" itd. idą do Serpera (wyniki Google, `search/serper.py`). Każda nowa domena
   zapisuje się przez `repo.upsert_domain(host, url, city)` z miastem wyszukiwania jako **`city_hint`**.
2. **Sprawdzenie strony** - `stage_probe` pobiera stronę główną i klasyfikuje ją (`classify.py`, `classify_page`):
   oficjalna strona biura, portal, katalog itd.
3. **Weryfikacja w rejestrze** - `stage_verify`. NIP-y ze strony sprawdza w wykazie podatników VAT
   (`registry/mf_vat.py`), a dla spółek pobiera dane z KRS (`registry/krs.py`). Z CEIDG automat nie korzysta.
   Tu powstają marka i wpis:
   - firma potwierdzona: `upsert_legal_entity`, `upsert_brand`, wpis o statusie `verified` lub `needs_review`;
   - firma bez potwierdzenia (brak NIP na stronie): `insert_unregistered_brand` z nazwą ze strony
     (`_brand_name`), wpis `needs_review`.
4. **Miasto wpisu** - funkcja **`listing_city(registry_city, city_hint, pages_text)`** w `pipeline.py`:
   - jeśli strona firmy wymienia miasto wyszukiwania (`mentions_city`), wpis dostaje miasto wyszukiwania;
   - w przeciwnym razie dostaje miejscowość siedziby z rejestru;
   - gdy nie ma ani jednego, ani drugiego, dostaje miasto wyszukiwania.
5. **Ponowna weryfikacja** - `stage_reverify` sprawdza od nowa strony bez potwierdzenia (po pogłębionym
   przeszukaniu `stage_crawl_deep`). Miasto ustala tą samą funkcją `listing_city`.
6. **Publikacja** - `stage_publish_ready`, gdy `auto_publish` = true. Warunki: zwalidowany opis i co najmniej
   `publish_min_facts` faktów. Przy publikacji może zmienić miasto wpisu na `city_hint`, jeśli fakty o firmie
   wymieniają to miasto (znów `mentions_city`).
7. **Miasta dodatkowe** - `stage_extra_cities` (dodane 13.11.2026). Wpis w kolejnym mieście dostaje firma,
   której co najmniej 3 aktywne oferty wymieniają to miasto. Wystarczy też adres biura w tym mieście z faktów,
   jeśli jest tam co najmniej jedna oferta. Krok bierze pod uwagę tylko miasta, które mają już stronę,
   i najwyżej 10 miast na firmę. Odmianę nazw rozpoznaje `offer_mentions_city` po znanych końcówkach
   (w Karpaczu, w Lublinie). Przy każdym przebiegu krok sprawdza wpisy, które sam dodał, i wycofuje
   nietrafione (status `removed`).

**Słaby punkt dla etapu 2:** `mentions_city` (`pipeline.py`) sprawdza tylko, czy w całym tekście strony występuje
początek nazwy miasta (nazwa bez 2 ostatnich liter, co najmniej 4 litery). Dlatego:
- "Warszawa" pasuje do "ul. Warszawska" albo do adresu UODO w polityce prywatności;
- "Lublin" pasuje do "Lubliniec";
- "Szczyrk" pasuje do słowa "szczyt".

Gdy wyszukiwarka zwróci firmę z Jasła na zapytanie o Warszawę, a jej strona ma "ul. Warszawska", główny wpis
trafia do Warszawy, a nie do Jasła z rejestru. W `stage_extra_cities` ten sam błąd poprawiono 14.11.2026
(dopasowanie po znanych końcówkach odmiany). W głównym przypisaniu miasta nadal występuje.

Przykłady z audytu (Szczyrk 86 biur; Jasło, Elbląg, Olkusz, Koszalin w Warszawie) pochodziły z kroku miast
dodatkowych w wersji z 13.11. Po poprawkach z 14.11 Szczyrk ma 6 wpisów, a wpisy z Warszawy są wycofywane.

## 4. Jak liczony jest wynik

Plik `apps/web/lib/ranking.ts`, funkcja `scoreListing` (kolejność w mieście: `rankListings`).

| Parametr | Waga | Wartość od 0 do 1 |
| --- | --- | --- |
| Potwierdzenie w rejestrze | 20 | 1 albo 0 |
| Staż w rejestrze | 10 | lata od wpisu / 15 (pomijany bez daty) |
| Jawność cennika | 15 | 1, gdy firma publikuje ceny |
| Spójność danych | 10 | wynik weryfikacji / 100 (pomijany bez wyniku) |
| Zakres usług | 10 | liczba usług / 6 |
| Opinie w Google | 10 | (ocena - 1) / 4 x min(1, opinie / 30) (pomijany bez profilu) |
| Aktualne oferty | 15 | liczba ofert / 20 |

Suma wag to 90. Wynik = suma (wartość x waga) / suma wag parametrów, które mają dane, x 100. Parametry bez danych
są pomijane, a pozostałe wagi przeliczane, więc przeskalowanie wag do 100 nie zmieniłoby żadnego wyniku.

Ranking (pozycje) pokazujemy od `CITY_RANKING_MIN` = 5 firm w mieście. Poniżej tego progu strona miasta pokazuje
listę bez pozycji. Ranking ogólnopolski (`app/ranking/page.tsx`) jest indeksowany od 10 firm.

## 5. Gdzie co jest generowane

| Co | Plik |
| --- | --- |
| Mapa strony | `apps/web/app/sitemap.ts` (dane: `listPublishedPaths` w `lib/catalog.ts`) |
| robots.txt | `apps/web/app/robots.ts` (blokuje `/admin`, `/szukaj`, `/regulamin`, `/polityka-prywatnosci`) |
| llms.txt | `apps/web/app/llms.txt/route.ts` |
| Tytuły i opisy stron | `apps/web/lib/meta-texts.ts`, wspólne metadane i canonical: `lib/seo.ts` (`pageMetadata`) |
| Dane strukturalne | `app/page.tsx` (WebSite, Organization, FAQPage), `app/[city]/page.tsx` (CollectionPage, ItemList, FAQPage), `app/[city]/[firm]/page.tsx` (RealEstateAgent, WebPage, FAQPage), `app/ranking/page.tsx` (CollectionPage, ItemList), okruszki BreadcrumbList w `lib/seo.ts`, komponent `JsonLd` w `components/SiteChrome.tsx` |
| Teksty miast | `apps/web/lib/city-content.ts` (wstęp, trzy pierwsze firmy, prowizje, poradnik, najczęstsze pytania, wszystko z danych miasta) oraz tekst redakcyjny `cities.editorial` z panelu |
| Odmiana liczebników | `apps/web/lib/plural.ts` (`plural`, `nBiur`, `nBiurGen`) |
| Wyłączanie małych miast z wyszukiwarki | `app/[city]/page.tsx`: `noindex`, gdy miasto ma mniej niż `CITY_RANKING_MIN` (5) firm; takie miasta nie trafiają też do mapy strony |
| Dane operatora | `apps/web/lib/legal.ts` (`operator()`), komponenty `components/LegalOperator.tsx` |

**Mapa strony: 1945 profili.** To liczba marek z opublikowanym wpisem. Firma z wpisami w kilku miastach ma w mapie
tylko wpis główny (najwcześniej opublikowany), bo ten sam wpis jest kanoniczny na stronach jej pozostałych miast.
To celowe, nie błąd.

**Liczby na stronie głównej (`homeStats` w `lib/catalog.ts`) są zawyżone.** "Biura" to liczba opublikowanych
wpisów, nie firm, więc firma w trzech miastach liczy się trzy razy. To wyjaśnia 2836 biur z audytu, zrobionego zaraz po
przebiegu, który dodał setki wpisów w miastach dodatkowych (dziś 2146 wpisów i 1945 firm).
Liczba ofert jest mnożona przez liczbę miast firmy. Do poprawy (etap 6 albo wcześniej).

## 6. Testy

| Część | Polecenie | Uwagi |
| --- | --- | --- |
| Robot | `cd apps/worker && python -m pytest` | 227 testów. Część wymaga lokalnego PostgreSQL (`TEST_ADMIN_URL`, domyślnie `postgresql://postgres@127.0.0.1:54329/postgres`); bez bazy te testy są pomijane |
| Strona | `cd apps/web && npm test` (vitest), `npm run typecheck`, `npm run build` | testy w `apps/web/tests` (ranking, SEO, odmiana, treści miast, slugi i inne) |
| CI | `worker-ci.yml` i `web-ci.yml` | uruchamiają się przy każdym wypchnięciu |

## 7. Inne ustalenia ważne dla kolejnych etapów

- **Nazwy typu "Strona główna"** biorą się z `_brand_name` (`pipeline.py`). Dla firm bez rejestru nazwa pochodzi
  z `og:site_name`, danych strukturalnych albo tytułu strony, a słów takich jak "Strona główna" nic nie odrzuca.
  Opublikowany przykład: murzynskinieruchomosci.pl (Kluczbork, w Warszawie jako miasto dodatkowe).
- **"Lokalizacja", "Mieszkanie.com" i "GRUPA.PRO"** z punktu 3.1 planu to prawdziwe biura nieruchomości.
  Lokalizacja jest w rejestrze (NIP 6751655503) i nie powinna trafić do odrzucanych.
- **"Bracia Sadurscy"** to trzy marki z różnymi NIP-ami (spółka komandytowa, działalność Dariusza Sadurskiego,
  marka bez NIP). Scalanie po NIP ich nie połączy, potrzebna jest decyzja.
- **Opinie z Google** są na profilach. Metodologia (`app/metodologia/page.tsx`) mówi "Nie kopiujemy opinii z innych
  serwisów", co trzeba poprawić (decyzja z 14.11: opinie zostają, kolejne po rozwinięciu).
- **Teksty robocze** na `/dla-firm` (`app/dla-firm/page.tsx`, około linii 148 i 150) są nadal na stronie.
- **Przekierowania:** `www.rankingbiurnieruchomosci.pl` przekierowuje na adres bez www (kod 308, ustawienie domeny
  w Vercelu), z http na https przekierowuje Vercel. Adresy z ukośnikiem na końcu (`/krakow/`) Next.js przekierowuje
  na wersję bez ukośnika (kod 308, domyślne `trailingSlash: false`). Test `apps/web/scripts/seo-check.mjs`
  (workflow `seo-check.yml`) sprawdza to po każdym wdrożeniu.

## 8. Decyzje właściciela (14.11.2026)

1. Regulamin i polityka prywatności zostają zablokowane dla robotów (punkt 1.4 planu pomijamy).
2. Opinie z Google zostają na profilach, kolejne widoczne po rozwinięciu. Metodologię dopasowujemy do tego.
3. Nazwa wyniku zostaje bez zmian ("to nasz ranking"). Zmianę nazwy z punktu 4.2 pomijamy.
4. Biura bez potwierdzenia w rejestrze pokazujemy jak teraz: z wynikiem, niżej w rankingu (punkt 4.1 pomijamy).
5. Treść polityki prywatności i regulaminu sprawdził prawnik.
6. Każdy etap na osobnej gałęzi ze zgłoszeniem zmian.
