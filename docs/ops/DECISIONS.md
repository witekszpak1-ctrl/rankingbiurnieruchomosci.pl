# Decyzje

Jedno źródło prawdy dla agentów. Nowa decyzja na górze, z datą i źródłem.

## 28.11.2026 (właściciel: budżety)

- Pomiary widoczności w AI (LiteScrape: Gemini, Google AI Mode, AI Overview): bez limitu budżetu. Technicznie bezpiecznik
  1000 zapytań na jeden przebieg. Monitoring co tydzień: 20 największych miast, 3 pytania, 3 platformy.
- Próbka biur rachunkowych: budżet do 2 USD w LiteScrape, po naprawie robota pod wiele branż i teście na jednym mieście.

## 28.11.2026 (właściciel: wszystkie 20 branż po kolei)

Kolejność portali (20 branż z briefu w 18 portalach; fotowoltaika, pompy ciepła i klimatyzacja to jeden portal, decyzja z pkt 2):

| Nr | Portal | Uwagi |
|---|---|---|
| 1 | Biura nieruchomości | działa |
| 2 | Biura rachunkowe | PKD 69.20.Z, jawne cenniki |
| 3 | Fotowoltaika, pompy ciepła i klimatyzacja | jeden portal z kategoriami |
| 4 | Firmy remontowe i wykończeniowe | |
| 5 | Firmy budowlane (domy) | |
| 6 | Warsztaty samochodowe | |
| 7 | Firmy przeprowadzkowe | |
| 8 | Kliniki weterynaryjne | |
| 9 | Architekci | |
| 10 | Projektanci wnętrz | |
| 11 | Firmy instalacyjne (hydraulika, elektryka) | |
| 12 | Agencje marketingowe | |
| 13 | Firmy informatyczne | |
| 14 | Dentyści i kliniki stomatologiczne | po opinii prawnej (reklama lekarzy), bez nagrań sesji |
| 15 | Medycyna estetyczna | po opinii prawnej |
| 16 | Kancelarie prawne | po opinii prawnej (zakaz reklamy adwokatów i radców) |
| 17 | Firmy transportowe | słabe dopasowanie do lokalnego katalogu, na koniec |
| 18 | Ubezpieczenia | jak wyżej |

Zasada: każdy portal przechodzi bramkę jakości (próbka firm, raport, przegląd) przed publikacją. Silnik wielu branż
w kodzie strony jest warunkiem portalu nr 2. Zbieranie firm każdej branży to płatne zapytania LiteScrape:
budżet na branżę wymaga zgody właściciela. Domeny kupuje właściciel.

## 28.11.2026 (pomiar AI po teście LiteScrape)

- Gemini, Google AI Mode i Google AI Overview mierzymy przez LiteScrape (już opłacany, odpowiedzi po polsku,
  AI Mode i AI Overview z cytowanymi źródłami, Gemini sam tekst). ChatGPT: później przez DataForSEO albo innego
  dostawcę (pkt 13). Test: 12 udanych zapytań, 4-19 s na odpowiedź.

## 28.11.2026 (właściciel, odpowiedzi na pytania 1-20 z raportu)

| Nr | Pytanie | Decyzja |
|---|---|---|
| 1 | Najpierw GEO sprzedawane biurom nieruchomości, portale stopniowo | tak |
| 2 | Pierwsze nowe branże: biura rachunkowe, OZE i klimatyzacja (jeden portal) | tak |
| 3 | Pakiety Free, Monitor 99 zł, Growth 299 zł, Agency od 790 zł, raport jednorazowy | tak |
| 4 | Nazwa platformy | robocza: GeoTrace, geotrace.pl (domena wolna 28.11, niekupiona) |
| 5 | Opinie Google na profilach | tylko ocena, liczba i link (wdrożone 28.11) |
| 6 | Kanał sprzedaży | przycisk audytu na profilach |
| 7 | Serwer OVH | właściciel kupi wkrótce; do tego czasu Vercel + Neon |
| 8 | DNS do Cloudflare | przenieść |
| 9 | Dane firmy i faktury | na razie odłożone |
| 10 | Stripe | na razie brak konta |
| 11 | Google Search Console | później |
| 12 | Praca w obecnym repozytorium | tak |
| 13 | DataForSEO | później |
| 14 | Klucz API modelu AI | jest (do podania przez bezpieczny formularz środowiska, gdy będzie potrzebny) |
| 15 | LiteScrape i Serper | konta są |
| 16 | Konsultacja prawna | ok |
| 17 | Poprawka kosztów Neona | tak (profile ISR wdrożone 28.11; minimum mocy 0,25 ustawiła wcześniej inna sesja) |
| 18 | Przełączenie produkcji na serwer tylko za zgodą | tak |
| 19 | Modele | Sonnet jako podstawa agentów, Opus tylko gdy konieczne, bez Fable |
| 20 | Tryb autonomiczny z raportem | tak |

## 28.11.2026 (właściciel, wcześniej)

1. **Bez VPS na razie.** Budujemy na obecnej infrastrukturze: Vercel + Neon. Migracja na serwer odłożona.
2. **Program partnerski w platformie GEO od razu:** każdy generuje link, 20% dożywotnio od pieniędzy wydanych przez
   poleconego klienta. Szczegóły: `docs/geo/program-partnerski.md`.
3. **20 portali ma być niezależnych i różnych**, także wyglądem i szablonem, żeby nie wyglądały na jedną stronę.
   Realizacja: wspólny silnik danych, ale osobne motywy i warianty układu stron dla każdego portalu, osobne marki,
   brak automatycznego linkowania między portalami. Dane operatora w regulaminie i polityce prywatności zostają
   zgodne z prawem (to samo podmiot na każdym portalu), tego nie ukrywamy.
4. **Profil Premium tylko odsłania więcej danych** i nie wpływa na wynik w rankingu. Punktacja nie ma dostępu
   do informacji o płatnościach; treści od firmy są oznaczone.
5. **Popyt:** właściciel wierzy w popyt, nie czekamy z budową na test sprzedaży.
6. **Kontakt z firmami:** krótka wiadomość informacyjna, bez pytań. Forma zgodna z prawem: powiadomienie z art. 14 RODO
   (firma jest w katalogu, skąd mamy dane, jak poprawić lub usunąć profil), bez treści reklamowej. Link do profilu jest
   dozwolony; zachęta do zakupu w e-mailu nie (Prawo komunikacji elektronicznej wymaga zgody także od firm).
7. **Pomiar widoczności AI jak najtaniej.** Plan: DataForSEO LLM Scraper w kolejce standardowej (prawdziwe odpowiedzi
   ChatGPT i Gemini, ok. 1,2 USD za 1 000), współdzielenie pomiarów między klientami, sprawdzenie modułu AI Mode
   w posiadanym LiteScrape. Nie używamy darmowego Gemini API do produktu (warunki zabraniają analizy wyników).

## 28.11.2026 (architektura, koordynator)

- Platforma GEO to osobna aplikacja `apps/geo` w tym samym repozytorium, dane w schemacie `geo` tej samej bazy,
  osobna rola `geo_app`. Migracje `db/geo/` stosuje `apps/geo/scripts/migrate.mjs`, nie `katalog migrate`
  (żeby automat katalogu nie próbował DDL bez uprawnień).
- Kwoty w groszach (bigint), waluta PLN. Płatności przez Stripe, webhook bez SDK (własna weryfikacja podpisu).
- Hasła: scrypt (ten sam format co panel katalogu), sesja: podpisane ciasteczko HMAC, 30 dni.
