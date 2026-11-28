# Silnik wielu branż w stronie (apps/web)

Cel (decyzja właściciela z 28.11.2026): do 18 niezależnych portali z jednego kodu, każdy z własną terminologią branży,
tekstami, danymi strukturalnymi i własnym wyglądem, żeby portale nie wyglądały na jeden szablon. Ten dokument opisuje
krok 1: warstwa konfiguracji i przeniesienie na nią części wspólnej. Strona biur nieruchomości renderuje się dokładnie
tak jak przed zmianą (wynik porównania HTML poniżej).

## Jak działa konfiguracja portalu

| Element | Plik |
| --- | --- |
| Typ `PortalConfig`, rejestr `PORTALS`, resolver `currentPortal(host?)`, pomocniki odmiany | `apps/web/lib/portal.ts` |
| Konfiguracja portalu biur nieruchomości (wartości skopiowane 1:1 z dawnego kodu) | `apps/web/portals/nieruchomosci.ts` |
| Testy wyboru portalu i odmiany | `apps/web/tests/portal.test.ts` |
| Motyw: zmienne CSS i atrybut `data-theme` na `<html>` | `apps/web/app/globals.css`, `apps/web/app/layout.tsx` |

**Wybór portalu.** `currentPortal(host?)` sprawdza po kolei: host (jeśli podano i jest w `portal.domains`), zmienną
środowiska `PORTAL`, portal domyślny `nieruchomosci`. Nieznany slug w `PORTAL` to błąd (lepiej wywrócić budowanie niż
pokazać zły portal). Dziś wybór jest globalny dla wdrożenia (zmienna `PORTAL`), a obecny kod wywołuje `currentPortal()`
bez hosta. Wybór po domenie wymaga tylko przekazania hosta z żądania (patrz "Następne kroki").

**Co zawiera `PortalConfig`:**

- tożsamość: `slug`, `siteName` ("Ranking biur nieruchomości"), `brandName` (zapis wielkimi literami, logo i manifest),
  `shortName`, `siteUrl` (zmienna `SITE_URL` ma pierwszeństwo), `domains`, `contactEmail` (zmienna
  `NEXT_PUBLIC_CONTACT_EMAIL` ma pierwszeństwo),
- `terms`: słownik branży z odmianą: jednostka katalogu (`firm`: biuro / biura / biur oraz dopełniacz liczby
  pojedynczej "biura"), dopełniacz dziedziny (`domainGen`: "nieruchomości"), specjalista (`expert`: "pośrednik"),
  opłata (`fee`: prowizja / prowizje), nazwa rodzajowa `company` (firma / firmy / firm),
- `schema`: typ schema.org profilu firmy (`firmType`: "RealEstateAgent"), fragment identyfikatora (`profileAnchor`:
  "biuro"), wartość `content_type` w zdarzeniach reklamowych,
- `texts`: opisy serwisu (dane strukturalne, layout, manifest, llms.txt), podpis w stopce, napisy obrazka do
  udostępniania, przycisk w nagłówku, etykiety "dla firm", lista odnośników w kolumnie "Katalog" stopki, raporty
  branżowe w llms.txt,
- `themeId`: identyfikator motywu wyglądu.

**Pomocniki odmiany** (`lib/portal.ts`): `nounForm(n, rzeczownik)`, `firmPhrase("one"|"few"|"many")` ("biuro
nieruchomości" / "biura nieruchomości" / "biur nieruchomości"), `expertPhrase()` ("pośrednik nieruchomości"),
`capitalize()`. W `lib/plural.ts` liczniki `nFirmUnits` i `nFirmUnitsGen` biorą formy z konfiguracji; dawne `nBiur` i
`nBiurGen` są ich aliasami (używa ich blog i raporty, więc nic się tam nie zmieniło).

**Motyw.** Kolory i czcionki są zmiennymi CSS w bloku `:root, html[data-theme="nieruchomosci"]`. Do dotychczasowych
zmiennych doszły `--header-bg`, `--surface-alt` i `--cta-shadow` (te same wartości co wcześniej, wcześniej wpisane na
sztywno). `<html>` dostaje `data-theme` z `portal.themeId`. Kolejny portal dodaje własny blok
`html[data-theme="..."]` z tymi samymi zmiennymi, bez zmian w komponentach.

## Co już jest sterowane konfiguracją

- `lib/format.ts`: `SITE_NAME`, `SITE_URL`, `CONTACT_EMAIL`,
- `lib/seo.ts`: opis serwisu w danych strukturalnych (`SITE_DESCRIPTION`),
- `lib/meta-texts.ts`: tytuły i opisy strony głównej, miasta i profilu (teksty te same, rzeczowniki z konfiguracji),
- `app/layout.tsx`: opis, atrybut `data-theme`; `app/manifest.ts`; `app/opengraph-image.tsx` (napisy i `alt`),
- `app/llms.txt/route.ts`: opis, nazwy odnośników, raporty branżowe,
- `components/SiteChrome.tsx`: nagłówek, stopka (podpis, lista "Katalog", nazwy miast), `components/Logo.tsx`
  (etykieta dostępności),
- `lib/legal.ts`: domyślny adres kontaktowy,
- `lib/city-content.ts`: nagłówek, wstęp i pytania z nazwami biur, pośrednika i prowizji (z konfiguracji),
- `lib/firm-faq.ts`: nazwy biur i prowizji w pytaniach i odpowiedziach,
- `app/[city]/page.tsx` i `app/[city]/[firm]/page.tsx`: nazwy w danych strukturalnych (CollectionPage, ItemList,
  BreadcrumbList), typ `RealEstateAgent` jako `schema.firmType`, identyfikator `#biuro`, `content_type`,
- `lib/plural.ts`: liczniki jednostki katalogu.

## Co zostaje na sztywno (do przeniesienia w kolejnych krokach)

Treści tylko dla branży nieruchomości (zostają w kodzie, dopóki nie powstanie portal, który ich potrzebuje):

- blog: `app/blog/*` (artykuły, `okladka`, `porownanie/[pair]`), `lib/blog.ts`, `lib/blog-covers.ts`,
  `lib/blog-links.ts`, `lib/blog-stats.ts`, `lib/pair-content.ts`, `components/BlogArticle.tsx`, `BlogCharts.tsx`,
  `BlogLinks.tsx`,
- strony jednorazowe i raporty: `app/raporty/prowizje-biur-nieruchomosci-2026`, `app/poradnik/*`,
  `app/wyroznienia-2026`, `lib/awards.ts`, `components/CommissionCalculator.tsx`,
- kalkulatory i oferty nieruchomości: `app/oferty`, `components/OfferTile.tsx`, `OfferCitySelect.tsx`,
  `lib/format.ts` (`formatOfferPrice`).

Strony i moduły wspólne, w których nadal są sztywne rzeczowniki lub proza branżowa:

- strony: `app/page.tsx`, `app/ranking/page.tsx`, `app/miasta/page.tsx`, `app/metodologia/page.tsx`,
  `app/o-nas/page.tsx`, `app/dla-firm/page.tsx`, `app/reklama/page.tsx`, `app/kontakt/page.tsx`, `app/bot/page.tsx`,
  `app/porownaj/page.tsx`, `app/regulamin/page.tsx`, `app/polityka-prywatnosci/page.tsx`, `app/wlasciciel/[id]`,
  widoczne teksty w `app/[city]/page.tsx` i `app/[city]/[firm]/page.tsx` (nagłówki i akapity, poza danymi
  strukturalnymi),
- komponenty: `components/MobileNav.tsx` (komponent przeglądarkowy: odczyt konfiguracji po stronie serwera i
  przekazanie jako właściwości), `LeadForm.tsx`, `ProfileShowcase.tsx`, `TopThree.tsx`, `Compare.tsx`,
- moduły: `lib/city-content.ts` (grupy usług `SERVICE_GROUPS` oraz porady o umowie pośrednictwa i prowizji),
  `lib/ranking.ts` (opisy parametrów), `lib/sitemap.ts` (adresy poradników i raportu), `lib/lead-message.ts`,
  `lib/cities.ts`, `lib/redirects.ts`, `lib/automat-report.ts`, `lib/run-stats.ts`,
- panel `/admin` (wewnętrzny, po polsku, nazwy branży w opisach),
- logo: ścieżki SVG "RBN" (`lib/logo-paths.ts`) i grafiki w `public/` oraz `app/icon.svg`, `app/apple-icon.png`
  (każdy portal potrzebuje własnego logo i ikon),
- czcionki: import w `app/layout.tsx` (Archivo, Instrument Sans, IBM Plex Mono) jest wspólny; portal z inną
  typografią doda własne importy,
- dane operatora (`lib/legal.ts`) zostają wspólne zgodnie z decyzją właściciela (ten sam podmiot na każdym portalu).

## Weryfikacja tej zmiany

Przed zmianami zbudowano stronę i pobrano HTML 25 adresów z lokalnej bazy rozwojowej (`/`, `/wroclaw`,
`/wroclaw/zeta-invest`, `/ranking`, `/metodologia`, `/miasta`, `/sitemap.xml`, `/robots.txt`, `/llms.txt`,
`/manifest.webmanifest`, `/opengraph-image`, strony prawne i informacyjne, 404). Po zmianach to samo i porównanie po
usunięciu części zmiennych (identyfikator budowy, hashe plików JS i CSS, nonce, daty, identyfikatory modułów i klucze
elementów listy w ładunku RSC). Wynik: brak różnic. Jedyna zamierzona różnica: atrybut `data-theme="nieruchomosci"`
na `<html>`.

## Następne kroki

1. Wybór portalu po domenie: w `middleware.ts` odczytać nagłówek `Host`, wywołać `portalForHost(host)` i przekazać slug
   dalej (nagłówek żądania); komponenty serwerowe czytają go przez `headers()`. Wymaga zamiany stałych modułowych
   (`SITE_URL`, `SITE_NAME`, `SITE_DESCRIPTION`, `metadata` w layoucie) na funkcje wywoływane w żądaniu
   (`generateMetadata`), oraz osobnych map strony i `robots` na portal. Alternatywa: osobne wdrożenie Vercel na portal
   ze zmienną `PORTAL` (działa już dziś, bez zmian w kodzie).
2. Warianty motywu: dla każdego portalu blok `html[data-theme="..."]` w `globals.css` (paleta, czcionki, promienie,
   cienie) oraz własne logo, ikony i obrazek do udostępniania.
3. Warianty układu stron (nagłówek, karty firm, układ profilu, strona główna), żeby portale nie wyglądały jak jeden
   szablon: wybór komponentu po `portal.layout`, a nie tylko inne kolory.
4. Przeniesienie pozostałych tekstów (lista wyżej) do konfiguracji albo do plików treści na portal; grupy usług
   (`SERVICE_GROUPS`), opisy parametrów rankingu i porady do osobnych definicji branżowych (powiązanie z
   `packages/verticals/*`).
5. Blog i raporty: ustalić, które artykuły są wspólne dla branż, a które zostają przypisane do portalu (pole `portal`
   w rejestrze artykułów).
6. Test pilnujący, że zmiana portalu zmienia teksty (portal testowy w testach) oraz brak tekstów branżowych
   nieruchomości w stronach wspólnych.
