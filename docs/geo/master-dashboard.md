# Master Dashboard (`apps/geo`, `/admin`)

Jedno centralne miejsce właściciela: portale, wspólny rejestr firm, robot danych, pomiary AI i biznes GeoTrace.
Zbudowane w istniejącej administracji i powłoce z paskiem bocznym (system wyglądu: `docs/geo/wyglad.md`). Wszystkie strony:
`requireAdmin`, `Cache-Control: private, no-store`, bez danych osobowych, bez płatnych zapytań (tylko odczyt z bazy).

## Migracja `db/geo/0005_master_dashboard.sql` (rola właściciela bazy)

Zastosowanie: `GEO_MIGRATE_URL=<właściciel> npm run migrate` w `apps/geo`. Idempotentna. Wymaga też kolumny `domains.vertical_id` (`db/migrations/0021_multi_vertical.sql`).
Strony bez migracji pokazują komunikat zamiast błędu.

- `geo.portals`: slug, nazwa, adres, domena, projekt Vercel, status (`live`, `private`, `planned`), notatki, kolejność. 8 portali + 10 planowanych
  z tabeli w `docs/ops/DECISIONS.md` (nr 9-18). `geo_app`: select i update.
- Widoki w schemacie `geo`, należące do roli migracji (wykonują się z jej prawami); `geo_app` ma `select` tylko na widokach:
  `v_portal_stats`, `v_portal_cities`, `v_domains_daily`, `v_pipeline_runs`, `v_search_daily`, `v_api_usage`, `v_api_limits`,
  `v_traffic_daily`, `v_referrers_30d`, `v_leads_daily` (sama liczba, bez danych osobowych), `v_requests_count`, `v_claims_count`.
- `geo_app` nadal nie czyta `public.settings` (klucz LiteScrape), `page_views` ani `leads`. `v_api_usage` i `v_api_limits` czytają z `settings`
  wyłącznie klucz `api_usage`.
- `page_views` nie ma kolumny z hostem, więc cały ruch to portal nieruchomości (opisane na stronie `/admin/ruch`).
  Zapytania wyszukiwania bez branży (sprzed wielobranżowości) liczone jako nieruchomości.

## Nawigacja

Pulpit (Przegląd całości), Portale (Wszystkie portale; na stronach portali także lista portali), Dane (Robot i kolejki, Koszty API),
Widoczność AI (Przegląd AI, Pomiary, Źródła, Firmy w odpowiedziach), Ruch (Ruch i boty), Biznes (Użytkownicy, Partnerzy, Lista oczekujących).
Dawny przegląd pomiarów przeniesiono do `/admin/ai`.

## Strony

| Adres | Zawartość |
|---|---|
| `/admin` | kafle: portale (działa/prywatne/planowane), firmy, opublikowane profile, domeny wg statusu, odpowiedzi AI i ostatni pomiar, cytowania naszych portali, użytkownicy/konta/pakiety, partnerzy, lista oczekujących, zapytania klientów 30 dni, ludzie i boty 30 dni, boty AI 7 dni, LiteScrape w miesiącu z szacunkiem kosztu, kolejka robota, tabela ostatniego przebiegu każdego etapu z wiekiem; karta "Wymaga uwagi" |
| `/admin/portale` | tabela wszystkich portali (status, adres, domena lub "brak domeny", opublikowane firmy, miasta, domeny, ostatnia aktualizacja danych, linki Vercel `https://vercel.com/witek1/<projekt>` i portal) oraz edycja domeny, statusu i notatek |
| `/admin/portale/[slug]` | profile wg miast (15), domeny wg statusu (kołowy), nowe domeny dziennie z 30 dni, pomiary AI branży (`geo.prompts.industry = slug`), najczęściej wymieniane firmy i cytowania naszego portalu |
| `/admin/robot` | przebiegi z 7 dni z filtrami (`etap`, `status`, `branza`), błędy z treścią, wyszukiwania na dzień per dostawca, kolejki per branża |
| `/admin/koszty` | zużycie API wg miesięcy i rodzajów, szacunek USD dla LiteScrape, inni dostawcy jako liczby, odnośniki do paneli Neon i Vercel |
| `/admin/ruch` | ludzie i boty na dzień (30 dni), najczęstsze boty 7 dni (boty AI oznaczone), źródła wejść 30 dni, unikalni odwiedzający |

## Jak liczymy

- Koszt LiteScrape: 0,15 USD za 1000 zapytań (licznik `litescrape`; bez niego suma podliczników `litescrape:*`). To szacunek, saldo sprawdzamy u dostawcy.
- Kolejka robota: "do sprawdzenia strony" = domena klasy `unknown` i status `candidate`; "do weryfikacji" = `official` lub `uncertain` i `candidate`.
- Unikalni odwiedzający: suma dziennych liczb (sól skrótu zmienia się co dobę, więc dni się nie łączą).
- Boty AI: OAI-SearchBot, ChatGPT-User, GPTBot (OpenAI), Claude/Anthropic, Perplexity (`aiBotGroup` w `lib/master.ts`).

## Alerty "Wymaga uwagi" (`buildAlerts` w `lib/master.ts`)

Nieudane przebiegi z 24 godzin; etap bez przebiegu ponad 26 godzin (etapy nieuruchomione od ponad 7 dni uznajemy za ręczne i pomijamy);
nieudane pomiary AI z 48 godzin (503 podnosi ważność); ostatni pomiar starszy niż 8 dni albo brak pomiarów; portale działające i prywatne bez danych;
portale prywatne bez domeny.

## Kod i testy

`lib/master.ts` (czyste funkcje, testy `tests/master.test.ts`), `lib/master-repo.ts` (zapytania na widokach, jedyny zapis: `updatePortal`),
`app/admin/*`. Sprawdzenie: lokalny PostgreSQL 16 z migracjami, danymi dev i przykładowymi przebiegami, ruchem, `api_usage`; `geo_app` nie czyta
`public.settings`, czyta `geo.v_api_usage`.
