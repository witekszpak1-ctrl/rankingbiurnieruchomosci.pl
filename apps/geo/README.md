# Platforma GEO (apps/geo)

Osobna aplikacja Next.js: strona sprzedażowa, konta firm, pakiety, program partnerski, webhook płatności.
Dane w schemacie `geo` tej samej bazy co katalog (migracje w `db/geo/`), aplikacja łączy się osobną rolą `geo_app`,
więc portale katalogowe (`katalog_app`) nie widzą danych klientów.

## Zmienne środowiska

| Zmienna | Opis |
|---|---|
| `GEO_DATABASE_URL` | połączenie rolą `geo_app` |
| `GEO_SESSION_SECRET` | min. 32 znaki, podpis sesji |
| `GEO_PUBLIC_URL` | adres publiczny do linków partnerów (np. `https://domena.pl`) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...`; bez niego webhook odpowiada 503 |
| `GEO_MIGRATE_URL` | tylko do migracji, rola właściciela bazy |

## Polecenia

```bash
npm install
npm test            # testy jednostkowe
npm run typecheck
npm run migrate     # wymaga GEO_MIGRATE_URL
npm run dev         # http://localhost:3100
```

Administrator: `update geo.users set is_admin = true where email_norm = '...'` (panel wypłat `/admin/partnerzy`).
Panel administratora: `/admin` (przegląd, pomiary, źródła, firmy, lista oczekujących, użytkownicy; `docs/geo/panel-admina.md`).
Opis programu partnerskiego: `docs/geo/program-partnerski.md`.
