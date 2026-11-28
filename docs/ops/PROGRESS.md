# Postęp

## 28.11.2026

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
