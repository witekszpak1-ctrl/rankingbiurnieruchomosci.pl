# Platforma katalogów firm pod wyszukiwarki AI: plan wdrożenia

Status: wersja robocza 2 z 10.11.2026. Nazwa robocza projektu: "katalog". Pierwsza branża: biura nieruchomości, cała Polska w rozbiciu na miasta, domena rankingbiurnieruchomosci.pl (pisownia do potwierdzenia, patrz sekcja 18). Kolejne branże dodawane jako konfiguracja, każda na własnej domenie.

Uwaga o pewności: liczby kosztów, czasu i progów jakości to szacunki lub propozycje do zmierzenia na pilocie. Rzeczy, których nie zweryfikowałem, są wypisane w sekcji 19.

---

## 0. Zasady nadrzędne

1. Do katalogu trafiają tylko firmy ze zweryfikowaną oficjalną stroną (zgodność NIP ze strony z rejestrem i domeną).
2. Każdy fakt ma źródło, dosłowny cytat, datę obserwacji i metodę wydobycia.
3. Unikalność to dane, nie słowa. Strona firmy jest publikowana dopiero po przejściu bramki jakości (minimalna liczba zweryfikowanych faktów).
4. Płatność nigdy nie zmienia pozycji w rankingu organicznym. Reklama jest w osobnym, oznaczonym slocie.
5. Branża to konfiguracja (vertical pack), nie kod. Każda branża ma własną domenę, a wspólny kod obsługuje je po hoście.
6. Szanujemy robots.txt, limity zapytań i RODO (informowanie z art. 14, korekta, usunięcie).
7. Najpierw pomiar, potem skala. Między fazami są bramki z kryteriami.

---

## 1. Architektura

```
 Rejestry (CEIDG, KRS, REGON)        Search API (Brave / Serper, wymienny adapter)
              \                         /
               v                       v
      WORKER (Python): discovery -> weryfikacja domeny -> crawl -> ekstrakcja deterministyczna
                              |
                              v
                        POSTGRES (źródło prawdy)  <----->  KOLEJKA PLIKÓW (prywatne repo)
                         ^     ^      ^                         |
                         |     |      |                         v
                         |     |      |              CLAUDE CODE (worker LLM):
                         |     |      |              spory + opisy + normalizacja cen
                         |     |      |                         |
                         |     |      +------ walidator + import <+
                         |     |
           PANEL ADMINA (Next.js, /admin)      STRONA PUBLICZNA (Next.js, SSG/ISR)
                         |                                |
                  leady, reklamy, statystyki      odwiedzający, boty AI, leady
```

Podział odpowiedzialności:
- **Worker** robi wszystko, co da się zrobić deterministycznie i bez LLM.
- **Claude Code** dostaje gotowe paczki faktów i zwraca werdykty oraz opisy. Nie ma dostępu do e-maili firm (minimalizacja danych).
- **Walidator w kodzie** decyduje, czy wynik z Claude Code można zaimportować.
- **Admin** jest miejscem, w którym człowiek rozstrzyga to, czego nie rozstrzygnęły reguły.

---

## 2. Stack i decyzje techniczne

| Warstwa | Wybór | Uzasadnienie |
|---|---|---|
| Strona publiczna i admin | Next.js (App Router), jedna aplikacja, admin pod `/admin` | HTML renderowany po stronie serwera dla botów, jedno repo, wspólne typy |
| Baza | PostgreSQL (Supabase lub Neon) | Supabase daje auth, storage i Table Editor jako awaryjny panel |
| Migracje | Czysty SQL (np. dbmate lub Atlas), nie ORM jako właściciel schematu | Schemat czytają Next.js i worker w Pythonie |
| Worker | Python, Crawl4AI (działa na Playwright, sam renderuje JS) | Crawl, ekstrakcja, walidatory, import |
| Harmonogram workera | GitHub Actions (prywatne repo) na pilocie, potem VPS | Darmowo na start, kod przenośny |
| Kolejka Claude Code | Prywatne repo z plikami JSON (`katalog-queue`) | Nie wymaga dostępu do bazy z sesji, audytowalne |
| Hosting strony | Vercel Pro lub alternatywa (Hobby jest tylko niekomercyjny). Wiele domen w jednym projekcie, panel admina na osobnym neutralnym hoście | Serwis z reklamami i leadami jest komercyjny. Jeden kod, wiele domen branżowych |
| E-mail transakcyjny | Resend lub Postmark | Powiadomienia z art. 14, dostarczanie leadów |
| Antyspam formularzy | Cloudflare Turnstile oraz honeypot i limity | Darmowy (z mojej wiedzy) |
| Analityka | Plausible, Umami lub PostHog, własne zdarzenia w bazie | Bez ciasteczek tam, gdzie się da |
| Błędy | Sentry | Strona, admin i worker |
| CDN i logi botów | Cloudflare przed stroną | Widać wizyty botów AI |

Decyzje otwarte opisane w sekcji 18.

---

## 3. Branże jako konfiguracja (vertical pack)

Każda branża to wersjonowany pakiet w bazie (`vertical_versions`) i w repo (`packages/verticals/<slug>/`):

- **Domena i marka:** adres serwisu branży (pierwsza: rankingbiurnieruchomosci.pl), nazwa, logo, teksty prawne z nazwą serwisu.
- **Rejestr:** lista kodów PKD (jeśli branża dobrze się mapuje) albo tryb "tylko wyszukiwanie".
- **Wyszukiwanie:** szablony zapytań (branża x specjalizacja x miasto x synonimy), limity zapytań, filtr tematyczny.
- **Schemat faktów:** JSON Schema pól specyficznych dla branży (np. nieruchomości: rodzaje obsługiwanych transakcji, obszar działania, specjalizacje).
- **Schemat cen:** jednostki i typy usług (nieruchomości: prowizja od sprzedaży, od najmu, opłaty stałe, wyłączność).
- **Parametry rankingu:** lista parametrów, wagi startowe, reguły renormalizacji.
- **Szablony stron:** bloki "odpowiedź w skrócie", tabele, FAQ, nazwy po polsku, wzorzec adresu URL.
- **Formularze leadów:** typy i pola.
- **Prompty dla Claude Code:** klasyfikacja, opis, normalizacja cen.
- **Zestaw wzorcowy:** ok. 200 ręcznie oznaczonych domen.

Playbook dodawania nowej branży (cel: dni, nie tygodnie):
1. Sprawdzenie, czy branża jest regulowana. Z mojej wiedzy branże medyczne i prawnicze mają ograniczenia reklamy, więc ranking i reklama wymagają osobnej analizy prawnej przed startem.
2. Mapowanie PKD i test, czy rejestr da kompletną listę.
3. Szablony zapytań i schematy pól.
4. Zestaw wzorcowy i pomiar precyzji filtra anty-katalogowego.
5. Parametry rankingu (obiektywne, mierzalne ze strony firmy).
6. Pilot w jednym mieście, bramka jakości, publikacja.

Kod ogólny powstaje z branży nr 1 jako konfiguracja od początku, ale nie abstrahujemy ponad to, czego wymaga branża nr 2. Prawdziwy test uogólnienia to faza 7.

---

## 4. Model danych (PostgreSQL)

**Słowniki:** `verticals`, `vertical_versions` (konfiguracja JSON), `cities` (TERYT, województwo, liczba ludności).

**Podmioty:**
- `legal_entities` (NIP, REGON, KRS lub CEIDG, nazwa, forma prawna, data startu, status, PKD, data synchronizacji z rejestrem),
- `brands` (marka, spółka),
- `domains` (host, URL kanoniczny, marka, wynik weryfikacji 0-100, status robots),
- `locations` (siedziba lub oddział, adres, miasto, geo),
- `contacts` (typ, wartość, flaga adresu rolowego, wynik MX, `source_fact_id`),
- `social_links`,
- `listings` (publiczny wpis marki w branży i mieście: status, `published_at`, `noindex`). Marka z oddziałami w kilku miastach ma osobny wpis w każdym z nich. Miasto identyfikujemy kodem z TERYT (SIMC), nie nazwą, bo nazwy miejscowości się powtarzają.

Podmiot prawny, marka i oddział są osobnymi rekordami. Nigdy nie scalamy ich automatycznie po samej nazwie.

**Dowody:** `crawl_pages` (URL, data, status HTTP, hash treści, ścieżka snapshotu), `facts` (typ, wartość JSON, cytat, strona źródłowa, metoda, pewność, data obserwacji, `supersedes`), `price_items`, `review_links` (`place_id`, URL-e profili).

**Treść:** `descriptions` (wersje, tekst, `fact_ids`, raport walidatora, autor: claude_code, api lub człowiek, status).

**Ranking:** `ranking_models` (parametry i wagi, wersja), `ranking_snapshots` (miasto, branża, wersja modelu, data, opublikowany), `ranking_entries` (wynik, rozbicie punktacji, pozycja).

**Kolejka i przebiegi:** `queue_items`, `pipeline_runs` (etap, liczby, koszt, błędy), `search_queries` (tekst, dostawca, liczba wyników, nowe firmy, koszt).

**Leady:** `leads`, `lead_consents` (wersja tekstu zgody, lista odbiorców, czas, skrót IP), `lead_deliveries`, `lead_outcomes` (wynik u partnera, wartość, zwrot).

**Biznes i zgodność:** `advertisers`, `campaigns`, `placements`, `ad_events` (zagregowane), `invoices`, `claims`, `change_requests`, `removal_requests` (z terminem SLA), `notices_art14`.

**System:** `users`, `roles`, `audit_log`, `settings`, `feature_flags`.

Każda zmiana danych publicznych zapisuje się w `audit_log` (kto, kiedy, co, przed i po).

---

## 5. Pipeline danych

### 5.1 Skąd bierzemy 500 firm tygodniowo

Praca na kolejce podmiotów z rejestru, miasto po mieście, od największych (ranking miasta ma sens dopiero przy prawie pełnym pokryciu). Miasto firmy ustalamy z adresu siedziby i adresów oddziałów:

1. Kolejna porcja podmiotów z CEIDG i KRS dla branży i miasta.
2. Szukanie domeny: pole www z rejestru, a gdy go nie ma, 1-2 zapytania po nazwie i mieście.
3. Weryfikacja domeny po NIP, crawl, ekstrakcja, opis.

Przykładowy lejek (założenia do zmierzenia w tygodniu 0): 1400 podmiotów -> ok. 700 z domeną -> ok. 630 oficjalnych stron -> ok. 500 zweryfikowanych.

### 5.2 Etapy

| Etap | Co robi | Koszt |
|---|---|---|
| S0 | Pobranie porcji podmiotów z rejestru | API rejestrów (darmowe) |
| S1 | Szukanie domen (Brave lub Serper, wymienny adapter) | zapytanie |
| S2 | Tani filtr: blocklista, heurystyki strukturalne, dedup po znormalizowanej domenie | zero |
| S3 | Pobranie 2 stron (główna, kontakt), klasyfikacja (oficjalna, katalog, marketplace, media, inne), wyciągnięcie NIP i danych NAP | kod, spory do Claude Code |
| S4 | Suma kontrolna NIP, sprawdzenie w rejestrach (istnieje, aktywna, adres, data startu), dedup po NIP | API rejestrów |
| S5 | Głęboki crawl 5-10 podstron (przez `sitemap.xml` i ocenę linków), tylko dla zweryfikowanych | crawl |
| S6 | Ekstrakcja deterministyczna (JSON-LD, meta, `tel:`, `mailto:`, social, NIP, ceny), potem paczka dla Claude Code | kod |
| S7 | Claude Code: spory, opis, normalizacja cen. Walidator, import | subskrypcja lub API |
| S8 | Scoring, bramka publikacji, publikacja lub kolejka "niepewne" | zero |

### 5.3 Czyste dane

- **E-mail:** tylko firmowy, opublikowany na oficjalnej stronie, z walidacją składni i MX. Rozróżniamy adresy rolowe od osobistych. Osobistych nie zapisujemy. Dekodujemy zaciemnienie (np. ochrona e-mail Cloudflare). **Nigdy nie zgadujemy adresów** typu `info@domena`.
- **Telefon:** format E.164.
- **Domena:** URL kanoniczny po redirectach.
- **Social:** zapisujemy tylko profile potwierdzone jako należące do tej firmy.
- **Opis źródłowy** (meta description, fragment "O nas") jest tylko do użytku wewnętrznego, nie publikujemy go.

### 5.4 Filtr anty-katalogowy

Tanie sygnały strukturalne: `ItemList` lub wiele `LocalBusiness` w JSON-LD, dużo linków do różnych firm, "dodaj firmę", paginowane listy firm, wiele NIP-ów na stronie. Potem klasyfikator z uzasadnieniem. Przed autopublikacją mierzymy precyzję na zestawie wzorcowym.

### 5.5 Claude Code jako worker (bez płatnego API)

1. Worker przygotowuje dla każdej firmy paczkę JSON: fakty z `fact_id`, oczyszczony tekst w limicie ok. 3 tys. tokenów, fragmenty z cenami w kontekście. **Bez e-maili.**
2. Claude Code bierze partię (ok. 50-70 firm dziennie) i rozdziela ją na subagentów po ok. 10 firm, każdy w czystym kontekście.
3. Subagent zwraca `{firm_id}.json`: werdykt dla spornych przypadków, opis (2-3 zdania z faktów, każde zdanie wskazuje `fact_id`) i znormalizowane ceny.
4. **Walidator** odrzuca wynik, jeśli: schemat jest zły, cytat nie występuje w tekście źródłowym, liczba w cenie nie zgadza się z cytatem, nakładanie się n-gramów ze źródłem przekracza próg, twierdzenie w opisie nie ma `fact_id`. Odrzucone wracają do kolejki z powodem.
5. Skrypt importu zapisuje wynik w bazie. Człowiek przegląda próbkę ok. 5% i kolejkę "niepewne".
6. Uruchamianie: zadanie zaplanowane (np. raz dziennie) lub ręcznie. Przetestować na 50 firmach, zanim nazwiemy to planem, bo limitów subskrypcji przy tym wolumenie nie znam.
7. Awaryjnie ta sama kolejka może być obsłużona przez API (orientacyjnie $3-10 tygodniowo przy 500 firmach). Format paczek jest niezależny od workera.

Crawler działa na osobnym workerze (GitHub Actions, potem VPS), nie w sesji Claude Code, bo sesja ma ograniczoną sieć.

### 5.6 Ceny usług

- Pozycja ceny: usługa, jednostka, wartość od-do, waluta, tryb VAT, warunki, cytat, `source_url`, data.
- Statusy: `publiczna`, `na zapytanie`, `nie znaleziono`, `w obrazku`.
- Kandydaci z kodu: liczby z `%` lub `zł` w pobliżu słów "prowizja", "cennik", "opłata", plus PDF-y z cennikiem.
- Publikujemy zawsze jako "deklarowane przez firmę, wg strony z dnia X". Co miesiąc sprawdzamy ponownie, po 60-90 dniach bez potwierdzenia oznaczamy jako nieaktualne.
- Agregaty (mediana prowizji w mieście) tylko przy minimalnej próbie i z podaną liczbą firm oraz datą.

### 5.7 Opinie

Zobacz sekcję 12 (warstwy opinii) i sekcję 13. W wersji 1: linki do profili i `place_id`, własne opinie zbierane po leadach. Bez kopiowania cudzych tekstów i bez streszczania ich.

### 5.8 Metryki jakości

Precyzja i recall na zestawie wzorcowym, recall względem rejestru (losowe 100 firm), koszt na zweryfikowaną firmę, odsetek odrzuceń walidatora, wydajność zapytań (nowe zweryfikowane firmy na zapytanie).

---

## 6. Strona publiczna i GEO

### 6.1 Typy stron i adresy

```
/                                       strona główna: mapa i lista miast, statystyki kraju
/{województwo}/                         hub regionu: miasta, statystyki, mniejsze miejscowości
/{miasto}/                              ranking miasta, rynek, FAQ, formularz leada
/{miasto}/{firma}/                      profil firmy (po bramce jakości)
/ranking/{miasto}/{rok}/                zamrożony snapshot z datą (cytowalny)
/ranking/polska/{rok}/                  ranking krajowy (np. skala, jawność cen)
/narzedzia/...                          kalkulatory, porównywarka, weryfikator
/metodologia/                           parametry, wagi, źródła, częstotliwość
/dane/                                  otwarty zbiór danych i changelog
/dla-firm/                              przejęcie profilu, korekta, oferta
/reklama/                               zasady oznaczania i niezależności rankingu
/usun-profil/                           korekta i usunięcie
/bot/                                   informacja o crawlerze i kontakt
```

### 6.2 Zasady GEO i techniczne

- HTML renderowany po stronie serwera (SSG z ISR), treść nigdy tylko w JS.
- Na górze każdej strony blok "odpowiedź w skrócie" (2-3 zdania) i tabela, widoczna data aktualizacji.
- JSON-LD: `RealEstateAgent` lub `LocalBusiness`, `ItemList` dla rankingów, `Dataset` dla `/dane`, `FAQPage` tylko z faktów, `Organization` dla samego serwisu.
- Mapa strony z `lastmod`, indeks per branża i miasto. IndexNow (Bing i inne, z mojej wiedzy nie Google), Search Console, Bing Webmaster Tools.
- robots.txt: przepuszczamy boty wyszukiwania (OAI-SearchBot, Claude-SearchBot, PerplexityBot). Zgoda na boty treningowe (GPTBot, ClaudeBot) to osobna decyzja.
- `llms.txt` jako tani dodatek (skuteczność niepotwierdzona).
- Stabilne adresy snapshotów i kanoniczny adres "najnowszy".
- Cloudflare przed stroną dla logów botów.
- Mapy: OpenStreetMap z zachowaniem polityki użycia kafelków (albo dostawca kafelków), nie Google Maps.

### 6.3 Bramka publikacji

Profil firmy trafia do indeksu dopiero, gdy: domena zweryfikowana po NIP, minimalna liczba zweryfikowanych faktów (próg do ustalenia na pilocie), opis przeszedł walidator. W przeciwnym razie `noindex` albo tylko wiersz w tabeli miasta.

Ranking miasta publikujemy dopiero przy odpowiednim pokryciu (propozycja: co najmniej 80% firm z rejestru, które mają stronę, przetworzonych).

Wpisy publikujemy z kontrolowanym tempem, nie jednym zrzutem, żeby uniknąć wrażenia masowej produkcji stron.

Domena jest przypisana do jednej branży, więc adresy nie mają prefiksu branży. Przy drugiej branży powstaje osobna domena z tą samą strukturą.

### 6.4 Cała Polska: miasta, warstwy i publikacja

Skala: według GUS na 1 stycznia 2025 w Polsce jest 1020 miast, w tym 66 na prawach powiatu. Liczby firm z PKD 68.31.Z w rejestrach nie znalazłem. Ustalamy ją w tygodniu 0 z CEIDG i KRS (aktywne podmioty), a od niej zależy, ile fal potrzeba na pokrycie kraju.

Zasada: strona miasta nie powstaje na zapas. Tysiąc prawie pustych stron miast to klasyczne strony przejściowe pod wyszukiwarkę i ryzyko scaled content abuse. Ranking trzech firm też nie ma sensu. Dlatego warstwy:

| Warstwa | Miasta | Co publikujemy | Próg (propozycja do korekty po F1) |
|---|---|---|---|
| A | Stolice województw i miasta powyżej ok. 100 tys. mieszkańców | Pełna strona miasta, ranking, profile | co najmniej ok. 10 zweryfikowanych firm i pokrycie co najmniej 80% firm z rejestru, które mają stronę |
| B | Miasta średnie (ok. 20-100 tys.) | Strona miasta z listą i tabelą, ranking dopiero od 5 firm | co najmniej 5 zweryfikowanych firm |
| C | Małe miasta | Brak osobnej strony. Firmy trafiają na stronę regionu jako "w okolicy", a profil firmy jest indeksowany po przejściu bramki | brak |
| D | Miasta bez firm w danych | Nic | brak |

Dodatkowe zasady:
- **Oddziały i sieci:** firma z oddziałami ma wpis w każdym mieście. Sieci i franczyzy: jedna strona marki, wiersze oddziałów w tabelach miast. Osobna strona oddziału tylko wtedy, gdy ma własne dane (adres, zespół, kontakty, oferta). W przeciwnym razie `noindex` albo canonical do marki, żeby nie powielać treści.
- **Adresy miast:** slug bez polskich znaków. Nazwy się powtarzają, więc konflikty rozstrzygamy dopiskiem powiatu, a tożsamość miasta to kod z TERYT.
- **Fale:** miasta uruchamiamy malejąco według liczby podmiotów z rejestru. Po każdej fali bramka (jakość, indeksacja).
- **Statystyki krajowe i regionalne** (np. mediana prowizji, odsetek jawnych cen) tylko przy minimalnej próbie, z podaną liczbą firm i datą.
- **Panel promptów AI:** nie obejmie setek miast. Stały zestaw ok. 20 największych miast i losowa rotująca próba pozostałych.
- **Leady:** podaż partnerów w małych miastach jest cienka, więc monetyzację zaczynamy w warstwie A.

---

## 7. Ranking (nieruchomości, wersja startowa)

Wagi są startowe i będą strojone na pilocie. Opublikujemy je na `/metodologia/`.

| Parametr | Źródło | Waga |
|---|---|---|
| Staż | data startu z rejestru | 10 |
| Skala | oddziały, liczba aktywnych ofert na własnej stronie, zespół (jeśli jawny) | 15 |
| Jawność cennika | `price_items` | 15 |
| Spójność i kompletność danych | zgodność NAP, aktywna strona, HTTPS | 10 |
| Zakres usług | sprzedaż, wynajem, wycena, doradztwo | 10 |
| Potwierdzenia | OC, stowarzyszenia, certyfikaty (deklarowane na stronie, z cytatem) | 15 |
| Jakość techniczna strony | szybkość, mobilność | 5 |
| Własne opinie zweryfikowane | po zebraniu próby | 10 |
| Czas reakcji na leady | po zebraniu danych | 10 |

Parametry bez danych są pomijane, a wagi renormalizowane. Zasady:
- Wersjonowanie modelu i zamrożone snapshoty.
- Publiczne rozbicie punktacji.
- Dane starsze niż próg świeżości tracą punkty.
- Płatność nie wpływa na wynik. Reklama jest w osobnym slocie z napisem "Reklama".
- Przed publikacją symulator wag (co się zmieni po zmianie) i diff względem poprzedniego snapshotu.

---

## 8. Leady

**Typy formularzy:** wycena nieruchomości lub sprzedaż, szukam biura, wynajem, kontakt do konkretnej firmy z jej profilu.

**Zgody:** (1) przekazanie danych wskazanym biurom, z listą odbiorców i linkiem, (2) opcjonalnie marketing. Zapisujemy wersję tekstu, czas i skrót IP. Przekazanie do konkretnej firmy tylko po zgodzie na tę firmę.

**Antyspam:** Turnstile, honeypot, limity, wykrywanie duplikatów i wzorców (ten sam numer, jednorazowe e-maile), wynik spamu, opcjonalnie weryfikacja SMS.

**Routing:**
- Reguły per miasto i typ: firmy partnerskie, limity, wyłączność.
- Lead "do konkretnej firmy" idzie do niej bez rozdzielnika.

**Dostarczanie:** e-mail, webhook, panel firmy. Log dostaw z ponowieniami.

**Statusy:** nowy, zweryfikowany, spam, przekazany, odebrany, sprzedany, zwrócony.

**Pętla zwrotna:** wynik u partnera, wartość, zwroty i reklamacje.

**Mierzymy też:** źródło (w tym odesłanie z asystenta AI po `utm_source` lub referrerze), stronę wejścia, czas do pierwszego kontaktu przez firmę.

---

## 9. Monetyzacja

- **Leady sprzedających** (rdzeń): cena za lead, wyłączność droższa. Na starcie rozliczenia ręczne.
- **Profil Premium:** logo, wyróżnienie w osobnym slocie "Reklama", panel leadów.
- **Sloty reklamowe** na stronach miast i hubach, sprzedawane bezpośrednio.
- **Afiliacja:** kredyty hipoteczne, wyceny, notariusze, ubezpieczenia, home staging.
- **Raporty dla firm:** płatny raport pozycji i audyt widoczności w asystentach AI (z naszego panelu promptów).
- **Dane dla mediów i deweloperów:** tylko dane niebędące danymi osobowymi, po analizie prawnej.

Zasady: każda reklama oznaczona, ranking organiczny niezależny od płatności, publiczna strona `/reklama/`.

---

## 10. Panel admina

Technologia: moduł `/admin` w aplikacji Next.js, logowanie przez Supabase Auth z 2FA dla administratorów, uprawnienia na poziomie ról.

### 10.1 Role

| Rola | Dostęp |
|---|---|
| Admin | wszystko, ustawienia, użytkownicy |
| Redaktor | wpisy, kolejka weryfikacji, opisy, ceny, rankingi (bez publikacji) |
| Sprzedaż | leady, reklamodawcy, kampanie, roszczenia |
| Podgląd | statystyki, tylko odczyt |

### 10.2 Moduły

1. **Dashboard:** KPI, lejek pipeline z ostatnich 7 i 30 dni, alerty (nieudane przebiegi, zaległości w kolejce, skok odrzuceń walidatora, budżet), pokrycie miast względem rejestru, snapshot przychodów i leadów.
2. **Wpisy (firmy):**
   - Lista z filtrami (branża, miasto, status: kandydat, niepewne, zweryfikowana, opublikowana, odrzucona, do usunięcia; wynik, świeżość, ma e-mail, ma ceny) i akcjami zbiorczymi.
   - Karta firmy z zakładkami: Dane (pole po polu z pochodzeniem, blokada i ręczne nadpisanie), Źródła (pobrane strony, snapshoty, diff), Opis (wersje, raport walidatora, regeneracja), Ceny, Linki do opinii, Kontakty, Marka i oddziały (scalanie i rozdzielanie), Historia i audyt, Leady, Reklama, Roszczenia.
   - Akcje: publikuj, wycofaj, `noindex`, wyklucz, ponowny crawl, scal duplikaty, oznacz do usunięcia (RODO).
3. **Kolejka weryfikacji ("niepewne"):** karty z dowodami obok siebie (zrzut domeny, zgodność NIP, NAP, werdykt klasyfikatora), skróty klawiszowe (zatwierdź, odrzuć, potrzeba więcej danych), liczniki SLA.
4. **Opisy i kolejka Claude Code:** próbka QA ok. 5%, wynik nakładania się ze źródłem, flagi, regeneracja zbiorcza, stan kolejki (oczekujące, w toku, gotowe, nieudane), przepustowość.
5. **Crawl i zadania:** tabela przebiegów (etap, czas, liczby, błędy, koszt), logi, ponowienie, pauza, blokady per domena (robots, 4xx i 5xx), kondycja adapterów wyszukiwania, tabela wydajności zapytań.
6. **Miasta i branże:** edytor konfiguracji branży (wersjonowany), miasta z liczbą podmiotów w rejestrze i pokryciem, cele, przełącznik "miasto gotowe do publikacji".
7. **Rankingi:** parametry i wagi (wersjonowane), wyliczenia, podgląd, symulator, diff z poprzednim snapshotem, publikacja.
8. **Leady:** skrzynka z filtrami, karta leada (treść, zgody z wersją i czasem, źródło i UTM, referrer AI, wynik spamu), reguły routingu, log dostaw, zwroty i reklamacje, wartość, notatki, eksport CSV, deduplikacja.
9. **Reklamodawcy i kampanie:** reklamodawcy, pakiety, sloty (miasto, hub, profil), harmonogram, kreacje, oznaczenia, wyświetlenia i kliknięcia, faktury (ręcznie na start), saldo dla rozliczeń za lead.
10. **Roszczenia i zgłoszenia:** przejęcie profilu (weryfikacja przez e-mail na domenie, meta tag lub rekord DNS TXT), prośby o zmianę, korekta i usunięcie z licznikami SLA, dziennik powiadomień z art. 14 (wysłane, odbite, wypisane).
11. **SEO i AI:** indeksacja (import z GSC), stan sitemap, log IndexNow, wizyty botów AI, wejścia z asystentów, wyniki panelu promptów (udział w cytowaniach per asystent, miasto, prompt, trend), błędy danych strukturalnych, uszkodzone linki.
12. **Statystyki i raporty:** sekcja 11, tygodniowy raport e-mailem.
13. **Użytkownicy, audyt, ustawienia:** progi (minimalna liczba faktów do publikacji, progi walidatora), feature flags, status kluczy API, budżety i alerty kosztów, eksport i kopie zapasowe.

---

## 11. Statystyki

- **Pipeline:** konwersja per etap, przepustowość tygodniowa, koszt na zweryfikowaną firmę, zaległości, odsetek odrzuceń walidatora, przepustowość Claude Code.
- **Jakość danych:** pokrycie względem rejestru per miasto, odsetek z e-mailem, z cenami, świeżość, duplikaty.
- **SEO i GEO:** strony w indeksie, wyświetlenia i kliknięcia z GSC, wizyty botów AI, wejścia z asystentów, udział w cytowaniach z panelu promptów.
- **Leady:** liczba, odsetek dostarczonych, wartość, miasto i typ, odsetek spamu, czas pierwszego kontaktu per firma.
- **Przychody:** leady, reklamy, subskrypcje, per branża.

---

## 12. Pomysły na funkcjonalność

Oznaczenia: [MVP] pierwsze wydanie, [F2] drugie, [później], [eksperyment] do zmierzenia przed inwestycją.

### 12.1 Dla odwiedzających

- **Kalkulator prowizji** [MVP]: "ile zapłacę za sprzedaż mieszkania za X zł". Pokazuje przedział z jawnych cenników w mieście i które biura mają jawne ceny. Naturalny lead magnet.
- **Porównywarka biur** [MVP]: 2-4 firmy obok siebie (prowizja, staż, usługi, oddziały). Tabele są dobrze cytowalne.
- **Filtry** [MVP]: dzielnica lub obszar obsługi, specjalizacja (nowe budownictwo, komercyjne, wynajem długoterminowy, domy, działki), języki obsługi, jawna prowizja, umowa bez wyłączności, bezpłatna wycena.
- **Weryfikator "sprawdź biuro"** [F2]: wpisujesz nazwę lub NIP i widzisz tylko fakty z rejestrów (status, data startu, adres) oraz fakty z jego strony. Bez ocen i bez oskarżeń. Częsta intencja wyszukiwania, dobry generator linków.
- **Quiz dopasowania** [F2]: kilka pytań (typ nieruchomości, dzielnica, budżet, wyłączność tak lub nie) i spersonalizowany ranking prowadzący do formularza.
- **Raport rynku miasta** [F2], miesięczny lub kwartalny: liczba biur, mediana prowizji, odsetek jawnych cen, nowe biura. Wersja PDF do pobrania. Oryginalne dane, które asystenci chętnie cytują.
- **Mapa biur** [F2]: oddziały na mapie w mieście.
- **Kalkulator kosztów transakcji** [później]: podatki i opłaty. Stawki trzymane jako parametry z datą i wymagają sprawdzenia w przepisach.
- **Otwarty zbiór danych** [F2]: CSV i JSON na `/dane`. Wyłącznie dane firmowe, nie osobowe. Wymaga decyzji prawnej, bo dla jednoosobowych działalności część danych jest osobowa.
- **Widget rankingu do osadzenia** [później] dla mediów i blogów, z linkiem zwrotnym.
- **FAQ per miasto z danych** [MVP]: "Ile kosztuje pośrednik we Wrocławiu?", "Które biura mają jawny cennik?".
- **Poradniki redakcyjne** [F2]: jak wybrać biuro, na co uważać w umowie pośrednictwa. Pisane i sprawdzone przez człowieka, nie masowo generowane.
- **Zapisane biura i alerty** [później]: lista w przeglądarce bez konta, potem opcjonalne powiadomienia.
- **Wersja EN i UA** [eksperyment]: dla cudzoziemców w dużych miastach.

### 12.2 Dla firm

- **Przejęcie profilu** [F2]: weryfikacja przez e-mail na domenie, meta tag lub DNS TXT.
- **Edycja profilu** [F2]: logo, własny opis oznaczony "od firmy", cennik, zespół, obszary, godziny. Dane zweryfikowane i deklarowane pozostają rozdzielone.
- **Panel leadów** [F2]: skrzynka, statusy, notatki, eksport, webhook i integracje (e-mail, Zapier lub Make, potem CRM), alerty e-mail lub SMS, licznik czasu reakcji.
- **Odznaki obiektywne** [F2]: zweryfikowana strona i NIP, jawny cennik, aktualne dane (poniżej 90 dni), szybka odpowiedź (z danych leadów). Nie do kupienia.
- **Raport dla firmy** [F2]: pozycja w mieście, rozbicie punktacji, lista kroków do poprawy zgodna z metodologią. Naturalny haczyk do kontaktu z firmą (z zachowaniem przepisów o mailingu).
- **Audyt widoczności w AI** [później, płatny]: czy asystenci polecają firmę w jej mieście, na podstawie naszego panelu promptów.
- **Pakiety** [F2]: Free, Premium (logo, slot "Reklama", panel), Partner (leady na wyłączność w dzielnicy).
- **Wyłączność terytorialna** [później]: dzielnica x typ leada, potem aukcja slotów.
- **Zwroty za złe leady** [F2]: formularz zwrotu z powodami i wstępny werdykt z reguł.
- **Saldo i faktury** [później]: konto przedpłacone, integracja z systemem fakturowania (nie sprawdzałem dostępnych API).
- **Widget "nr 3 w rankingu Wrocławia 2026"** [później]: do osadzenia na stronie firmy, z linkiem do metodologii i zasadami przeciw nadużyciom.

### 12.3 Dla zespołu i operacji

- **Symulator wag rankingu** [MVP]: co się zmieni po zmianie wag, z diffem względem poprzedniego snapshotu.
- **Przełączniki per miasto** [MVP]: publikuj, `noindex`, gotowe do rankingu.
- **Monitor zmian** [F2]: zmiana cennika, strona nie działa, zmiana NIP lub adresu. Alerty i kolejka ponownej weryfikacji.
- **Wykrywanie wykreślonych firm** [MVP]: status z rejestru wykreślony lub zawieszony powoduje automatyczne wycofanie wpisu.
- **Zestawy wzorcowe i testy regresyjne** [MVP]: uruchamiane przy każdej zmianie promptów lub filtrów, z wykresem precyzji i recallu.
- **Kreator "Dodaj branżę"** [F2, kluczowy dla etapu "inne branże"]: wybór PKD, szablon zapytań, schemat pól, parametry rankingu, strona testowa.
- **Moderacja zgłoszeń "popraw dane"** [F2]: zgłoszenia użytkowników z diffem do akceptacji.
- **Reguły antyfraudowe dla leadów** [F2]: wynik spamu, czarna lista numerów, limity.
- **Eksperymenty A/B** [później]: formularze leadów i układ stron.
- **Panel kosztów** [MVP]: koszt na zweryfikowaną firmę, budżety API, alerty.

### 12.4 Specyficzne dla widoczności w AI

- **Panel promptów** [F2]: cotygodniowy zestaw promptów x asystenci x miasta, trend udziału w cytowaniach, alert, gdy tracimy cytowanie.
- **Cytowalne bloki** [MVP]: odpowiedź w skrócie, tabela, data, źródło na każdej stronie rankingu.
- **Stabilne adresy snapshotów** [MVP]: `/ranking/.../2026/` oraz kanoniczny "najnowszy".
- **API tylko do odczytu** [eksperyment]: endpoint z danymi rankingu dla agentów AI, ewentualnie serwer MCP. Spekulatywne, do zmierzenia po pierwszych cytowaniach.
- **Strony "biuro A vs biuro B"** [ostrożnie]: tylko na żądanie użytkownika w porównywarce, nie masowo i programowo (ryzyko spamu i ryzyko prawne).

### 12.5 Warstwy opinii

1. **Link-out** [MVP]: `place_id` i adresy profili firmy, przycisk "Zobacz opinie w Google". Bez kopiowania treści.
2. **Ocena z oficjalnego API** [później, opcjonalnie]: ocena i liczba opinii z atrybucją, o ile polityka Google pozwala to wyświetlić zgodnie z naszą architekturą strony.
3. **Własne opinie** [F2]: po leadzie wysyłamy link do osoby, która wypełniła formularz. To pozwala uczciwie opisać weryfikację, której wymaga Omnibus.
4. **Opinie od firm** [później]: po przejęciu profilu firma autoryzuje dostęp do własnych opinii (dostępność odpowiedniego API do sprawdzenia).

Poza wersją 1: streszczenia cudzych opinii przez AI i udział cudzych ocen w rankingu.

---

## 13. Zgodność i prawo

Lista kontrolna:
- Rejestr czynności przetwarzania, polityka prywatności, regulamin serwisu, regulamin leadów.
- **Powiadomienie z art. 14 RODO** wysyłane na zapisany firmowy adres przy pierwszej publikacji, z linkiem do korekty i usunięcia. Powód: sprawa Bisnode (UODO) i kara za brak bezpośredniego informowania przy danych z rejestrów. WSA zawęził obowiązek do osób prowadzących lub zawieszających działalność. Wyniku w NSA nie znalazłem.
- Proces korekty i usunięcia z terminem SLA (propozycja: kilka dni roboczych).
- Umowy z odbiorcami leadów (rola administratorów danych, powierzenie lub współadministrowanie).
- Oznaczenia reklam, strona `/reklama/`, strona `/metodologia/` z głównymi parametrami rankingu (logika Omnibusa).
- Strona `/bot/`: User-Agent z adresem kontaktowym, informacja o szanowaniu robots.txt.
- Informacja, że opisy są przygotowane z faktów ze źródeł.
- Baner cookies tylko jeśli używamy ciasteczek wymagających zgody.
- Mailing sprzedażowy do firm: osobna analiza (przepisy o komunikacji elektronicznej).

Pytania do prawnika (jedna konsultacja przed startem publicznym):
1. Publikowanie danych jednoosobowych działalności i zakres obowiązku z art. 14.
2. Rankingi i porównania nazwanych firm: ryzyko dóbr osobistych i nieuczciwej konkurencji, forma metodologii i prawa do odpowiedzi.
3. Zasady Omnibusa dla rankingów i opinii, w tym numery przepisów.
4. Regulaminy portali z opiniami, ochrona baz danych (sui generis) i odpowiedzialność za cudze treści.
5. Warunki sprzedaży leadów i umowy z partnerami.
6. Zbiór danych na `/dane` i licencja.
7. Mailing do firm.
8. Dla kolejnych branż: ograniczenia reklamy w branżach regulowanych.

---

## 14. Fazy i bramki

Czasy to rzadkie przybliżenie dla jednej osoby pracującej z Claude Code na pełnym etacie. Do zweryfikowania po fazie 1.

| Faza | Zakres | Kryterium ukończenia | Czas |
|---|---|---|---|
| F0 Fundamenty | Repo, schemat bazy, CI, środowiska, sekrety, szkielet panelu z logowaniem | Migracje działają, logowanie z rolami, deploy przechodzi | ok. 1 tydz. |
| F1 Dane (pilot, 1 miasto) | Import CEIDG i KRS, szukanie domen (test Brave vs Serper), klasyfikator, crawl, ekstrakcja deterministyczna, paczki, walidator, import, ceny | Zmierzony lejek i konwersje, precyzja "zweryfikowanych" na zestawie wzorcowym, kolejka Claude Code przetestowana na 50 firmach | ok. 3 tyg. |
| F2 Panel admina v1 (równolegle z końcem F1) | Wpisy, kolejka weryfikacji, kolejka opisów, przebiegi, dashboard podstawowy, audyt | Cała praca redakcyjna da się wykonać w panelu | ok. 2 tyg. |
| F3 Strona MVP | Szablony, ranking v1, metodologia, JSON-LD, sitemap, IndexNow, robots, bramka publikacji, narzędzia MVP | Pilotowe miasto opublikowane | ok. 3 tyg. |
| **Bramka A** | 4-6 tygodni obserwacji po starcie | Indeksacja, pierwsze cytowania w panelu, jakość danych, brak poważnych skarg | |
| F4 Leady i zgodność | Formularze, zgody, routing, dostarczanie, powiadomienia z art. 14, przejęcie profilu, korekta i usunięcie | Pierwszy lead dostarczony zgodnie z procesem | ok. 3 tyg. |
| F5 Skala krajowa | Fale miast według warstw (od największych), panel promptów AI, statystyki, alerty kosztów | Stabilna przepustowość ok. 500 firm tygodniowo, każda fala przechodzi bramkę jakości i indeksacji | ok. 3 tyg. na uruchomienie, potem praca ciągła. Czas pokrycia całej Polski zależy od liczby podmiotów (do zmierzenia w F1) |
| **Bramka B** | Realne leady, cytowania, koszt na firmę | Decyzja o inwestycji w monetyzację | |
| F6 Monetyzacja | Reklamy, rozliczenia leadów, panel firmy, pakiety | Pierwsze płatne zamówienie | ok. 4 tyg. |
| F7 Druga branża | Uogólnienie na prawdziwym przykładzie, kreator "Dodaj branżę" | Druga branża w produkcji bez zmian w kodzie rdzenia | ok. 2-3 tyg. |

Proponowane progi bramek (do skorygowania po F1): precyzja "zweryfikowanych" na zestawie wzorcowym co najmniej 95%, duplikaty poniżej 1%, odsetek zatwierdzonych przez walidator co najmniej 90%. Jeśli po bramce A nie ma cytowań ani leadów w rozsądnym czasie, zatrzymujemy skalowanie i diagnozujemy przyczynę.

---

## 15. Koszty

Szczegóły i założenia w poprzedniej wymianie. Skrót:
- **Pilot:** ok. $6-15 w pierwszym miesiącu (wyszukiwanie i LLM przez API albo $0 LLM przy Claude Code, baza darmowa, worker na GitHub Actions).
- **15 miast:** ok. $95-120 miesięcznie (wyszukiwanie, LLM lub subskrypcja, Supabase Pro, VPS, hosting Pro, panel promptów).
- **Cała Polska:** koszty zmienne rosną liniowo z liczbą firm. Z mojego modelu to ok. $0,02-0,03 na firmę (wyszukiwanie i LLM przez API, z eskalacją do Sonneta). Przy Claude Code zamiast API część tego odpada. Koszty stałe (baza, hosting, worker) zmieniają się mało. Całkowita kwota zależy od liczby firm w rejestrach, której jeszcze nie znam.
- **Jednorazowo:** konsultacja prawna (rząd kilku tysięcy zł, moje oszacowanie).
- **Największy ukryty koszt:** czas na weryfikację ręczną.
- Do tego Resend lub Postmark, Sentry i domena (niewielkie kwoty).

---

## 16. Ryzyka

| Ryzyko | Środek zaradczy |
|---|---|
| Scaled content abuse i niski wpływ cienkich stron | Bramka publikacji, tempo, dane zamiast prozy, walidator nakładania się |
| RODO i dane jednoosobowych działalności | Tylko dane firmowe, powiadomienia, korekta i usunięcie |
| Blokowanie crawlera, adresy IP centrów danych | Uprzejmy crawl, VPS ze stałym IP, brak omijania zabezpieczeń |
| Zależność od dostawcy wyszukiwania | Wymienny adapter, test na zestawie wzorcowym |
| Limity subskrypcji dla Claude Code | Format paczek niezależny od workera, awaryjnie API |
| Halucynacje i błędy faktów | Cytaty weryfikowane programowo, `null` zamiast zgadywania |
| Zmiany cen i stron firm | Cykliczny ponowny crawl, oznaczanie nieaktualnych |
| Fałszywe leady i fraud | Wynik spamu, weryfikacja, zwroty |
| Przedwczesne uogólnienie na wiele branż | Konfiguracja od początku, ale abstrakcja tylko do poziomu branży nr 2 |
| Jeden opiekun systemu | Dokumentacja runbooków, alerty, kopie zapasowe |

---

## 17. Struktura repozytorium

```
katalog/
  apps/
    web/                 Next.js: strona publiczna i /admin
    worker/              Python: pipeline, walidatory, import
  packages/
    verticals/
      nieruchomosci/     konfiguracja, prompty, schematy, zestaw wzorcowy
    shared/              typy i wspólne stałe
  db/
    migrations/          SQL
  docs/
    PLAN.md
    runbooks/            procedury operacyjne
  .github/workflows/     harmonogramy workera i CI
katalog-queue/           osobne prywatne repo: paczki i wyniki (dane)
```

Dane (paczki i wyniki) trzymamy w osobnym prywatnym repo, żeby nie mieszać ich z kodem.

---

## 18. Decyzje otwarte

1. **Marka i domena: rozstrzygnięte.** Pierwsza branża działa na `rankingbiurnieruchomosci.pl`, każda kolejna na własnej domenie. Wspólny kod i jeden panel admina na osobnym neutralnym hoście. Do sprawdzenia: w wiadomości domena była zapisana jako `rankingbiurnieruchomsci.pl` (bez litery "o" w "nieruchomosci"). Potwierdź pisownię zarejestrowanej domeny. Jeśli zarejestrowałeś wersję z literówką, rozważ rejestrację także poprawnej i przekierowanie.
2. **Baza:** Supabase (auth, storage i panel awaryjny wbudowane, ale tworzysz projekt sam) czy Neon (mogę utworzyć stąd).
3. **Jedna aplikacja Next.js dla strony i panelu** (rekomendacja) czy osobny panel.
4. **Miasto pilota:** rekomendacja Wrocław.
5. **Claude Code czy API jako worker:** rozstrzygamy po teście na 50 firmach.
6. **Prawnik i dokumenty:** kto i kiedy (przed startem publicznym).

---

## 19. Czego nie zweryfikowałem

- Liczba firm z PKD 68.31.Z w CEIDG i KRS (nie znalazłem agregatu). Czas pokrycia całej Polski jest więc nieznany do tygodnia 0.
- Liczba 1020 miast pochodzi z wyników wyszukiwania opartych na danych GUS (stan na 1.1.2025). Warto sprawdzić w TERYT.
- Dokładne warunki Brave i Serper (przechowywanie wyników, parametry kraju i języka, wygasanie kredytów, ceny).
- Pełny tekst polityki Google Places (przechowywanie ocen i opinii) i dostępność API do opinii z profili firm.
- Numery przepisów dotyczących rankingów i opinii (Omnibus) w polskich ustawach.
- Regulaminy portali z opiniami, ochrona baz danych sui generis, odpowiedzialność za cudze treści.
- Wynik sprawy Bisnode w NSA.
- Limity subskrypcji Claude Code przy wolumenie ok. 500 firm tygodniowo.
- Reguły harmonogramu na darmowym planie Vercel, zapisy regulaminu GitHub o użyciu Actions do crawla.
- Dostępne API systemów fakturowania.
- Z mojej wiedzy, bez sprawdzania w tej sesji: IndexNow (bez Google), Turnstile (darmowy), polityka kafelków OpenStreetMap, ograniczenia reklamy w branżach regulowanych.

---

## 20. Ustalenia z implementacji F0 i F1 (10.11.2026)

Co jest zbudowane, jak uruchomić i co przetestowano: `README.md` w katalogu głównym repozytorium. Poniżej korekty
planu, które wynikły z testów na żywych API rejestrów.

1. **KRS nie pozwala szukać po PKD ani po NIP-ie, tylko po numerze KRS.** Założenie z sekcji 5.1 ("lista spółek z KRS
   po PKD") jest nieaktualne. Spółki odkrywamy przez wyszukiwanie (S1), a KRS i biała lista VAT służą do weryfikacji.
   Kolejka podmiotów "z rejestru" jest możliwa tylko dla jednoosobowych działalności przez CEIDG, które wymaga konta
   na biznes.gov.pl i tokenu JWT (specyfikacja jest dostępna po zalogowaniu). CEIDG jest odroczone do uzyskania tokenu.
2. **Biała lista VAT (MF) jest głównym weryfikatorem NIP.** Kontrakt sprawdzony na żywo: zapytanie zbiorcze do 30 NIP-ów,
   odpowiedź `result.entries[].subjects[]`, błędy per NIP (np. `WL-115`). Limit wg strony gov.pl: 100 zapytań dziennie.
   Przed API stoi ochrona Incapsula, która zwraca stronę HTML z kodem 200 (zaobserwowane wielokrotnie z sandboxa, także
   dla tego samego zapytania, które innym razem przechodziło). Klient wykrywa to, ponawia i kończy błędem `RegistryBlocked`.
   Ryzyko produkcyjne: blokady dla adresów centrów danych (GitHub Actions). Środki: cache w `registry_cache`, partie po
   30, VPS ze stałym adresem IP, awaryjnie weryfikacja z KRS i CEIDG.
3. **KRS podaje oficjalną stronę spółki** (`adresStronyInternetowej`) i listę PKD. To pozwala dla spółek z wpisaną
   stroną pominąć wyszukiwanie. Do zrobienia: etap "domeny z KRS" (numer KRS z białej listy VAT, domena z odpisu).
4. **Daty z rejestrów to nie początek działalności.** Biała lista VAT daje datę rejestracji w wykazie VAT, KRS datę
   wpisu do KRS. Parametr rankingu "staż" potrzebuje CEIDG (data rozpoczęcia dla jednoosobowych) albo ostrożnego
   sformułowania "w rejestrze od". Prompt dla Claude Code już tego pilnuje.
5. **Prywatność w kodzie:** z białej listy odrzucamy przedstawicieli, PESEL i rachunki, z KRS nie czytamy działu 2.
   Dla osób fizycznych bez adresu działalności zapisujemy tylko miejscowość i kod pocztowy.
6. **Nadal nieprzetestowane na żywo:** adaptery Brave i Serper (brak kluczy), crawler na prawdziwych stronach, renderowanie
   JS (Crawl4AI nie jest jeszcze podpięty, fetcher używa httpx), workflow GitHub Actions, CEIDG.
7. **Baza Neon:** konto Neon jest zarządzane przez Vercel (integracja Marketplace), więc API odmawia tworzenia projektów.
   Projekt trzeba utworzyć w panelu Vercel (Storage, Neon) albo na osobnym koncie Neon. Do tego czasu schemat jest
   zweryfikowany na lokalnym Postgresie 16, a migracja nie jest zastosowana.
8. **Wycinek F2 i F3 jest zbudowany** (`apps/web`): strona publiczna i panel admina opisane w `apps/web/README.md`. Ranking v0 liczy
   tylko 4 parametry z danymi, a metodologia na stronie jest generowana z tych samych stałych co kod.
9. **Uwaga techniczna:** w tej wersji Reacta formularz z akcją serwerową nie przekazuje `name` i `value` przycisku, więc każda
   decyzja w panelu ma własny formularz z ukrytym polem. Kto dodaje nowe akcje, powinien trzymać się tego wzorca.
10. **Bramka publikacji działa w panelu**: domena zweryfikowana, zwalidowany opis i minimum faktów (`publish_min_facts`).
    Wymuszenie jest możliwe świadomie i zapisuje się w audycie.
