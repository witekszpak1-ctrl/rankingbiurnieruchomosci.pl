# Zadania

Status: `[x]` zrobione, `[~]` w toku, `[ ]` do zrobienia, `[!]` zablokowane (powód w BLOCKERS.md).
Każdy agent zaczyna od tego pliku i kończy jego aktualizacją w tym samym commicie co zmiana.

## Platforma GEO

- [x] Schemat `geo`: użytkownicy, konta, pakiety z uprawnieniami w JSON, abonamenty, płatności, program partnerski
- [x] Program partnerski: link, kliknięcia, przypisanie, prowizje 20% dożywotnio, zwroty, panel partnera, wypłaty
- [x] Webhook Stripe (płatność, zwrot, obciążenie zwrotne), idempotentny
- [x] Logowanie i rejestracja firm i partnerów
- [ ] Wdrożenie: nowy projekt Vercel z katalogiem `apps/geo`, zmienne, migracja na bazie produkcyjnej, rola `geo_app`
- [x] Nazwa robocza GeoTrace (geotrace.pl wolna 28.11, niekupiona)
- [x] Rejestr pytań i pomiarów AI (`db/geo/0002_measurements.sql`), klucz pamięci podręcznej i wskaźniki z przedziałem niepewności (`apps/geo/lib/measure.ts`)
- [!] Adapter DataForSEO LLM Scraper (konto i 50 USD)
- [ ] Sprawdzenie modułu Google AI Mode w LiteScrape (mamy klucz)
- [ ] Darmowy audyt: normalizacja domeny, odczyt z rejestru firm katalogu, skan strony, prompty, pomiary, raport
- [!] Płatności: produkty i ceny w Stripe, Checkout, portal klienta (właściciel na razie nie ma konta Stripe)
- [ ] Faktury zgodne z KSeF (wybór programu do faktur)
- [ ] Silnik uprawnień w kodzie (odczyt `plans.entitlements`, limity)
- [ ] Regulamin platformy i programu partnerskiego (prawnik)

## Katalogi

- [x] Opinie Google na profilach: tylko ocena, liczba i link (wdrożone 28.11)
- [ ] Przycisk "sprawdź widoczność w AI" na profilach (gdy audyt GeoTrace będzie działał publicznie)
- [!] DNS rankingbiurnieruchomosci.pl do Cloudflare (właściciel: dodanie strony w Cloudflare i zmiana serwerów DNS w aftermarket.pl)

- [ ] Wielobranżowość strony: konfiguracja portalu z bazy, teksty branży z pakietu, nie z kodu
- [ ] Motywy i warianty układu per portal (decyzja: portale mają się różnić)
- [ ] Profil Premium: dodatkowe dane w tym samym rendererze, oznaczone, bez wpływu na wynik
- [ ] Powiadomienia z art. 14 RODO do firm (informacja bez reklamy)
- [ ] Druga branża: biura rachunkowe (pakiet branży, próbka 200 firm, raport jakości)

## Koszty

- [x] Neon: profile firm w pamięci podręcznej (ISR, wdrożone 28.11); minimum mocy 0,25 (inna sesja, 27.11)
- [ ] Neon: strony miast nadal renderują się przy każdym wejściu (filtry w parametrach adresu); ocenić po raporcie zużycia z 29.11
