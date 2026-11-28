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
