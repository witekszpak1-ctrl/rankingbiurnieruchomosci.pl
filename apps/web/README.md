# apps/web

Strona publiczna i panel admina (Next.js 15, React 19, Postgres przez `pg`).

## Uruchomienie lokalne

```bash
cd apps/web
npm install
cp .env.example .env.local        # uzupełnij DATABASE_URL i zmienne panelu
npm run hash-password -- 'haslo'  # wynik wpisz do ADMIN_PASSWORD_HASH
npm run dev                       # http://localhost:3000
npm test                          # testy jednostkowe (ranking, bramka, slug, sesja, hasła)
npm run typecheck
```

Dane deweloperskie (fikcyjne firmy): `python3 db/seeds/generate_dev_seed.py > db/seeds/dev.sql`, potem załaduj
`dev.sql` do lokalnej bazy po `katalog migrate`. Test end-to-end w przeglądarce: `e2e/README.md`.

## Strona publiczna

| Adres | Co pokazuje |
|---|---|
| `/` | miasta z opublikowanymi wpisami |
| `/{miasto}` | ranking (od 5 biur) lub lista, mediana prowizji (od 3 jawnych cen), JSON-LD `ItemList` |
| `/{miasto}/{firma}` | opis, usługi, ceny z cytatem i datą, wynik z rozbiciem, JSON-LD `RealEstateAgent` |
| `/metodologia`, `/reklama`, `/dla-firm`, `/bot` | strony zasad i zgłoszeń |
| `/sitemap.xml`, `/robots.txt`, `/llms.txt` | dla wyszukiwarek i asystentów AI |

Miasto z mniejszą liczbą biur niż próg ma `noindex` i nie trafia do sitemap. Do sitemap trafiają tylko wpisy ze statusem
`published` i `noindex = false`. Strony są renderowane po stronie serwera z odświeżaniem co 5 minut (ISR), a akcje panelu
odświeżają je od razu.

## Panel admina (`/admin`)

Logowanie jednym kontem z konfiguracji środowiska (sesja podpisana HMAC, ciasteczko HttpOnly, 12 godzin). Strony:
przegląd (lejek, kolejki, wydajność wyszukiwania), firmy (filtry, karta z faktami i źródłami), kolejka weryfikacji
(zatwierdź lub odrzuć domenę z powodami), przebiegi pipeline, audyt zmian. Publikacja wpisu przechodzi przez bramkę
(domena zweryfikowana, zwalidowany opis, minimum faktów z ustawienia `publish_min_facts`), którą można świadomie wymusić.
Każda zmiana zapisuje wpis w `audit_log`.

## Ograniczenia (wersja robocza)

- Jedno konto admina bez ról. Role (redaktor, sprzedaż) i zarządzanie użytkownikami dojdą później, najpewniej na
  Neon Auth albo Auth.js. Brak limitu prób logowania poza krótkim opóźnieniem (docelowo zapora na brzegu, np. Cloudflare).
- Ranking v0 używa tylko parametrów, na które są dane (staż, jawność cennika, spójność danych, zakres usług).
- Brak formularzy leadów, zgłoszeń korekty, reklam i panelu firmy (fazy F4 i F6 w `docs/PLAN.md`).
- Adres kontaktowy (`NEXT_PUBLIC_CONTACT_EMAIL`) i dane administratora na stronie `/dla-firm` wymagają uzupełnienia
  oraz weryfikacji prawnej przed publicznym startem.
