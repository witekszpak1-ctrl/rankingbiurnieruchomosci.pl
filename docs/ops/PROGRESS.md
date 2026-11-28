# Postęp

## 28.11.2026

- Audyt projektu i koncepcja (raport dla właściciela poza repozytorium).
- Gałąź `claude/geo-platforma`: aplikacja `apps/geo` z kontami, pakietami i programem partnerskim, schemat `db/geo/0001_core.sql`,
  CI `geo-ci.yml`. Testy: 17 jednostkowych, typecheck, build bez bazy, pełny obieg w przeglądarce na lokalnym PostgreSQL 16.
- Neon: utworzona gałąź testowa `geo-dev` (projekt witek-dm-agent-db, min. 0,25 jednostki, usypianie po 5 min) ze schematem `geo`
  (pusty schemat, bez tabel - sesja nie łączy się z bazą bezpośrednio, migracja do nałożenia przy wdrożeniu).
