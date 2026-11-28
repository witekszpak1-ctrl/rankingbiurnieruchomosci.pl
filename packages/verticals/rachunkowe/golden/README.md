# Zestaw wzorcowy (golden set): biura rachunkowe

Ręcznie oznaczone dane do mierzenia jakości przed włączeniem autopublikacji. **Pliki `domains.csv` i `entities.csv` nie
istnieją i nie wolno ich wypełniać wymyślonymi danymi.** Powstają dopiero z prawdziwych wyników wyszukiwania po zgodzie
właściciela na budżet LiteScrape (zbieranie próbki to płatne zapytania, patrz `docs/geo/branza-rachunkowe.md`).

## Jak zbudować zestaw

1. Po zgodzie właściciela uruchom `katalog discover-queue --vertical rachunkowe` dla 3-5 miast o różnej wielkości
   (np. Warszawa, Wrocław, Rzeszów, Opole). Wyniki trafiają do tabel `search_results` i `domains`.
2. Z `domains` wybierz ok. 200 domen z przewagą trudnych przypadków: strony biur z listą oddziałów, katalogi
   i rankingi biur, oprogramowanie księgowe (inFakt, wFirma i podobne), blogi podatkowe, szkolenia, kancelarie podatkowe
   doradców, kancelarie prawne, rekrutacja księgowych, domeny zaparkowane.
3. Każdą domenę oznacz ręcznie w `domains.csv`: `url,label,notes`. Etykiety: `official`, `directory`, `marketplace`,
   `media`, `irrelevant`, `parked` (te same co w `prompts/classify.md`). W `notes` zaznacz doradców podatkowych
   (zawód regulowany) i biura obsługujące tylko zdalnie.
4. Do `entities.csv` (`name,city,expected_domain`) przepisz podmioty z rejestru (KRS, CEIDG, PKD 69.20.Z) z ręcznie
   potwierdzoną domeną. Zostaw kilka wierszy bez domeny (firmy bez strony), żeby zobaczyć, czy wyszukiwarka nie
   podsuwa fałszywych dopasowań. Wejście dla testu A/B dostawców: `katalog ab-search --csv entities.csv --providers brave,serper`
   (płatne, osobna zgoda).

## Co mierzymy

- Precyzja i recall klasyfikatora (`classify_page`) dla etykiety `official` oraz odsetek sporów kierowanych do Claude Code.
- Kontrola listy `blocklist` w `vertical.yaml`: które domeny z próbki trzeba dopisać.
- Kontrola słów kluczowych: czy `kadry` i `płace` nie wpuszczają stron spoza branży (np. agencje pracy).

Pliki zawierają tylko dane firmowe. Nie dodawaj danych osobowych (prywatnych adresów, telefonów).
