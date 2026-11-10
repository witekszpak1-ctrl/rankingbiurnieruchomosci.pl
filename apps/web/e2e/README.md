# Test end-to-end (ręczny)

Sprawdza w prawdziwej przeglądarce: logowanie do panelu, kolejkę weryfikacji, publikację z bramką, wycofanie, audyt oraz
strony publiczne (ranking, profil firmy, JSON-LD, sitemap, robots, llms.txt, brak przewijania poziomego na telefonie).

Wymaga lokalnej bazy z danymi deweloperskimi (`db/seeds/dev.sql`), zbudowanej aplikacji (`npm run build && npx next start -p 3100`),
zmiennych panelu (ADMIN_EMAIL, ADMIN_PASSWORD_HASH, ADMIN_SESSION_SECRET) i pakietu `playwright`.
Test zmienia dane (publikuje i wycofuje wpisy), więc przed ponownym uruchomieniem załaduj seed od nowa.

```bash
BASE_URL=http://localhost:3100 E2E_ADMIN_EMAIL=admin@example.org E2E_ADMIN_PASSWORD='...' node e2e/flow.cjs
```
