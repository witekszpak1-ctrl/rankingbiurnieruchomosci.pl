# Postęp

## 28.11.2026

- Profil Premium, przycisk audytu, wagi rankingu z konfiguracji, ISR stron miast (gałąź `claude/premium`, do scalenia przez koordynatora po nałożeniu migracji `0022_listing_premium.sql`): tabela `listing_premium`, sekcje "Informacje od firmy" tylko z wiersza `published`, podgląd szkicu `/podglad/<token>` (HMAC z `ADMIN_SESSION_SECRET`, noindex, no-store), przycisk audytu GeoTrace pod `NEXT_PUBLIC_GEO_AUDIT_URL`, `ranking.weights` w konfiguracji portalu (wyniki bez zmian), `/[city]` jako ISR i filtry przez przepisanie na `/widok/[city]`. Porównanie HTML 32 adresów bez różnic poza 404 i niedeterministycznym `/wyroznienia-2026`; Playwright, 182 testy, typecheck i build zielone. Opis: `docs/geo/profil-premium.md`.
- Silnik branż, krok 2 (apps/web): wybór portalu zmienną `PORTAL` (jeden projekt Vercel na portal), zapytania katalogu ograniczone do branży portalu, portal `rachunkowe` z własnym motywem, flagi funkcji i teksty wspólne z konfiguracji; strona nieruchomości bez zmian w HTML (porównanie 31 adresów), testy 158+.
- Audyt projektu i koncepcja (raport dla właściciela poza repozytorium).
- Gałąź `claude/geo-platforma`: aplikacja `apps/geo` z kontami, pakietami i programem partnerskim, schemat `db/geo/0001_core.sql`,
  CI `geo-ci.yml`. Testy: 17 jednostkowych, typecheck, build bez bazy, pełny obieg w przeglądarce na lokalnym PostgreSQL 16.
- Neon: utworzona gałąź testowa `geo-dev` (projekt witek-dm-agent-db, min. 0,25 jednostki, usypianie po 5 min) ze schematem `geo`
  (pusty schemat, bez tabel - sesja nie łączy się z bazą bezpośrednio, migracja do nałożenia przy wdrożeniu).
- Produkcja portalu (wdrożenie 0957977): opinie jako ocena, liczba i link; profile jako ISR (sprawdzone na żywo przez Vercel).
  Poprawiona reguła pomijania buildów Vercela (`apps/web/vercel.json`): porównanie z ostatnim wdrożeniem.
- GeoTrace: nazwa robocza w aplikacji; rejestr pytań i pomiarów AI (schemat 0002), moduł wskaźników z testami (23 testy).
- Zaplanowane zadanie co 4 godziny wznawia tę sesję i bierze kolejne zadanie z TASKS.md.
- Polecenie `katalog geo-measure`: pomiary odpowiedzi AI (Gemini, AI Mode, AI Overview) przez LiteScrape do schematu `geo`, wzmianki o firmach i cytowania, pamięć podręczna zgodna z `measure.ts`; testy w `test_geo_measure.py` (bez żywych zapytań).
- Pierwszy prawdziwy pomiar GeoTrace (28.11, 6 zapytań, Warszawa, za zgodą właściciela): 6 odpowiedzi zapisanych
  w geo.measurements z firmami i źródłami. Po przeglądzie poprawione: nazwy miejsc (miasto, dzielnice) nie dają
  dopasowań do firm, śródtytuły nie są firmami, linki Google (Mapy, wyszukiwanie) nie są źródłami. Te 6 pierwszych
  pomiarów ma wzmianki według starszych reguł (dane testowe).
- Pakiet branży biura rachunkowe (`packages/verticals/rachunkowe`: konfiguracja, prompty, miasta, opis zestawu wzorcowego) i uogólnienie robota (frazy miasta, Mapy, lista domen wykluczonych, ścieżki plików z `--vertical`; bez zmiany zachowania dla nieruchomości), testy `test_verticals_pack.py` bez sieci. Próbka 200 firm: ok. 4400 zapytań LiteScrape, ok. 0,66 USD (do zgody właściciela). Blokery przed zbieraniem: `domains` bez `vertical_id`, wspólna kolejka miast (`docs/geo/branza-rachunkowe.md`).
- Robot wielobranżowy (28.11, gałąź `claude/robot-branze`): migracja `0021_multi_vertical.sql` (`domains.vertical_id` z uzupełnieniem nieruchomości, tabela `vertical_cities`), wszystkie etapy filtrują po `--vertical` (domyślnie nieruchomości, bez zmian), nowe domeny dostają branżę wyszukiwania, paczki innych branż w `queue/pending/<branża>/`, workflow `collect-sample.yml` z budżetem LiteScrape, testy `test_multi_vertical.py`. Migrację stosuje właściciel bazy przed scaleniem.
- Silnik wielu branż, krok 1 (28.11): `PortalConfig` i resolver `currentPortal(host?)` (`apps/web/lib/portal.ts`, portal `nieruchomosci` w `apps/web/portals/`), globalna warstwa strony (nazwa, adres, meta, llms.txt, manifest, obrazek OG, stopka, typ danych strukturalnych, odmiana liczników) i motyw przez `data-theme` + zmienne CSS; HTML 25 adresów przed i po budowie identyczny (poza `data-theme`); testy w `tests/portal.test.ts`; opis i lista pozostałych treści w `docs/geo/silnik-branz.md`.
- Robot wielobranżowy na produkcji (migracja 0021 zastosowana rolą właściciela: domeny z branżą, kolejka miast per branża).
  Pierwszy pełny pomiar AI: 103 odpowiedzi z 12 miast przed limitem czasu workflow (podniesiony do 150 min, ponowiony).
  Zlecone: próbka biur rachunkowych w 1 mieście (collect-sample, bezpiecznik 3000 zapytań).
- Pomiar AI 20 miast zakończony (28.11): 179 odpowiedzi (Gemini, Google AI Mode, AI Overview), 2 błędy. Nasz portal
  cytowany w 0 ze 119 odpowiedzi ze źródłami. Najczęściej cytowane: sonarhome.pl (28 odpowiedzi, 14 miast), otodom.pl (23),
  facebook.com (19), pewnylokal.pl (13), oferteo.pl (12), znajdom.pl (11), nestivo.pl (10). 70% wzmianek o firmach
  (394 z 562) to firmy z naszego katalogu (178 różnych). Próbka biur rachunkowych uruchomiona ponownie (poprzednie
  uruchomienie wypchnięte z kolejki GitHub przez ponowiony pomiar).
- Darmowy audyt widoczności w AI, wersja 1 (28.11, gałąź `claude/audyt-mvp`): `/audyt` i `/audyt/<domena>` w `apps/geo` z samych danych w bazie (biblioteka pomiarów + katalog, bez płatnych zapytań), `lib/audit.ts` (normalizacja domeny z ochroną SSRF, wskaźniki z `measure.ts`), `lib/audit-repo.ts`, migracja `db/geo/0004_catalog_read.sql` (SELECT dla `geo_app`, do nałożenia przez właściciela), 23 nowe testy, sprawdzone na lokalnym PostgreSQL 16. Opis: `docs/geo/audyt.md`.
- Awaria LiteScrape 28.11 ok. 08:40 UTC (HTTP 503 na wszystkich endpointach): wyszukiwania zapisały się z 0 wyników i miasta dostały `last_searched_at`, bez przejścia na Serper. Poprawka w workerze: bezpiecznik klienta (5 błędów 5xx z rzędu), przejście na Serper, brak znacznika przeszukania i zapisu "0 wyników" przy braku odpowiedzi dostawcy, stop geo-measure po serii błędów; testy bez sieci.
