# Zadania

Status: `[x]` zrobione, `[~]` w toku, `[ ]` do zrobienia, `[!]` zablokowane (powód w BLOCKERS.md).
Każdy agent zaczyna od tego pliku i kończy jego aktualizacją w tym samym commicie co zmiana.

## Platforma GEO

- [x] Schemat `geo`: użytkownicy, konta, pakiety z uprawnieniami w JSON, abonamenty, płatności, program partnerski
- [x] Program partnerski: link, kliknięcia, przypisanie, prowizje 20% dożywotnio, zwroty, panel partnera, wypłaty
- [x] Webhook Stripe (płatność, zwrot, obciążenie zwrotne), idempotentny
- [x] Logowanie i rejestracja firm i partnerów
- [x] Wdrożenie: projekt Vercel `geotrace` (katalog `apps/geo`, region fra1, prywatny do czasu domeny,
      adres https://geotrace-witek1.vercel.app), schemat `geo` 0001-0003 na bazie produkcyjnej, rola `geo_app`
- [ ] Pierwsze konto administratora GeoTrace (właściciel zakłada konto, potem `is_admin = true`)
- [x] Nazwa robocza GeoTrace (geotrace.pl wolna 28.11, niekupiona)
- [x] Rejestr pytań i pomiarów AI (`db/geo/0002_measurements.sql`), klucz pamięci podręcznej i wskaźniki z przedziałem niepewności (`apps/geo/lib/measure.ts`)
- [!] Adapter DataForSEO LLM Scraper (konto i 50 USD)
- [x] Test LiteScrape (28.11, 14 zapytań): Gemini, Google AI Mode i AI Overview działają po polsku (raport
      `queue/results/reports/ai-check-2026-11-28T0453.json` w repozytorium kolejki). ChatGPT w LiteScrape nie ma.
- [x] Adapter pomiarów LiteScrape (Gemini, AI Mode, AI Overview) zapisujący do geo.measurements, mentions, citations:
      `katalog geo-measure --cities N --platforms gemini,google_ai_mode,google_ai_overview --per-city-prompts K --max-calls M
      --max-age-days 7 --save-raw KATALOG --dry-run` (`apps/worker/katalog_worker/geo_measure.py`). Płatne: twardy limit 50 zapytań,
      domyślnie 20; świeży pomiar (ten sam klucz pamięci co w `apps/geo/lib/measure.ts`) jest używany ponownie. Nie uruchamiany
      automatycznie w CI. Parsery tolerancyjne - kształt `text_blocks`, `references`, `ai_overview` do potwierdzenia na żywo (`--save-raw`).
- [ ] Dokładny koszt zapytań AI w LiteScrape (pole `billed` w odpowiedzi, saldo w /admin/koszty)
- [ ] Darmowy audyt: normalizacja domeny, odczyt z rejestru firm katalogu, skan strony, prompty, pomiary, raport
- [!] Płatności: produkty i ceny w Stripe, Checkout, portal klienta (właściciel na razie nie ma konta Stripe)
- [ ] Faktury zgodne z KSeF (wybór programu do faktur)
- [x] Silnik uprawnień (`apps/geo/lib/entitlements.ts`): limity z `plans.entitlements`, powrót do Free przy zaległości
- [ ] Regulamin platformy i programu partnerskiego (prawnik)

## Katalogi

- [x] Opinie Google na profilach: tylko ocena, liczba i link (wdrożone 28.11)
- [ ] Przycisk "sprawdź widoczność w AI" na profilach (gdy audyt GeoTrace będzie działał publicznie)
- [!] DNS rankingbiurnieruchomosci.pl do Cloudflare (właściciel: dodanie strony w Cloudflare i zmiana serwerów DNS w aftermarket.pl)

- [ ] Wielobranżowość strony: konfiguracja portalu z bazy, teksty branży z pakietu, nie z kodu
- [ ] Motywy i warianty układu per portal (decyzja: portale mają się różnić)
- [ ] Profil Premium: dodatkowe dane w tym samym rendererze, oznaczone, bez wpływu na wynik
- [ ] Powiadomienia z art. 14 RODO do firm (informacja bez reklamy)
- [~] Silnik wielu branż w stronie (apps/web): branża, nazwy, teksty, dane strukturalne i wygląd z konfiguracji
  - krok 1 zrobiony: konfiguracja portalu (`lib/portal.ts`, `portals/nieruchomosci.ts`), część wspólna (nazwa, adres, meta, llms, manifest, stopka, dane strukturalne, motyw `data-theme`) na konfiguracji, bez zmiany wyglądu; zostaje wybór po domenie, motywy i układy per portal, reszta tekstów (`docs/geo/silnik-branz.md`)
- [x] Pakiet branży biura rachunkowe (packages/verticals/rachunkowe): konfiguracja, prompty, miasta (28.11; blokery: docs/geo/branza-rachunkowe.md)
- [ ] Robot wielobranżowy: branża przy domenie (powiązanie przez search_queries.vertical_id albo nowa kolumna
      domains.vertical_id po decyzji), osobna kolejka miast dla każdej branży, przekazywanie --vertical w workflow,
      eksport promptu z panelu dla każdej branży (szczegóły: docs/geo/branza-rachunkowe.md)
- [ ] Silnik wielu branż, krok 2: wybór portalu po domenie (middleware, stałe zamienione na funkcje), reszta tekstów
      ze stron, motyw i wariant układu dla portalu biur rachunkowych (docs/geo/silnik-branz.md)
- [!] Próbka 200 biur rachunkowych i raport jakości (zgoda na budżet LiteScrape, zapytano o 2 USD)
- [!] Domena portalu biur rachunkowych (właściciel)
- [ ] Kolejne branże według tabeli w DECISIONS.md (nr 3-18), po jednej, każda przez bramkę jakości

## Koszty

- [x] Neon: profile firm w pamięci podręcznej (ISR, wdrożone 28.11); minimum mocy 0,25 (inna sesja, 27.11)
- [ ] Neon: strony miast nadal renderują się przy każdym wejściu (filtry w parametrach adresu); ocenić po raporcie zużycia z 29.11
