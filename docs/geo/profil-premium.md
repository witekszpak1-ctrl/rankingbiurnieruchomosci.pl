# Profil Premium, przycisk audytu, wagi rankingu z konfiguracji, strony miast w ISR

Gałąź `claude/premium` (28.11.2026). Dotyczy `apps/web`, migracji `db/migrations/0022_listing_premium.sql` i dokumentacji.
Zasada nadrzędna (`docs/ops/DECISIONS.md`, pkt 4): Premium tylko odsłania więcej danych i nie wpływa na wynik w rankingu.

## 1. Warstwa Premium profilu

**Tabela `listing_premium`** (migracja 0022, addytywna i idempotentna; wymaga roli właściciela bazy, automat jej nie nałoży):

| Kolumna | Znaczenie |
| --- | --- |
| `listing_id` | klucz główny i klucz obcy do `listings` (jeden wiersz na wpis, `on delete cascade`) |
| `status` | `draft` (tylko w podglądzie) albo `published` (na profilu publicznym) |
| `content` | jsonb: `long_description`, `specializations[]`, `service_areas[]`, `faq[{q,a}]`, `team[{name,role}]`, `gallery[{url,alt}]`, `video_url`, `cta_label`, `cta_url` |
| `source` | skąd treść (ślad pochodzenia i zgody) |
| `approved_at`, `updated_at` | czas zatwierdzenia i zmiany |

Prawa: `katalog_app` dostaje tylko `select`. Zapisy dojdą z GeoTrace w osobnej migracji z osobną rolą.

**Odczyt** (`apps/web/lib/premium.ts`): `getPremium(listingId, status)`. Każde pole jest walidowane i przycinane przy odczycie
(limity długości i liczby elementów, tylko adresy http i https, brak pustych elementów), więc zła treść z bazy nie psuje
profilu. Błąd bazy, w tym brak tabeli przed nałożeniem migracji, daje "brak warstwy Premium": profil renderuje się jak dotąd.
Sprawdzone lokalnie (tabela przemianowana, profil odpowiada 200 bez sekcji Premium).

**Renderer.** Profil jest wspólnym komponentem `components/FirmProfile.tsx`; `app/[city]/[firm]/page.tsx` pyta tylko o
`published`. Sekcje Premium (`components/PremiumSections.tsx`) stoją po danych kontaktowych, przed wynikiem w rankingu, w bloku
oddzielonym przerywaną linią. Każda sekcja ma widoczną etykietę "Informacje od firmy", a na końcu bloku jest zdanie, że
treść pochodzi od firmy, nie jest weryfikowana i nie wpływa na wynik. Pytania i odpowiedzi od firmy trafiają do `FAQPage`
JSON-LD tylko z warstwy `published`.

**Wynik w rankingu.** `lib/ranking.ts` i `lib/catalog.ts` nie importują `lib/premium.ts` i nie zawierają `listing_premium`;
`RankingInput` nie ma pól Premium. Pilnuje tego `tests/ranking-config.test.ts` (dodatkowe pola w wejściu nic nie zmieniają,
skan źródeł, definicja typu) i `tests/premium.test.ts`.

**Podgląd szkicu.** `/podglad/<token>` (`app/podglad/[token]/page.tsx`): trasa dynamiczna (`force-dynamic`), meta robots
noindex, nagłówki `X-Robots-Tag: noindex, nofollow` i `Cache-Control: no-store` (`next.config.mjs`), middleware pomija ją
(nie liczy wejścia, nie szuka przekierowań). Token: `<id wpisu>.<HMAC-SHA256 hex>` z `ADMIN_SESSION_SECRET`
(`lib/preview-token.ts`, `previewToken(listingId, secret)` i `verifyPreviewToken(token, secret)`, porównanie
`timingSafeEqual`). Token nie wygasa; unieważnia go zmiana sekretu. Zły token daje 404. Podgląd pokazuje szkic (a gdy go
nie ma, warstwę opublikowaną) i baner "Podgląd szkicu"; JSON-LD nie zawiera treści szkicu. Generowanie linku dla firmy to
zadanie GeoTrace (ma ten sam sekret albo prosi katalog o link): wzór tokenu jest w teście.

**ISR zachowany.** `[city]/[firm]` nie czyta `searchParams`, `headers()` ani `cookies()`; test
(`tests/premium.test.ts`, "ISR profili i stron miast") sprawdza to w stronie i we wspólnych komponentach.

## 2. Przycisk audytu

Blok "Sprawdź, czy ChatGPT i Gemini polecają tę firmę" (`components/AuditBox.tsx`) w kolumnie bocznej profilu, link
`${NEXT_PUBLIC_GEO_AUDIT_URL}/audyt/<domena firmy>?utm_source=ranking&utm_medium=profil&utm_campaign=audyt-ai&utm_content=<miasto>/<firma>`
(`lib/audit-link.ts`). Pokazuje się tylko, gdy zmienna jest ustawiona przy budowaniu (`NEXT_PUBLIC_*`) i firma ma poprawną
domenę. Dziś zmienna nie jest ustawiona, więc HTML produkcji się nie zmienia. Sprawdzone też z ustawioną zmienną (osobny
build lokalny). Podgląd szkicu nie pokazuje przycisku. Po starcie publicznego audytu: ustawić zmienną w projekcie Vercel
i zbudować ponownie.

## 3. Wagi rankingu z konfiguracji portalu

`PortalConfig.ranking.weights` (`portals/nieruchomosci.ts`, `portals/rachunkowe.ts`): mapa klucz parametru -> waga.
`buildParameters(weights)` w `lib/ranking.ts` składa listę parametrów; parametr bez wagi nie istnieje w portalu (zastąpiło to
filtr `features.offers`). Wagi nieruchomości dokładnie jak dotąd (20, 10, 15, 10, 10, 10, 15). Rachunkowe: te same bez
parametru ofert. `scoreListing` dostał opcjonalny trzeci argument (lista parametrów), domyślnie parametry portalu.
Test `tests/ranking-config.test.ts` porównuje wyniki i rozbicia dla 6 wejść z wartościami zebranymi z kodu sprzed zmiany
(`tests/fixtures/ranking-golden.json`). Wagi z `vertical.yaml` mają inne klucze (model docelowy) i na razie nie są czytane.

## 4. Koszt stron miast: ISR dla widoku domyślnego

Problem: `/[city]` czytało `searchParams` (filtry), więc każde wejście, także bota, było renderowane dynamicznie i
obciążało bazę.

Rozwiązanie (najmniejsze ryzyko dla SEO, adresy się nie zmieniają):

- `app/[city]/page.tsx` renderuje wyłącznie widok domyślny (strona 1, bez filtrów): ISR (`revalidate = 300`,
  `generateStaticParams` zwraca `[]`), bez `searchParams`. Wynik budowania: `● /[city]` (było `ƒ`).
- `app/widok/[city]/page.tsx`: trasa dynamiczna z `searchParams` dla widoków z `?cel=`, `?filtr=`, `?strona=`.
- `next.config.mjs` `rewrites()`: `/:city` z parametrem `cel`, `filtr` albo `strona` jest przepisywane na `/widok/:city`.
  Przepisanie działa po trasach statycznych (`/ranking?strona=2`, `/oferty?...` nie są ruszane) i przed trasami
  dynamicznymi. Adres w przeglądarce i dla robotów zostaje taki sam, bez przekierowań 301.
- Treść i metadane stoją we wspólnych `components/CityView.tsx` (`CityView`, `cityMetadata`), więc obie trasy renderują to
  samo. Reguły SEO bez zmian: widoki z filtrami mają noindex i canonical na miasto, kolejne strony własny canonical,
  numer strony poza zakresem to 404.
- Skutek uboczny: wszystkie inne parametry (np. `?utm_source=`) na `/<miasto>` serwują teraz stronę z pamięci podręcznej
  (wcześniej renderowanie), canonical bez zmian.
- Skutek uboczny 2: nieistniejący adres jednosegmentowy (404) przechodzi przez ISR; treść i status 404 bez zmian, ale tytuł
  w HTML jest wstawiony od razu, a nie strumieniowany.

Dlaczego nie filtrowanie po stronie przeglądarki: lista z filtrami jest dziś treścią HTML (noindex), a paginacja jest
indeksowana; przeniesienie do JS zmieniłoby to, co widzą roboty, i wymagałoby przepisania komponentów listy.

## 5. Weryfikacja

- Lokalny PostgreSQL 16 (`127.0.0.1:54329`, baza `web`): migracja 0022 nałożona dwa razy (idempotentna).
- Porównanie HTML przed i po (32 adresy, w tym 4 widoki filtrów miasta, profile, ranking, strony informacyjne, mapy
  strony, robots, llms, manifest, 404; tabela `listing_premium` pusta). Po normalizacji (identyfikator budowy, hashe,
  paczki JS, ładunek RSC): bez różnic w HTML poza:
  - `/nie-ma-takiej-strony` (404): tytuł wstawiony od razu zamiast strumieniowania (skutek ISR, punkt 4),
  - `/wyroznienia-2026`: niedeterministyczny odnośnik `preload` obrazka (różni się też między dwoma pobraniami tej samej
    wersji, strona nie była zmieniana).
  Ładunek RSC różni się znacznikiem ISR i listą paczek (inny podział modułów). Profile mają jedną dodatkową paczkę JS.
- Playwright (Chromium) na `next start`: profil z opublikowanym Premium (8 sekcji z etykietą, FAQPage JSON-LD z pytaniem
  firmy), profil ze szkicem (brak sekcji, szkic nie wycieka do HTML ani JSON-LD), `/podglad/<token>` (200, noindex,
  `no-store`, baner, szkic widoczny, zły token 404, ten sam wynik co profil publiczny), strona miasta (ISR
  `s-maxage=300`, filtr "Jawny cennik" 4 z 6 biur, cel zachowuje filtr, noindex i canonical), formularz zapytania
  (wysłanie zapisuje wpis w `leads`).
- `npm run typecheck`, `npm test` (182 testy), `npm run build`: bez błędów.

## Uruchomienie na produkcji

1. Właściciel nakłada `db/migrations/0022_listing_premium.sql` rolą właściciela bazy (do tego czasu kod działa bez tabeli).
2. Scalenie gałęzi `claude/premium` do `main`.
3. Zapisy Premium: GeoTrace (osobna migracja z prawami zapisu). Link podglądu: token z `previewToken`.
4. Przycisk audytu: `NEXT_PUBLIC_GEO_AUDIT_URL` w projekcie Vercel po starcie publicznego audytu.
