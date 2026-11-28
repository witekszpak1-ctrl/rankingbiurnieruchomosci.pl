# Zadania

Status: `[x]` zrobione, `[~]` w toku, `[ ]` do zrobienia, `[!]` zablokowane (powód w BLOCKERS.md).
Każdy agent zaczyna od tego pliku i kończy jego aktualizacją w tym samym commicie co zmiana.

## Platforma GEO

- [x] Schemat `geo`: użytkownicy, konta, pakiety z uprawnieniami w JSON, abonamenty, płatności, program partnerski
- [x] Program partnerski: link, kliknięcia, przypisanie, prowizje 20% dożywotnio, zwroty, panel partnera, wypłaty
- [x] Webhook Stripe (płatność, zwrot, obciążenie zwrotne), idempotentny
- [x] Logowanie i rejestracja firm i partnerów
- [x] Wdrożenie: projekt Vercel `geotrace` (katalog `apps/geo`, region fra1, prywatny do czasu domeny,
      adres https://geotrace-witek1.vercel.app), schemat `geo` 0001-0003 na bazie produkcyjnej, rola `geo_app`
- [ ] Pierwsze konto administratora GeoTrace (właściciel zakłada konto, potem `is_admin = true`)
- [x] Nazwa robocza GeoTrace (geotrace.pl wolna 28.11, niekupiona)
- [x] Rejestr pytań i pomiarów AI (`db/geo/0002_measurements.sql`), klucz pamięci podręcznej i wskaźniki z przedziałem niepewności (`apps/geo/lib/measure.ts`)
- [!] Adapter DataForSEO LLM Scraper (konto i 50 USD)
- [x] Test LiteScrape (28.11, 14 zapytań): Gemini, Google AI Mode i AI Overview działają po polsku (raport
      `queue/results/reports/ai-check-2026-11-28T0453.json` w repozytorium kolejki). ChatGPT w LiteScrape nie ma.
- [x] Adapter pomiarów LiteScrape (Gemini, AI Mode, AI Overview) zapisujący do geo.measurements, mentions, citations:
      `katalog geo-measure --cities N --platforms gemini,google_ai_mode,google_ai_overview --per-city-prompts K --max-calls M
      --max-age-days 7 --save-raw KATALOG --dry-run` (`apps/worker/katalog_worker/geo_measure.py`). Płatne: twardy limit 50 zapytań,
      domyślnie 20; świeży pomiar (ten sam klucz pamięci co w `apps/geo/lib/measure.ts`) jest używany ponownie. Nie uruchamiany
      automatycznie w CI. Parsery tolerancyjne - kształt `text_blocks`, `references`, `ai_overview` do potwierdzenia na żywo (`--save-raw`).
- [ ] Monitoring co tydzień (poniedziałek): workflow geo-measure z harmonogramem; jeśli harmonogram GitHub nie ruszy,
      zaplanowana sesja w poniedziałek wypycha gałąź run/geo-measure z parametrami 20 miast, 3 pytania
- [x] Koszt zapytań AI w LiteScrape: pole `billed` to tylko true (zapytanie policzone), jedna odpowiedź = jedno zapytanie z salda (ok. 0,15 USD za 1000); różnicę sprawdzać w saldzie /admin/koszty
- [~] Darmowy audyt: wersja 1 z pomiarów biblioteki i katalogu (bez nowych zapytań) gotowa na gałęzi claude/audyt-mvp (`/audyt`, `/audyt/<domena>`, `docs/geo/audyt.md`, testy i sprawdzenie na lokalnej bazie). Przed scaleniem: właściciel nakłada `db/geo/0004_catalog_read.sql`. Dalej: pomiar na żywo za budżetem, skan strony, rozpoznawanie branży
- [!] Płatności: produkty i ceny w Stripe, Checkout, portal klienta (właściciel na razie nie ma konta Stripe)
- [ ] Faktury zgodne z KSeF (wybór programu do faktur)
- [x] Panel administratora GeoTrace `/admin` (28.11, apps/geo): przegląd, pomiary z filtrami i szczegółami, źródła, firmy (kandydaci do katalogu), lista oczekujących z CSV, użytkownicy z przełącznikiem administratora; tylko odczyt z bazy, bez płatnych zapytań, bez migracji (`docs/geo/panel-admina.md`)
- [x] Silnik uprawnień (`apps/geo/lib/entitlements.ts`): limity z `plans.entitlements`, powrót do Free przy zaległości
- [ ] Regulamin platformy i programu partnerskiego (prawnik)

## Katalogi

- [x] Portal biur rachunkowych wdrożony prywatnie: projekt Vercel `portal-rachunkowe` (katalog apps/web, PORTAL=rachunkowe,
      rola bazy portal_app z prawami katalog_app), adres https://portal-rachunkowe-witek1.vercel.app (widoczny tylko po
      zalogowaniu do Vercel do czasu domeny i danych)
- [ ] Kolejne portale (oze, remonty, budowlane, warsztaty, przeprowadzki, weterynarze): taki sam projekt Vercel z PORTAL=<slug>
      po przejściu pakietu branży przez testy

- [x] Opinie Google na profilach: tylko ocena, liczba i link (wdrożone 28.11)
- [~] Przycisk "sprawdź widoczność w AI" na profilach: gotowy na gałęzi claude/premium, pokazuje się po ustawieniu `NEXT_PUBLIC_GEO_AUDIT_URL` (dziś nieustawione, produkcja bez zmian)
- [!] DNS rankingbiurnieruchomosci.pl do Cloudflare (właściciel: dodanie strony w Cloudflare i zmiana serwerów DNS w aftermarket.pl)

- [ ] Wielobranżowość strony: konfiguracja portalu z bazy, teksty branży z pakietu, nie z kodu
- [ ] Motywy i warianty układu per portal (decyzja: portale mają się różnić)
- [~] Profil Premium: gałąź claude/premium (render sekcji "Informacje od firmy", podgląd szkicu `/podglad/<token>`, tabela `listing_premium`, testy; opis `docs/geo/profil-premium.md`). Przed scaleniem: właściciel nakłada `db/migrations/0022_listing_premium.sql`. Dalej: zapisy z GeoTrace (migracja z prawami zapisu), generowanie linków podglądu
- [~] Strony miast w ISR: widok domyślny `/[city]` z pamięci podręcznej, filtry i strony (`?cel=`, `?filtr=`, `?strona=`) przez przepisanie na `/widok/[city]` (gałąź claude/premium); po wdrożeniu sprawdzić na Vercelu nagłówki i obciążenie Neona
- [x] Wagi rankingu z konfiguracji portalu (`ranking.weights` w `portals/*.ts`), wyniki nieruchomości bez zmian (test z wartościami referencyjnymi; gałąź claude/premium)
- [ ] Powiadomienia z art. 14 RODO do firm (informacja bez reklamy)
- [~] Silnik wielu branż w stronie (apps/web): branża, nazwy, teksty, dane strukturalne i wygląd z konfiguracji
  - krok 1 zrobiony: konfiguracja portalu (`lib/portal.ts`, `portals/nieruchomosci.ts`), część wspólna (nazwa, adres, meta, llms, manifest, stopka, dane strukturalne, motyw `data-theme`) na konfiguracji, bez zmiany wyglądu; zostaje wybór po domenie, motywy i układy per portal, reszta tekstów (`docs/geo/silnik-branz.md`)
  - krok 2 zrobiony: jeden projekt Vercel na portal (zmienna `PORTAL`, strony ISR bez `headers()`), dane ograniczone do branży portalu (`lib/vertical-scope.ts`), portal `rachunkowe` (`portals/rachunkowe.ts`, motyw `rachunkowe`), flagi funkcji (oferty, blog, raporty, wyróżnienia, cele klienta, mediana prowizji), teksty wspólne z konfiguracji; opis i uruchomienie nowego portalu w `docs/geo/silnik-branz.md`. Zostaje: logo i ikony per portal, wagi rankingu per branża, domena rachunkowych, osobne warianty układu
- [x] Pakiet branży biura rachunkowe (packages/verticals/rachunkowe): konfiguracja, prompty, miasta (28.11; blokery: docs/geo/branza-rachunkowe.md)
- [x] Robot wielobranżowy (28.11, gałąź claude/robot-branze): `domains.vertical_id`, osobna kolejka miast (`vertical_cities`)
      dla branż innych niż nieruchomości, `--vertical` we wszystkich etapach i workflowach, ścieżki kolejki z prefiksem
      branży, próbne zbieranie `collect-sample.yml` z twardym budżetem LiteScrape. Migracja `0021_multi_vertical.sql`
      wymaga roli właściciela bazy (szczegóły i uruchomienie próbki: docs/geo/branza-rachunkowe.md). Zostaje: eksport
      promptu z panelu per branża (prompt rachunkowych jest w pakiecie branży, panel ma jeden)
- [x] Bezpiecznik LiteScrape po awarii 503 z 28.11 (apps/worker): po 5 kolejnych błędach 5xx albo sieci klient wyłącza się
      ("LiteScrape niedostępny (seria błędów 5xx)"), wyszukiwanie 'auto' przechodzi na Serper jak przy 402 i powtarza
      zapytania bez odpowiedzi; zapytanie bez odpowiedzi nie jest zapisywane jako 0 wyników, a miasto bez odpowiedzi
      dostawcy nie dostaje `last_searched_at` (przebieg dostaje status failed i kod wyjścia 1); geo-measure staje po
      3 błędach z rzędu albo po wyłączeniu klienta. Do sprawdzenia: miasta, które 28.11 ok. 08:40 UTC dostały znacznik
      mimo zerowych wyników, trzeba ręcznie wyczyścić (`last_searched_at` w `cities` i `vertical_cities`)
- [ ] Silnik wielu branż, krok 2: wybór portalu po domenie (middleware, stałe zamienione na funkcje), reszta tekstów
      ze stron, motyw i wariant układu dla portalu biur rachunkowych (docs/geo/silnik-branz.md)
- [ ] Próbka 200 biur rachunkowych i raport jakości (zgoda na 2 USD, po robocie wielobranżowym; najpierw 1 miasto)
- [!] Domena portalu biur rachunkowych (właściciel)
- [ ] Kolejne branże według tabeli w DECISIONS.md (nr 3-18), po jednej, każda przez bramkę jakości

## Koszty

- [x] Neon: profile firm w pamięci podręcznej (ISR, wdrożone 28.11); minimum mocy 0,25 (inna sesja, 27.11)
- [ ] Neon: strony miast nadal renderują się przy każdym wejściu (filtry w parametrach adresu); ocenić po raporcie zużycia z 29.11
