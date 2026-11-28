# Zadania

Status: `[x]` zrobione, `[~]` w toku, `[ ]` do zrobienia, `[!]` zablokowane (powód w BLOCKERS.md).
Każdy agent zaczyna od tego pliku i kończy jego aktualizacją w tym samym commicie co zmiana.

## Platforma GEO

- [x] Schemat `geo`: użytkownicy, konta, pakiety z uprawnieniami w JSON, abonamenty, płatności, program partnerski
- [x] Program partnerski: link, kliknięcia, przypisanie, prowizje 20% dożywotnio, zwroty, panel partnera, wypłaty
- [x] Webhook Stripe (płatność, zwrot, obciążenie zwrotne), idempotentny
- [x] Logowanie i rejestracja firm i partnerów
- [ ] Wdrożenie: nowy projekt Vercel z katalogiem `apps/geo`, zmienne, migracja na bazie produkcyjnej, rola `geo_app`
- [!] Domena i nazwa platformy (BLOCKERS)
- [ ] Rejestr promptów i pomiarów AI (schemat `geo`: prompts, measurements, mentions, citations)
- [!] Adapter DataForSEO LLM Scraper (konto i 50 USD)
- [ ] Sprawdzenie modułu Google AI Mode w LiteScrape (mamy klucz)
- [ ] Darmowy audyt: normalizacja domeny, odczyt z rejestru firm katalogu, skan strony, prompty, pomiary, raport
- [!] Płatności: produkty i ceny w Stripe, Checkout, portal klienta (konto Stripe)
- [ ] Faktury zgodne z KSeF (wybór programu do faktur)
- [ ] Silnik uprawnień w kodzie (odczyt `plans.entitlements`, limity)
- [ ] Regulamin platformy i programu partnerskiego (prawnik)

## Katalogi

- [ ] Wielobranżowość strony: konfiguracja portalu z bazy, teksty branży z pakietu, nie z kodu
- [ ] Motywy i warianty układu per portal (decyzja: portale mają się różnić)
- [ ] Profil Premium: dodatkowe dane w tym samym rendererze, oznaczone, bez wpływu na wynik
- [ ] Powiadomienia z art. 14 RODO do firm (informacja bez reklamy)
- [ ] Druga branża: biura rachunkowe (pakiet branży, próbka 200 firm, raport jakości)

## Koszty

- [ ] Neon: profile firm renderują się przy każdym wejściu bota (formularz czyta parametry adresu), przez co baza
      pracuje stale; plus minimum mocy 1. Poprawka po raporcie zaplanowanym na 29.11.
