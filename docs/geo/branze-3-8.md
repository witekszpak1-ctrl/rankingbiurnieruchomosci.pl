# Branże 3-8: pakiety i konfiguracje portali

Stan na 28.11.2026. Kolejność z `docs/ops/DECISIONS.md` (tabela 18 portali), portale nr 3-8. Dla każdej branży jest gotowy
pakiet danych (`packages/verticals/<slug>/`) i konfiguracja portalu (`apps/web/portals/<slug>.ts`) z własnym motywem
wyglądu. Nic z tego nie uruchamia płatnych zapytań: zbieranie firm (LiteScrape) rusza dopiero po zgodzie właściciela na
budżet danej branży, a portal po zakupie domeny. Wzór: biura rachunkowe (`docs/geo/branza-rachunkowe.md`).

Nazwy robocze marek są propozycją i **nie są wybraną marką ani domeną** (w każdym pakiecie `domain: TBD`, adres portalu to
znacznik `tbd.invalid`). Nie sprawdzałem dostępności domen ani znaków towarowych. Właściciel może je zmienić jedną linią
(`brand` w pliku portalu).

| Nr | Slug | Portal | Nazwa robocza | Typ schema.org | Motyw (kształt, paleta) |
|---|---|---|---|---|---|
| 3 | `oze` | Fotowoltaika, pompy ciepła, klimatyzacja, magazyny energii | Prąd i Ciepło | HomeAndConstructionBusiness | słońce i niebo, ciemny nagłówek, bardzo okrągłe kształty |
| 4 | `remonty` | Firmy remontowe i wykończeniowe | Odnowa Domu | GeneralContractor | terakota i krem, jasny nagłówek z grubą górną krawędzią, ostre rogi |
| 5 | `budowlane` | Firmy budowlane (budowa domów) | Pod Klucz | GeneralContractor | grafit i żółć ostrzegawcza, kwadratowe rogi, nagłówki wersalikami |
| 6 | `warsztaty` | Warsztaty samochodowe | Pod Maską | AutoRepair | stal i czerwień, krój maszynowy (IBM Plex Mono) w nagłówkach |
| 7 | `przeprowadzki` | Firmy przeprowadzkowe | Nowy Adres | MovingCompany | indygo i tektura, bardzo okrągłe kształty, zaokrąglony krój |
| 8 | `weterynarze` | Kliniki weterynaryjne | Cztery Łapy | VeterinaryCare | mięta i koral, miękkie zaokrąglenia, jasny nagłówek |

Typy schema.org to typy istniejące w słowniku (sprawdzone z pamięci, nie z walidatorem online): `HVACBusiness` opisuje tylko
część firm z portalu `oze` (fotowoltaika to instalacje elektryczne), więc użyłem ogólnego `HomeAndConstructionBusiness`.
Do sprawdzenia w walidatorze danych strukturalnych przy pierwszym wdrożeniu.

## 1. Co jest w repozytorium

Dla każdego slugu:

| Plik | Zawartość |
|---|---|
| `packages/verticals/<slug>/vertical.yaml` | kody PKD (rejestr i oczekiwane) z oceną pewności w komentarzu, słowa trafności, synonimy, specjalizacje, frazy miasta (`city_phrases`, 3), dokładne przeszukanie (`deep_phrases`, 4), fraza do Map Google, próg faktów, usługi cennika z jednostkami, lista domen wykluczonych, wagi rankingu (suma 100) z komentarzem do każdej |
| `cities.txt` | ta sama lista i kolejność miast co w nieruchomościach (327) |
| `districts.json` | tylko `warsztaty` i `weterynarze` (usługi lokalne: fraza na dzielnicę, kopia listy z nieruchomości) |
| `prompts/describe.md`, `classify.md` | prompty dostosowane do branży, ten sam schemat wyniku co w walidatorze |
| `prompts/daily.md`, `candidates.md` | instrukcja sesji i zbierania kandydatów (zapas bez płatnego API), ścieżki z prefiksem branży |
| `golden/README.md` | jak zbudować zestaw wzorcowy z prawdziwych wyników (bez wymyślonych plików CSV) |
| `apps/web/portals/<slug>.ts` | konfiguracja portalu na wspólnej fabryce `apps/web/portals/service-portal.ts` |
| `apps/web/lib/portal.ts` | rejestr `PORTALS` (resolver, `PORTAL=<slug>`) |
| `apps/web/app/globals.css` | bloki `html[data-theme="<slug>"]` (zmienne) i wspólne reguły motywów usługowych przez `:is(...)` |

Wyniki wszystkich portali (nazwa, odmiana, teksty, typ danych strukturalnych, funkcje wyłączone: oferty, blog, raporty,
wyróżnienia, cele klienta, prowizje) są w konfiguracji. Portal nieruchomości i rachunkowe nie są ruszane: nowe reguły CSS są
ograniczone selektorem `:is(html[data-theme="oze"], ...)`, a zmiana w `lib/portal.ts` to tylko wpisy rejestru.

Testy: `apps/web/tests/portal.test.ts` (każdy portal: rejestr, slug, motyw, odmiana fraz dla 1, 2, 5, 12, 22, 25, przypadki,
typ schema.org, brak tekstów innych branż i długich myślników, teksty miasta składane z przykładowych danych),
`apps/web/tests/vertical-scope.test.ts` (każde zapytanie katalogu ma filtr branży dla każdego portalu),
`apps/worker/tests/test_verticals_pack.py` (wczytanie każdego pakietu, zapytania dla jednego miasta bez sieci, wagi sumują się
do 100, prompty i schemat wyniku, brak tekstów innej branży).

## 2. Szacunek płatnych zapytań dla próbki 200 firm

Metoda jak w `docs/geo/branza-rachunkowe.md` (cena 0,15 USD za 1000 udanych zapytań LiteScrape, domyślnie 30 wyników na
frazę, czyli 3 strony; dokładne przeszukanie dużego miasta daje 2 strony więcej: 5 stron na frazę; dokładnie przeszukiwane jest
12 pierwszych miast kolejki). Założenia, których nie zmierzyłem (do sprawdzenia na pierwszych 2-3 miastach): 8 największych
miast daje ok. 480 domen kandydatów, ok. 250 trafia do weryfikacji i ok. 200 do próbki. Serper nie jest potrzebny.

| Etap | Wzór | oze, remonty, budowlane, przeprowadzki | warsztaty, weterynarze |
|---|---|---|---|
| Wyszukiwanie, frazy główne | 8 miast x 4 frazy x 5 stron | 160 | 160 |
| Wyszukiwanie, dzielnice | 96 dzielnic w 8 miastach x 3 strony | 0 | 288 |
| `probe` | 480 domen x ok. 2,7 | ok. 1300 | ok. 1300 |
| `crawl-deep` | 250 domen x ok. 7 | ok. 1750 | ok. 1750 |
| `contacts` | 200 firm x ok. 4 | do 800 | do 800 |
| `google-reviews` | 200 firm x 2 | do 400 | do 400 |
| Razem | | ok. 4410 | ok. 4698 |
| Koszt | x 0,00015 USD | **ok. 0,66 USD** | **ok. 0,70 USD** |
| Bez pobierania stron przez LiteScrape (`use_fetch` wyłączone w `/admin/koszty`: probe, crawl-deep i contacts robi własny robot) | wyszukiwanie + Mapy | ok. 560, 0,08 USD | ok. 848, 0,13 USD |

Wszystkich sześć branż razem: ok. 27 000 zapytań, ok. 4,1 USD (bez pobierania stron: ok. 3 900 zapytań, ok. 0,6 USD).
Liczby nie obejmują pomiarów widoczności w AI. Zasada z `CLAUDE.md` bez zmian: budżet na każdą branżę wymaga zgody właściciela,
limit w `settings.api_usage`, podgląd w `/admin/koszty`.

## 3. Portale

### 3. Fotowoltaika, pompy ciepła, klimatyzacja i magazyny energii (`oze`)

- **Jeden portal z kategoriami** (filtry: fotowoltaika, pompy ciepła, klimatyzacja, magazyny energii, jawny cennik), zgodnie z
  decyzją właściciela. Firma robiąca kilka kategorii jest jedną firmą w katalogu.
- **PKD:** `43.21.Z` (instalacje elektryczne, typowy kod instalatorów fotowoltaiki) i `43.22.Z` (instalacje wodno-kanalizacyjne,
  cieplne, gazowe i klimatyzacyjne: pompy ciepła, klimatyzacja) to listy wejściowe, pewność wysoka. **Niepewne** (poza listą,
  tylko wzmacniają wynik): `43.29.Z`, `43.99.Z`, `33.20.Z`, `71.12.Z`, kody handlu `47.xx`. Wiele firm fotowoltaicznych
  rejestruje się pod innym kodem, a część jest tylko sprzedawcami, więc rejestr daje listę niekompletną.
- **Źródła danych:** wyniki Google (LiteScrape), strony firm, wykaz VAT i KRS po NIP-ie ze strony, Mapy Google (ocena, liczba
  opinii, link). Cenniki są rzadkie i zależą od mocy, więc `jawnosc_cennika` będzie dotyczyć mniejszej części firm: ocenić po próbce.
- **Uwagi prawne (wiedza ogólna, do potwierdzenia, to nie opinia prawna):**
  - Uprawnienia i certyfikaty instalatorów (certyfikat instalatora odnawialnych źródeł energii, uprawnienia elektryczne,
    certyfikat do prac z czynnikami chłodniczymi przy klimatyzacji i pompach ciepła): pokazujemy wyłącznie deklaracje ze
    strony z cytatem. Brak deklaracji nie znaczy braku uprawnień, więc nie pisać, że firma ich nie ma.
  - Nie publikujemy obietnic oszczędności, okresów zwrotu ani kwot dotacji, także gdy tak pisze strona (`describe.md`, reguła 9).
    Pomoc firmy w dokumentach dotacji opisujemy bez kwot i warunków. Wprowadzanie konsumentów w błąd co do oszczędności to
    ryzyko dla portalu, jeśli powtórzymy cudzą obietnicę.
  - Dotacje i ulgi zmieniają się: portal nie podaje ich warunków.
- **Brak w robocie:** nic poza ogólnym (patrz sekcja 5).

### 4. Firmy remontowe i wykończeniowe (`remonty`)

- **PKD:** grupa `43.3` (`43.31.Z` tynkowanie, `43.32.Z` stolarka budowlana, `43.33.Z` posadzki i tapetowanie, `43.34.Z`
  malowanie i szklenie, `43.39.Z` pozostałe roboty wykończeniowe) na liście wejściowej. **Niepewne:** `41.20.Z`, `43.29.Z`,
  `43.99.Z` (remonty pod klucz prowadzą też firmy z tych kodów).
- **Źródła danych:** jak wyżej. Bardzo wiele ekip to jednoosobowe działalności bez strony albo tylko z profilem w mediach
  społecznościowych: te nie wejdą do katalogu (ta sama luka co w warsztatach, sekcja 4 poniżej, w mniejszej skali).
- **Uwagi prawne:** brak zawodu regulowanego po stronie wykonawcy remontu. Uprawnienia budowlane kadry (kierownik robót) są
  deklaracją ze strony z cytatem. Jednoosobowe działalności to osoby fizyczne: zasady RODO z `docs/PLAN.md` sekcja 13 (dane
  firmowe z rejestru, powiadomienie z art. 14, brak prywatnych telefonów) bez zmian.
- **Konflikt zakresu z `budowlane`:** firma budująca domy bez remontów jest tu `irrelevant` i odwrotnie (reguły w
  `classify.md`). Domena trafia do pierwszej branży, w której ją znaleziono (`domains.host` jest unikalny globalnie), więc firma
  robiąca remonty i budowy zostanie w jednej z nich.

### 5. Firmy budowlane, budowa domów (`budowlane`)

- **PKD:** `41.20.Z` (roboty budowlane związane ze wznoszeniem budynków) na liście wejściowej. **Deweloperzy** (`41.10.Z`) nie
  należą do portalu i ich kod celowo nie jest na liście. **Niepewne:** `43.99.Z`, `43.91.Z` (dekarskie), `43.12.Z`, `71.11.Z`.
- **Źródła danych:** jak wyżej. Cena za metr kwadratowy jest tu orientacyjna i zależy od technologii i standardu, więc ranking
  ma mniejszą wagę cennika (12) i większą realizacji (14) oraz ubezpieczenia (10).
- **Uwagi prawne:** kierownik budowy i projektant to funkcje z uprawnieniami budowlanymi (zawód regulowany w rozumieniu prawa
  budowlanego), ale portal nie ocenia uprawnień, tylko pokazuje deklaracje firmy z cytatem. Umowa o roboty budowlane i jej
  zastrzeżenia (zaliczki, odbiory etapów) są w poradniku miasta jako ogólne wskazówki, nie porada prawna.

### 6. Warsztaty samochodowe (`warsztaty`)

- **PKD:** `45.20.Z` (konserwacja i naprawa pojazdów samochodowych) na liście wejściowej. **Niepewne:** `45.40.Z` (motocykle, inna
  branża), `71.20.B` (stacje kontroli pojazdów: osobna, regulowana działalność), `45.31.Z` i `45.32.Z` (handel częściami).
  Kody według PKD 2025 (nowa klasyfikacja w rejestrach) do sprawdzenia.
- **Frazy lokalne:** klient szuka warsztatu blisko siebie, więc pakiet ma `district_phrase` ("warsztat samochodowy {city}
  {district}") i `districts.json` (96 dzielnic w 8 największych miastach: +288 zapytań na dokładne przeszukanie).
- **Próg faktów:** `min_facts: 5` (niższy niż 6): strony warsztatów są krótkie. Do zweryfikowania na próbce, nie na zapas.
- **Ranking:** największa waga opinii Google (20): w tej branży to często jedyne źródło zaufania. Pozostałe wagi z komentarzem
  w `vertical.yaml`.
- **Uwagi prawne:** autoryzacje (serwis marki), certyfikaty, gwarancje i ubezpieczenie warsztatu tylko jako deklaracje z cytatem,
  "części oryginalne" bez faktu zabronione w promptach. Stacje kontroli pojazdów (diagnosta) poza zakresem.
- **Luka: warsztaty bez własnej strony (najważniejsza uwaga dla tej branży).**

  Obecny robot jest zbudowany wokół domeny strony firmy:

  1. Wyszukiwanie Google (LiteScrape albo Serper) zwraca adresy stron, z nich powstaje wpis w `domains`.
  2. `probe`, `crawl-deep` i `bundle` pobierają strony i wyciągają fakty (NIP, usługi, ceny).
  3. NIP ze strony prowadzi do wykazu VAT i KRS (`stage_verify`), czyli do podmiotu prawnego, marki i wpisu katalogu.
  4. Mapy Google (LiteScrape `/api/google/maps`) służą dziś tylko do ocen i opinii firm, które już są w katalogu
     (`stage_google_reviews`, `fetch_place`).

  Skutki dla warsztatów: firma bez strony (tylko Mapy, profil społecznościowy albo wizytówka w katalogu) w ogóle nie trafia do
  `domains`, więc **nie wejdzie do katalogu**. Profile społecznościowe są na liście domen wykluczonych (`facebook.com`).
  Firma, która ma stronę bez numeru NIP, dostaje wpis "needs_review" i niższą pozycję (to działa w kodzie dla każdej branży),
  ale bez faktów ze strony często nie przekroczy progu publikacji.

  Czego brakuje, żeby objąć warsztaty bez strony (nie zrobione, bo to zmiana robota i prawdopodobnie schematu):

  | Brak | Uwagi |
  |---|---|
  | Etap odkrywania firm z Map Google | `maps_search` zwraca `local_results` (nazwa, adres, telefon, ocena, liczba opinii, `place_id`, strona jeśli jest), ale nie ma etapu, który z tego tworzy kandydatów. Szacunek kosztu: ok. 128 zapytań Map (8 miast x 4 frazy + 96 dzielnic) i 400 zapytań o opinie dla 200 firm, razem ok. 530 zapytań, ok. 0,08 USD (liczba wyników na zapytanie niezmierzona: sprawdzić na jednym mieście, ok. 16 zapytań) |
  | Wpis firmy bez domeny i bez NIP | `brands.legal_entity_id` jest `not null`, a wpis (`listings`) wymaga marki: firma bez podmiotu prawnego nie ma gdzie powstać. Wymaga projektu (np. wpis tymczasowy bez NIP z adresem z Map) i prawdopodobnie zmiany schematu, którą musi zastosować właściciel bazy (`CLAUDE.md`, `docs/rozpoznanie.md`) |
  | Potwierdzenie w rejestrze bez NIP ze strony | wykaz VAT szuka po NIP, REGON i rachunku, nie po nazwie. Dla firm bez strony potrzebny jest CEIDG (osobny dostęp, klucz) albo ręczne uzupełnianie |
  | Karta firmy o mniejszej liczbie faktów | z samych Map jest nazwa, adres, telefon, ocena, liczba opinii i link, bez opisu i cennika. Potrzebny prosty profil bez wygenerowanego opisu i osobny próg publikacji |
  | Zgodność z RODO | jednoosobowe warsztaty to osoby fizyczne: telefon i adres z Map to dane firmowe, ale zasady z `docs/PLAN.md` sekcja 13 (art. 14, brak prywatnych numerów) trzeba zastosować do danych z Map |

  Rekomendacja: zacząć od próbki 200 warsztatów **ze stronami** (to zadziała dziś), policzyć w pierwszym mieście, jaka część
  wyników wyszukiwania i Map ma stronę, i dopiero wtedy zdecydować o etapie Map. Wynik tego pomiaru jest warunkiem decyzji, nie założeniem.

### 7. Firmy przeprowadzkowe (`przeprowadzki`)

- **PKD:** `49.42.Z` (działalność usługowa związana z przeprowadzkami) na liście wejściowej. **Niepewne:** `49.41.Z` (transport
  drogowy towarów: tak rejestruje się wiele małych ekip z samochodem dostawczym), `52.29.C`, `52.10.B`. Bez nich lista jest niekompletna.
- **Próg faktów:** `min_facts: 5`, jak w warsztatach.
- **Ranking:** ubezpieczenie przewożonych rzeczy i odpowiedzialność przewoźnika mają wagę 18 (druga po cenniku), bo szkody są
  realnym ryzykiem klienta. Tylko deklaracje ze strony z cytatem; nie wolno pisać "ubezpieczona" bez faktu w paczce.
- **Uwagi prawne (wiedza ogólna, do potwierdzenia):** transport drogowy rzeczy pojazdami o większej ładowności wymaga licencji
  lub zezwoleń; małe ekipy często ich nie potrzebują. Portal tego nie ocenia i nie wnioskuje: tylko deklaracje.
- Giełdy transportowe (`trans.eu`, `timocom.com`) są na liście wykluczonych (pośrednicy zleceń).

### 8. Kliniki weterynaryjne (`weterynarze`)

- **PKD:** `75.00.Z` (działalność weterynaryjna), jedyny kod branży, pewność wysoka. Sklepy zoologiczne (`47.76.Z`), pielęgnacja
  zwierząt (`96.09.Z`) i hodowla nie są klinikami.
- **Frazy lokalne:** jak w warsztatach (`districts.json`, +288 zapytań na dokładne przeszukanie).
- **Zawód regulowany (lekarz weterynarii): reguły reklamy do potwierdzenia z prawnikiem przed publikacją.** Moja wiedza ogólna,
  nie opinia prawna: lekarze weterynarii wykonują zawód na podstawie ustawy o zawodzie lekarza weterynarii i izbach
  lekarsko-weterynaryjnych, obowiązuje ich kodeks etyki, a zakłady lecznicze dla zwierząt podlegają wpisowi do rejestru
  prowadzonego przez samorząd (okręgowe izby). Kodeks etyki i przepisy mogą ograniczać reklamę i sposób informowania o praktyce.
  Pytania do prawnika:
  1. Czy wolno publikować ranking, wyróżnienia i oceny porównujące kliniki (także z samych danych publicznych), i czy samo
     włączenie kliniki do rankingu bez jej zgody jest dopuszczalne (powiadomienie z art. 14 RODO zostaje).
  2. Czy sprzedaż profilu Premium albo reklamy klinikom jest dopuszczalna i na jakich warunkach (decyzja 4: Premium tylko
     odsłania dane, nie wpływa na wynik).
  3. Czy publikowanie cen zabiegów i opinii Google (ocena, liczba, link) wymaga zastrzeżeń.
  4. Jak oznaczać wpis do rejestru zakładów (deklaracja placówki, nie weryfikacja przez portal).
- **Zabezpieczenia już w pakiecie:** opisy sucho informacyjne (zakaz ocen jakości leczenia, obietnic skutków, opisów
  przypadków, diagnoz, porównań, nazwisk lekarzy), parametr `rejestr_zakladu` jako deklaracja placówki, brak parametru oceniającego
  skuteczność leczenia (test w `test_verticals_pack.py`), `homeHeroLead` z odesłaniem do telefonu w nagłym przypadku i zdanie w
  poradniku, że ranking nie ocenia jakości leczenia.
- **Rekomendacja do czasu opinii:** bez nagród i wyróżnień, bez sprzedaży pozycji i reklamy klinikom, bez formularza, który
  sugerowałby pomoc w nagłym przypadku. Analogicznie do pozycji 14-16 w `DECISIONS.md` (zawody regulowane).

## 4. Wagi rankingu (propozycja startowa, do strojenia na pilocie)

Pełne komentarze są w `vertical.yaml` każdej branży. Suma zawsze 100, płatność nie wpływa na wynik, parametry bez danych pomijamy
i renormalizujemy wagi. **Uwaga:** punktację w `lib/ranking.ts` sterują wagi z konfiguracji portalu (`ranking.weights`, `portals/<slug>.ts`), a silnik zna
dziś tylko sześć parametrów (rejestr, staż, cennik, spójność danych, zakres usług, opinie Google). Portale 3-8 mają w
konfiguracji te sześć z wartościami z poniższej tabeli (rejestr 20 jak w pozostałych portalach). Parametry specyficzne dla
branży (uprawnienia, realizacje, ubezpieczenie, dostępność itd.) są założeniem w `vertical.yaml` i czekają na dane z próbki
oraz implementację w silniku.

| Parametr | oze | remonty | budowlane | warsztaty | przeprowadzki | weterynarze |
|---|---|---|---|---|---|---|
| jawność cennika | 15 | 18 | 12 | 16 | 20 | 14 |
| zakres usług | 12 | 12 | 10 | 12 | 12 | 16 |
| opinie Google | 10 | 12 | 10 | 20 | 14 | 14 |
| staż | 8 | 8 | 10 | 6 | 8 | 6 |
| spójność danych | 5 | 8 | 6 | 8 | 8 | 6 |
| czas reakcji | 7 | 5 | 3 | 4 | 6 | 4 |
| jakość techniczna | 3 | 3 | 3 | 4 | 2 | 2 |
| uprawnienia (deklaracje) | 15 | 0 | 8 | 0 | 0 | 0 |
| gwarancja i serwis | 12 | 10 | 8 | 10 | 0 | 0 |
| realizacje | 8 | 12 | 14 | 0 | 0 | 0 |
| ubezpieczenie | 5 | 7 | 10 | 4 | 18 | 0 |
| skala | 0 | 5 | 6 | 0 | 0 | 0 |
| specjalizacje i wyposażenie | 0 | 0 | 0 | 16 | 0 | 18 |
| flota i ekipa, zasięg | 0 | 0 | 0 | 0 | 12 | 0 |
| dostępność | 0 | 0 | 0 | 0 | 0 | 14 |
| rejestr zakładu (deklaracja) | 0 | 0 | 0 | 0 | 0 | 6 |

W wierszu "specjalizacje i wyposażenie" warsztaty to 10 + 6, a weterynarze to 10 (diagnostyka i sprzęt) + 8 (specjalizacje).

## 5. Czego nie ma (jawna lista)

- **Domeny, nazwy marek i logo.** Nazwy są robocze. Logo to znak tekstowy (skrót w ramce i nazwa), a `app/icon.svg`,
  `app/apple-icon.png`, `public/icon-*.png` i obrazek do udostępniania są nadal wspólne (z `docs/geo/silnik-branz.md`, krok 1
  następnych kroków). Zbudowanie portalu `PORTAL=<slug>` działa, ale ikona karty przeglądarki to ikona nieruchomości do czasu
  osobnego zadania.
- **Teksty wspólnych stron na sztywno.** Część stron wspólnych ma jeszcze rzeczowniki branżowe w kodzie (np. przycisk wyszukiwania
  na stronie głównej "Pokaż biura", pole miasta, strona `/dla-firm` i `/metodologia`), jak w portalu rachunkowe: widać to na stronie
  głównej `PORTAL=warsztaty` (sprawdzone lokalnie: tytuł, nagłówek, menu i przycisk w nagłówku są z konfiguracji, przycisk
  wyszukiwania nie). To osobne zadanie ("Pozostałe teksty branżowe" z `docs/geo/silnik-branz.md`).
- **Wagi rankingu per branża w kodzie, parametry specyficzne** (`realizacje`, `uprawnienia`, `ubezpieczenie_oc` itd.): patrz wyżej.
- **Prompty z panelu per branża:** panel ma jeden prompt (nieruchomości), prompty branż są w pakietach.
- **Zestawy wzorcowe i blocklisty:** lista domen wykluczonych jest startowa i **nie jest sprawdzona na próbce** (część domen z
  pamięci, np. portale motoryzacyjne i budowlane, mogła się zmienić). Uzupełnić po próbce.
- **Brak sprawdzenia z walidatorem danych strukturalnych i testu wizualnego wszystkich motywów.** Zbudowano `PORTAL=warsztaty`,
  strona główna odpowiada 200 z oczekiwanym tytułem, motywem i 404 na `/oferty`.

## 6. Jak uruchomić portal po zgodzie właściciela

1. Zgoda na budżet danej branży i zakup domeny (właściciel). Wpisać domenę w `siteUrl` i `domains` pliku portalu.
2. Próbka: `collect-sample.yml` z parametrem `vertical` (szczegóły: `docs/geo/branza-rachunkowe.md`, sekcja "Jak uruchomić próbkę").
   Najpierw jedno miasto, zmierzyć liczbę domen i odsetek firm ze stroną (warsztaty i remonty szczególnie).
3. Zestaw wzorcowy (`golden/README.md`), precyzja klasyfikatora, uzupełnienie `blocklist`.
4. Projekt Vercel z `PORTAL=<slug>`, `SITE_URL`, `DATABASE_URL` itd. (`docs/geo/silnik-branz.md`, "Jak uruchomić nowy portal").
5. Przed publikacją: bramka jakości i, dla `weterynarze`, opinia prawna.
