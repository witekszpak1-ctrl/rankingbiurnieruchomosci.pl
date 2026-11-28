# Decyzje

Jedno źródło prawdy dla agentów. Nowa decyzja na górze, z datą i źródłem.

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
