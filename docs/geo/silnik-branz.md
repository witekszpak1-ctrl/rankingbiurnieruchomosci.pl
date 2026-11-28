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

Strony i moduły wspólne: rzeczowniki branży są już składane z konfiguracji (sekcja "Teksty portali" niżej). Na sztywno
zostają:

- komponenty bez treści branżowej do przeniesienia: `components/TopThree.tsx`,
- moduły: `lib/sitemap.ts` (adresy poradników i raportu, tylko portal z flagą `reports`), `lib/lead-message.ts`,
  `lib/cities.ts`, `lib/redirects.ts`, `lib/automat-report.ts`, `lib/run-stats.ts`, `lib/gate.ts` (komunikaty
  wewnętrzne automatu i panelu),
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

## Krok 2: wybór portalu, zakres danych, portal rachunkowe

### Wybór portalu i domeny (decyzja i kompromis)

Źródłem prawdy na produkcji jest zmienna `PORTAL`: **jeden projekt Vercel na portal, ten sam kod, inna wartość `PORTAL`**
(oraz `SITE_URL` z domeną). Powód: profile `/[city]/[firm]` są renderowane przez ISR (`generateStaticParams` zwraca `[]`,
`revalidate = 300`). Odczyt `headers()` albo `cookies()` w stronie lub layoucie robi z niej stronę dynamiczną, czyli
wyłącza pamięć podręczną i wraca obciążenie bazy przy każdym wejściu botów. Wybór portalu po nagłówku `Host` na jednym
wdrożeniu wymagałby tego odczytu w layoucie (nazwa, metadane, motyw), więc go nie robimy. Skutek uboczny na plus: portale
są w pełni niezależnymi wdrożeniami (osobne pamięci podręczne, osobne awarie, osobne zmienne), zgodnie z decyzją
"portale mają być niezależne i różne" (`docs/ops/DECISIONS.md`).

Co zostało z wyboru po hoście: `portalForHost(host)` i `portal.domains` (testy, podglądy, praca lokalna), a
`currentPortal(host?)` daje host pierwszeństwo przed `PORTAL`. Middleware (`middleware.ts`) nie zmienia zachowania, poza
jednym: adresy funkcji wyłączonych w portalu (`isPathDisabled`) odpowiadają zwykłą stroną 404. Stałe zależne od portalu
(`SITE_URL`, `SITE_NAME`, `SITE_DESCRIPTION`, metadane layoutu) zostają stałymi modułowymi, bo wartość jest stała dla
wdrożenia. Praca lokalna: `PORTAL=rachunkowe npm run dev`.

### Zakres danych (branża)

`lib/vertical-scope.ts` (`inVertical`, `verticalIdSql`) dodaje do zapytań warunek `listings.vertical_id =
(select id from verticals where slug = portal.verticalSlug)`. Objęte: `lib/catalog.ts` (wszystkie zapytania: miasta,
listy, profil, ranking krajowy, mapa strony, raporty, oferty, statystyki, porównanie, odznaka), `app/szukaj`,
`app/api/path-status` (przekierowania i 410 dla middleware). Firma w kilku miastach liczy się w obrębie branży. Test
`tests/vertical-scope.test.ts` sprawdza, że każde zapytanie katalogu ma ten filtr, dla obu portali. Poza zakresem:
panel `/admin`, formularze po identyfikatorze wpisu (zgłoszenia, odznaki), statystyki bloga (blog jest tylko w
nieruchomościach). Tematy zapytań w formularzu to stałe klucze z ograniczenia w bazie (`leads.topic`), więc portal
rachunkowe zmienia tylko ich etykiety i gotowe wiadomości (`texts.lead`), bez zmiany schematu.

### Konfiguracja portalu, flagi i teksty

`PortalConfig` dostał: `verticalSlug`, `features` (oferty, kalkulator prowizji, blog, raporty i poradniki, wyróżnienia,
cele klienta, mediana prowizji), `catalogView` (cele i filtry), `serviceGroups` (grupy usług z wyrażeniami), `terms.phrase`
(pełne frazy z przymiotnikiem: "biura rachunkowego", celownik, miejscownik), `terms.fee.genPl`, `terms.synonym`,
`expertFull` oraz teksty wspólne: strona główna, menu (`headerNav`, `mobileNav`), formularz zapytania, zdania w
regulaminie, poradnik wyboru, pytania FAQ i zdania o cenach w miastach (`texts.city`). Wyłączona funkcja znika ze stron,
menu, mapy strony i `llms.txt`, a jej adresy dają 404. Parametr rankingu "aktualne oferty" jest pomijany w portalach bez
ofert (`PARAMETERS` w `lib/ranking.ts`).

### Motyw rachunkowe

Blok `html[data-theme="rachunkowe"]` w `app/globals.css`: paleta lodowo-granatowa z zielenią akcentu i miedzią
(kontrast opisany w komentarzu), nagłówki w kroju szeryfowym systemowym, tekst Inter (`@fontsource-variable/inter`,
importowany w `app/layout.tsx` tylko przy budowaniu z `PORTAL=rachunkowe`, przez `env` w `next.config.mjs`, więc portal
nieruchomości go nie ładuje), jasna sekcja otwierająca stronę główną zamiast ciemnej, kwadratowe rogi, znak tekstowy
"RBR" zamiast rysowanego logo (`components/Logo.tsx`).

### Jak uruchomić nowy portal

1. Pakiet branży w `packages/verticals/<slug>/` i dane w bazie (branża `verticals`, wpisy `listings` z `vertical_id`).
2. Plik `apps/web/portals/<slug>.ts` (wzór: `rachunkowe.ts`): nazwa, `verticalSlug`, frazy z odmianą, flagi `features`,
   typ schema.org, teksty; wpis w `PORTALS` (`lib/portal.ts`).
3. Motyw: blok `html[data-theme="<slug>"]` w `globals.css` (te same zmienne CSS), w razie potrzeby czcionki (warunkowy
   import w `layout.tsx` przez `PORTAL_THEME_FONTS`), własne logo i ikony (`app/icon.svg`, `app/apple-icon.png`,
   `public/icon-*.png` są dziś wspólne, to jeszcze do zrobienia per portal).
4. Projekt Vercel z tym samym repozytorium i katalogiem `apps/web`, zmienne: `PORTAL=<slug>`, `SITE_URL=https://domena`,
   `DATABASE_URL`, `ADMIN_*`, `NEXT_PUBLIC_CONTACT_EMAIL`. Domena w projekcie, adres w `portal.domains` i `siteUrl`.
5. Sprawdzenie: `PORTAL=<slug> npm run build`, test z `tests/portal.test.ts` i `tests/vertical-scope.test.ts`.

### Weryfikacja kroku 2

Przed zmianami i po nich pobrano HTML 31 adresów portalu nieruchomości (lokalna baza rozwojowa, strona główna, miasta,
profile, ranking, metodologia, strony prawne, blog, mapa strony, robots, llms, manifest, obrazek OG, 404). Po
normalizacji (identyfikator budowy, hashe, daty, podział węzłów tekstu, kolejność metadanych i strumienia) wynik: brak
różnic w HTML. Zamierzone różnice poza HTML: w ładunku RSC nowe właściwości `MobileNav` (menu z konfiguracji) i
`ProfileStickyCta` (etykieta), parametr hasha obrazka OG. Portal rachunkowe na tej samej bazie (bez wpisów tej branży):
wszystkie strony odpowiadają bez błędów, puste stany, adresy ofert, bloga, raportów i wyróżnień dają 404, w widocznych
tekstach brak słów branży nieruchomości (poza ogólnym "oferty" w sensie prawnym w regulaminie).

## Następne kroki

1. Logo i ikony per portal, obrazek do udostępniania per portal.
2. Wagi rankingu per branża (`ranking.weights` z `vertical.yaml`) zamiast wspólnej listy parametrów.
3. Warianty układu stron (nagłówek, karty firm, układ profilu), żeby portale różniły się nie tylko kolorami.
4. Pozostałe teksty branżowe (blog, raporty, poradniki) przypisać do portalu (pole `portal` w rejestrze artykułów).
5. Test pilnujący brak tekstów drugiej branży: zrobiony (`tests/portal-copy.test.ts`, `scripts/check-portal-html.mjs`).

## Teksty portali (poprawka z 28.11.2026)

Powód: na portalach innych niż nieruchomości widać było teksty o biurach i pośrednikach ("Dobre biuro w trzech krokach"
na stronie kliniki weterynaryjnej, "Prowadzisz klinika weterynaryjna?" w złej odmianie). Teraz każdy tekst wspólnych stron
jest składany z konfiguracji portalu albo wprost z niej czytany.

### Pola dodane do `PortalConfig`

| Pole | Co zawiera |
| --- | --- |
| `terms.unit` | pełna odmiana jednostki katalogu przez 6 przypadków w liczbie pojedynczej i mnogiej (`sg.nom/gen/dat/acc/ins/loc`, `pl.*`) oraz rodzaj (`gender`: m / f / n): biuro, firma, warsztat, klinika |
| `terms.phrase.accOne` | biernik frazy: "biuro nieruchomości", "firmę remontową", "klinikę weterynaryjną" ("Wybierz ...", "Prowadzisz ...?") |
| `texts.homeStepsHeading` | nagłówek sekcji "Jak to działa", np. "Dobra klinika weterynaryjna w trzech krokach" |
| `texts.homeSteps` | trzy kroki prawdziwej drogi klienta w branży (każdy portal ma własne) |
| `texts.homeFaq` | pytania i odpowiedzi strony głównej (te same trafiają do danych strukturalnych FAQPage) |
| `texts.homeOrder` | kolejność sekcji strony głównej (`steps`, `ranking`, `cities`), różna w portalach |
| `texts.methodologyNote` | opcjonalny akapit na końcu metodologii (weterynarze: ranking nie ocenia jakości leczenia) |

W fabryce `portals/service-portal.ts` doszły pola specyfikacji `homeStepsHeading`, `homeSteps`, `homeOrder`,
`extraFaq` i `methodologyNote`; `homeFaq` jest składane z odmiany jednostki (`homeFaq()`), więc pytania są takie
same w każdej branży, a odmiana poprawna. Wartości portalu nieruchomości to dotychczasowe napisy (HTML bez zmian).

### Jak składać zdania: `lib/unit.ts`

`unitForms(portal?)` zwraca formy jednostki katalogu bieżącego portalu: `sg` / `pl` (przypadki), `Sg` / `Pl` (te same
wielką literą, do pojęć zdefiniowanych w regulaminie: "Biuro", "Biurem"), `by(n, f, m)` (wybór formy według rodzaju),
zaimki `this` ("to / ta / ten", przypadki), `chosenAcc` ("wybrane / wybraną / wybrany"), `which` ("Które / Która /
Który"), `checkedAcc`, `none`, `his`, `forFirms` i `forFirmsLc` ("Dla biur" / "dla biur"). Zasady:

- zdanie ze słowem "biuro" piszemy jako szablon `${u.sg.gen}`, `${u.pl.nom}` itd. i zawsze jako jeden napis na cały
  węzeł tekstu JSX (żeby HTML portalu nieruchomości nie zyskał dodatkowych węzłów tekstu),
- przymiotnik lub zaimek przy jednostce bierzemy z `u.by(...)` albo `u.this` (nie wolno pisać "potwierdzone" na sztywno),
- komponent przeglądarkowy (`"use client"`) nie zna portalu (`process.env.PORTAL` nie jest w paczce), więc teksty
  dostaje we właściwościach z serwera (`Compare`: `maxTitle`, `param`, `label`, `needMore`; `ProfileShowcase`:
  `ctaLabel`; `LeadFormStatus`: `sentText`),
- adres porównania ma parametr o nazwie jednostki w liczbie mnogiej (`?biura=`, `?firmy=`, `?warsztaty=`, `?kliniki=`).

### Gdzie które teksty

- strony: `app/page.tsx`, `ranking`, `miasta`, `metodologia`, `o-nas`, `dla-firm`, `kontakt`, `reklama`, `regulamin`,
  `polityka-prywatnosci`, `porownaj`, `wlasciciel/[id]`, `llms.txt` używają `unitForms()` i pól `texts.*`,
- komponenty: `CityView`, `FirmProfile`, `LeadForm`, `LeadFormStatus`, `ProfileShowcase`, `Compare`, `LegalOperator`,
- moduły: `lib/city-content.ts`, `lib/firm-faq.ts`, `lib/meta-texts.ts`, `lib/ranking.ts` (opisy parametrów i
  historia metodologii), `lib/path-status.ts` (strona 410),
- teksty tylko dla portalu z ofertami, prowizjami, blogiem (flagi `features`) zostają w kodzie wspólnym, bo ukryta funkcja
  znika ze stron (np. "Oferty nieruchomości" w regulaminie, metodologii i na profilu).

### Treść per portal

- rachunkowe (biuro rachunkowe: "biuro" jest tu poprawne): kroki o rodzaju księgowości (księga przychodów i rozchodów,
  ryczałt, pełna księgowość, kadry i płace), abonament, umowa o obsługę,
- oze (firma instalacyjna): fotowoltaika, pompy ciepła, klimatyzacja, magazyny energii, wycena po opisie budynku,
- remonty (firma remontowa i wykończeniowa): zakres prac, stawki za robociznę lub metr kwadratowy, wycena na piśmie,
- budowlane (firma budowlana, generalny wykonawca): stan surowy, deweloperski, dom pod klucz, harmonogram,
- warsztaty (warsztat samochodowy): usterka, stawka robocizny, kosztorys przed naprawą,
- przeprowadzki (firma przeprowadzkowa): trasa, termin i zakres, cennik i wycena; przeprowadzki "domowe" i "firmowe"
  (bez słów o mieszkaniach i biurach),
- weterynarze (klinika weterynaryjna): znajdź klinikę, sprawdź zakres usług, cenę wizyty i opinie, zadzwoń lub umów
  wizytę; pytanie w FAQ i akapit w metodologii, że ranking nie ocenia jakości leczenia (uwaga prawna z
  `docs/geo/branze-3-8.md`), a w nagłym przypadku trzeba dzwonić do placówki.

### Testy i kontrola

- `tests/portal-copy.test.ts`: dla każdego portalu poza nieruchomościami napisy konfiguracji, funkcje tekstowe
  (wiadomości formularza, poradnik miasta, FAQ, ceny) i funkcje składające teksty stron (`city-content`, `firm-faq`,
  `meta-texts`, `ranking`, `path-status`) z przykładowymi danymi nie mogą zawierać "nieruchomoś", "mieszka", "pośredni"
  (jako początek wyrazu, "bezpośrednio" nie jest trafieniem), "agencj" ani "biur" (poza portalem rachunkowe); test
  pilnuje też zgodności odmiany z formami po liczebniku i że portal nieruchomości ma swoje dotychczasowe napisy,
- `scripts/check-portal-html.mjs <adres serwera> <slug>`: pobiera ze zbudowanego i uruchomionego portalu stronę główną,
  miasta, listę miast, profil firmy, dla firm, metodologię, o nas, kontakt, regulamin, politykę prywatności, ranking,
  llms.txt i manifest i szuka tych samych słów w widocznym tekście (adresy pomija); kod wyjścia 1 przy trafieniu.

### Weryfikacja (28.11.2026)

Portal nieruchomości: HTML 32 adresów (strona główna, miasta, profile, ranking, metodologia, strony prawne, blog, oferty,
wyróżnienia, mapa strony, robots, llms, manifest, obrazek OG, 404) przed zmianą i po niej, po normalizacji (identyfikator
budowy, hashe, daty, komentarze podziału węzłów, adres hosta): bez różnic w 31 adresach; w `/wyroznienia-2026` różni się
tylko kolejność strumienia (podpowiedź preload obrazka zamiast bloku Suspense), strona nie była zmieniana. Pozostałe
siedem portali: zbudowane z `PORTAL=<slug>` na lokalnej bazie z danymi dev przemianowanymi na neutralne nazwy firm i
usług, 22 adresy każdy, brak trafień zakazanych słów w widocznym tekście. Zrzuty strony głównej 1440 i 390 px każdego
portalu sprawdzone, bez przewijania poziomego.
