# Branża: biura rachunkowe (portal nr 2)

Stan na 28.11.2026. Decyzja właściciela: biura rachunkowe są portalem nr 2 (`docs/ops/DECISIONS.md`), PKD 69.20.Z, jawne
cenniki. Domenę kupuje właściciel (w pakiecie `domain: TBD`). Zbieranie firm to płatne zapytania LiteScrape i rusza
dopiero po zgodzie właściciela na budżet (zasada z `CLAUDE.md`).

## 1. Co jest gotowe

Pakiet `packages/verticals/rachunkowe/`:

| Plik | Zawartość |
|---|---|
| `vertical.yaml` | slug, nazwa, PKD 69.20.Z (rejestr i oczekiwany), słowa trafności, synonimy, specjalizacje, szablony zapytań, frazy miasta (3 podstawowe, 4 przy dokładnym przeszukaniu), fraza do Map Google, usługi cennika z jednostkami, lista domen wykluczonych, wagi rankingu (suma 100) z komentarzem do każdej |
| `cities.txt` | ta sama lista i kolejność miast co w nieruchomościach (327 miast) |
| `prompts/describe.md`, `classify.md` | prompty adaptowane do biur rachunkowych, ten sam schemat wyniku co w walidatorze (`schema_version`, `claims`, `fact_ids`, `prices` itd.) |
| `prompts/daily.md`, `candidates.md` | instrukcja sesji i zbierania kandydatów (zapas bez płatnego API) |
| `golden/README.md` | jak zbudować zestaw wzorcowy z prawdziwych wyników. Pliku `domains.csv` i `entities.csv` celowo brak (bez wymyślonych danych) |

Wagi startowe rankingu (propozycja do strojenia na pilocie; parametry bez danych pomijamy, wagi renormalizujemy):

| Parametr | Waga | Dlaczego |
|---|---|---|
| jawność cennika | 20 | główna przewaga porównywarki, decyzja "jawne cenniki" |
| zakres usług | 15 | księgowość, kadry i płace, doradztwo, rejestracja firmy, KSeF |
| staż | 10 | data wpisu do rejestru |
| uprawnienia | 10 | certyfikat księgowy MF, stowarzyszenie, doradca podatkowy: tylko deklaracje ze strony, z cytatem |
| ubezpieczenie OC | 10 | polisa jest obowiązkowa, więc jawna informacja o niej buduje zaufanie |
| opinie Google | 10 | ocena i liczba (na profilu tylko ocena, liczba i link) |
| spójność danych | 10 | zgodność nazwa-adres-telefon z rejestrem, HTTPS |
| skala | 5 | zespół, liczba klientów, oddziały |
| jakość techniczna | 5 | szybkość i mobilność |
| czas reakcji | 5 | po zebraniu danych z leadów |

Zmiany w kodzie roboczym (bez zmiany zachowania dla nieruchomości, testy w `apps/worker/tests/test_verticals_pack.py`):

- frazy miasta, frazy dokładnego przeszukania, fraza na dzielnicę i fraza do Map Google są teraz w `vertical.yaml`
  (`search.city_phrases`, `deep_phrases`, `district_phrase`, `maps_phrase`); bez nich kod użyje pierwszych trzech synonimów,
- `blocklist` w `vertical.yaml` jest dokładany do `DEFAULT_BLOCKLIST` w poleceniach CLI,
- `--districts` i `--file` (polecenia `discover-queue` i `cities`) domyślnie wskazują pliki pakietu z `--vertical`,
- `fetch_place` przyjmuje frazę branży (`label`), z domyślną wartością jak dotąd.

## 2. Co w robocie nadal jest specyficzne dla nieruchomości

Blokery przed uruchomieniem zbierania biur rachunkowych zostały rozwiązane w gałęzi `claude/robot-branze` (28.11.2026):

| Bloker | Rozwiązanie |
|---|---|
| 1. `domains` bez branży | Migracja `db/migrations/0021_multi_vertical.sql`: kolumna `domains.vertical_id` (nullable, klucz obcy do `verticals`), uzupełnienie istniejących domen branżą `nieruchomosci`, indeks. Nowa domena dostaje branżę wyszukiwania, które ją znalazło. Etapy `probe`, `verify`, `reverify`, `crawl-deep`, `bundle`, `import`, `contacts`, `google-reviews`, `publish-ready` i raporty wybierają dane tylko wskazanej branży. Domena bez branży (dodana przez stary kod między migracją a wdrożeniem) liczy się jako nieruchomości. `domains.host` zostaje unikalny globalnie: domena znaleziona najpierw w jednej branży nie trafia drugi raz do drugiej (firma robiąca obie rzeczy zostaje przy pierwszej branży). |
| 2. Wspólna kolejka miast | Nieruchomości zostają przy kolumnach `cities.*` (steruje nimi panel, zakładka Miasta). Inne branże mają tabelę `vertical_cities(vertical_id, city_id, search_enabled, search_priority, deep_search, last_searched_at, deep_requested_at)`, wypełnianą poleceniem `katalog cities --vertical rachunkowe` (kolejność z `cities.txt`). Miasto znane tylko innej branży powstaje w `cities` z wyłączonym szukaniem, więc nie wchodzi do kolejki nieruchomości. Kopii stanu nieruchomości w `vertical_cities` celowo nie ma: rozjechałaby się z panelem. |
| 3. Workflowy | `pipeline.yml` i `import.yml` mają parametr `vertical` (domyślnie `nieruchomosci`, z harmonogramu zawsze to), każde polecenie dostaje `--vertical "$VERTICAL"`. Harmonogramu dla rachunkowych nie ma. Kolejka miast z panelu i prompt z panelu są wysyłane tylko dla nieruchomości. Nowy `collect-sample.yml` służy do próbki. |
| 4. Prompt z panelu | Nadal jeden (`settings.describe_prompt`, nieruchomości). Prompt rachunkowych jest w `packages/verticals/rachunkowe/prompts/describe.md`; panel per branża to osobne zadanie. |

Dodatkowe zabezpieczenia wprowadzone przy tej zmianie:

- Strona katalogu pokazuje opublikowane wpisy wszystkich branż (zapytania w `apps/web/lib/catalog.ts` nie filtrują po branży), więc `publish-ready` dla innej branży wymaga własnego wyłącznika `settings.auto_publish_<branża>` (domyślnie wyłączony). Nie włączać go, dopóki silnik wielu branż w `apps/web` nie rozdzieli portali.
- `offers`, `extra-cities` i `indexnow` dla branży innej niż nieruchomości nic nie robią (zwracają `skipped`).
- Kontrola `guard` ma osobny stan na branżę (`guard_snapshot:<branża>`, `guard_block:<branża>`); stan nieruchomości zostaje pod dotychczasowymi kluczami.
- Ścieżki kolejki: nieruchomości bez zmian (`queue/pending/<typ>/<id>.json`, `queue/results/<typ>/<id>.json`, `queue/results/skipped/<typ>/...`), więc istniejące dane w repozytorium kolejki są ważne. Inne branże: `queue/pending/<branża>/<typ>/<id>.json` i `queue/results/<branża>/<typ>/<id>.json` (oraz `queue/results/<branża>/skipped/<typ>/<id>.json`). Sesja opisów nieruchomości nie zobaczy paczek rachunkowych, a sesja rachunkowych ma je w osobnym katalogu. Identyfikatory są UUID, więc nazwy plików i tak się nie powtarzają.
- Twardy budżet zapytań LiteScrape na przebieg: zmienna `LITESCRAPE_RUN_BUDGET` (łącznie dla wszystkich poleceń przebiegu, zużycie zapisuje plik z `LITESCRAPE_BUDGET_FILE`), działa razem z miesięcznym limitem z panelu (obowiązuje mniejszy). Po wyczerpaniu budżetu wyszukiwanie się kończy, a strony pobiera już tylko własny robot.

### Jak uruchomić próbkę (po zgodzie właściciela na budżet)

1. Właściciel bazy stosuje migrację `0021_multi_vertical.sql` (rola właściciela, `katalog migrate` z rolą bez DDL jej nie wykona) i wpisuje ją w `schema_migrations` albo uruchamia `katalog migrate` rolą właściciela.
2. Uruchomić workflow `collect-sample` (Actions, ręcznie): parametry `cities` (domyślnie 1), `budget` (domyślnie 3000 zapytań LiteScrape), `limit` (300 domen na etap). To samo robi wypchnięcie gałęzi `run/collect-rachunkowe` z wartościami domyślnymi.
3. Workflow synchronizuje listę miast, szuka tylko przez LiteScrape (bez zapasu Serper), robi probe, verify, crawl-deep, bundle i wysyła paczki do repozytorium kolejki w `queue/pending/rachunkowe/`. Nie publikuje, nie importuje, nie pobiera opinii ani kontaktów.
4. Sesja opisów dla rachunkowych czyta `queue/pending/rachunkowe/describe/*.json`, zapisuje wyniki w `queue/results/rachunkowe/describe/`, a `import.yml` z parametrem `vertical = rachunkowe` je importuje (bez publikacji, patrz wyłącznik wyżej).

Lokalnie to samo: `katalog cities --vertical rachunkowe`, `katalog discover-queue --provider litescrape --cities 1 --vertical rachunkowe` itd.

Reszta (drobniejsze, nie blokują próbki):

| Miejsce | Co jest specyficzne |
|---|---|
| `classify.py:31` | domeny portali nieruchomości w `DEFAULT_BLOCKLIST` (nieszkodliwe, nie występują w wynikach rachunkowych) |
| `classify.py:63-71` | frazy rzeczoznawców, deweloperów, oprogramowania dla biur nieruchomości, `_BROKER_PHRASES` (pośrednictwo, prowizja). Filtr 4b działa tylko przy >=2 trafieniach i <3 frazach pośrednictwa, więc dla biur rachunkowych jest w praktyce bezczynny. Uwaga: `cennik abonamentów` w `_SOFTWARE_PHRASES` jest też zwrotem biur rachunkowych, ale jest liczony tylko razem z drugą frazą oprogramowania |
| `extract.py:241` | `_PRICE_KEYWORDS` bez słów `abonament`, `ryczałt`: kandydaci cen są szukani po `cennik`, `opłat`, `koszt`, `cena`, `stawk`, `prowizj`. Biura z "abonament od 300 zł" bez tych słów w pobliżu nie dadzą kandydata. Warto dodać po próbce |
| `extract.py:96` | `_ROLE_LOCALPARTS` zawiera `nieruchomosci`, `agencja` oraz `kadry`, `ksiegowosc`, `faktury` (adresy `ksiegowosc@` są uznawane za rolowe, nie osobowe: dla biur rachunkowych to poprawne, ale kontakt trzeba sprawdzić na próbce) |
| `validate.py:264-290` | `price_kind` (sprzedaż, najem, zarządzanie) i granice procentów (0,5-10% sprzedaż, 2-40% zarządzanie). Dla usług księgowych rodzaj wypada jako `other`, ale nazwy z "zakup", "transakcja" mogą wpaść w `sale` (dotyczy tylko procentów, a biura podają głównie kwoty) |
| `names.py:21,28,113` | słowa ogólne i nazwy portali nieruchomości, słownik rozpoznawania nazw z domen ("nieruchomosci" -> "Nieruchomości"). Dla biur: brak słów `ksiegowosc`, `rachunkowe`, `podatki` |
| `pipeline.py:1762` | `_NAME_FILLER` (nieruchomości, biuro, agencja, pośrednictwo) do scalania duplikatów po nazwie |
| `pipeline.py:858`, `:1333` | `stage_offers` i `stage_extra_cities` (oferty nieruchomości i dodatkowe miasta z ofert): dla biur rachunkowych nie dotyczy, nie uruchamiać. Wpisy w innych miastach trzeba oprzeć na adresie z rejestru |
| `offers.py` (cały moduł) | wykrywanie ofert nieruchomości |
| `geo_measure.py:25`, `:244`, `:512-515`, `:590` | własna domena portalu, słowa ogólne w dopasowaniu nazw, biblioteka pytań AI o biura nieruchomości, domyślna `industry="nieruchomosci"` (miary AI to płatne zapytania, osobna zgoda) |
| `ai_check.py:24-34` | pytania o biura nieruchomości |
| `cli.py:389`, `:403` | zapytania w poleceniu testowym LiteScrape ("agencja nieruchomości") |
| `cli.py:574` | domyślne `--vertical nieruchomosci` (zostawione celowo) |
| `indexnow.py:23`, `config.py:28` | adres portalu nieruchomości (IndexNow, User-Agent robota) |
| `queries.py:33` | `entity_queries` ma domyślne słowo "nieruchomości" (funkcja nieużywana w przepływie, tylko w teście) |

## 3. Szacunek płatnych zapytań dla próbki 200 firm

Cena: 0,15 USD za 1000 udanych zapytań LiteScrape (`litescrape.py:41`, `COST_PER_CALL_USD = 0.00015`). Serper nie jest
potrzebny (zapas). Liczby wynikają z domyślnych ustawień kodu: 30 wyników na frazę, czyli 3 strony po 10 (`DEFAULT_SEARCH_RESULTS`),
duże miasto (dokładne przeszukanie) dostaje 2 strony więcej (`city_queries`). Dokładnie przeszukiwane jest 12 pierwszych
miast kolejki (`search_priority <= 12`, `repo.py:82-89`).

Założenia, których nie zmierzyłem (do zweryfikowania na pierwszych 2-3 miastach): 8 największych miast daje ok. 480 domen
kandydatów (60 na miasto po 4 frazach), z tego ok. 250 trafia do weryfikacji i ok. 200 do próbki.

| Etap | Wzór | Zapytań |
|---|---|---|
| Wyszukiwanie | 8 miast x 4 frazy x 5 stron (dokładnie) | 160 |
| `probe` (strona główna, kontakt, ewentualnie 2 strony prawne) | 480 domen x ok. 2,7 | ok. 1300 |
| `crawl-deep` (do 8 podstron, bez już pobranych) | 250 domen x ok. 7 | ok. 1750 |
| `contacts` (strona główna i do 3 podstron kontaktu) | 200 firm x ok. 4 | do 800 |
| `google-reviews` (miejsce i opinie) | 200 firm x 2 | do 400 |
| Razem | | ok. 4400 |

Koszt: 4400 x 0,00015 USD = **ok. 0,66 USD**. Przy dwa razy większej liczbie domen (12 miast, słabsza precyzja wyszukiwania):
ok. 1,3 USD. Zapytania 400, 404 i 503 nie są liczone, a pobranie strony, które się nie uda, wraca do własnego robota bez opłaty.

Oszczędność: wyłączenie w panelu `/admin/koszty` pobierania stron przez LiteScrape (`use_fetch`) przenosi `probe`,
`crawl-deep` i `contacts` na własnego robota (0 USD, wolniej). Zostaje wyszukiwanie i Mapy: ok. 560 zapytań, czyli ok. 0,08 USD.
Pomiary AI (`geo-measure`, `ai-check`) nie są wliczone.

Przed startem: zgoda właściciela na budżet (np. 2 USD na próbkę), ustawienie limitu w `settings.api_usage`, podgląd w
`/admin/koszty`.

## 4. Uwagi prawne (do potwierdzenia w opinii prawnej przed publikacją)

To jest moja wiedza ogólna, nie opinia prawna.

- **Doradca podatkowy to zawód regulowany** (osobna ustawa i zasady etyki zawodowej, w tym ograniczenia dotyczące
  reklamy). Fraza `kancelaria podatkowa` jest w wyszukiwaniu, ale wpisy doradców podatkowych trzeba oznaczać osobnym polem
  i nie sprzedawać im pozycji w rankingu ani reklamy, dopóki nie ma opinii prawnej. Podobnie jak przy kancelariach
  prawnych (pozycja 16 w `DECISIONS.md`).
- **Ubezpieczenie OC**: z mojej wiedzy jest obowiązkowe dla przedsiębiorców świadczących usługi księgowe (ustawa o
  rachunkowości). Dokładny przepis i minimalną sumę gwarancyjną trzeba potwierdzić. W portalu pokazujemy wyłącznie to, co
  firma deklaruje na swojej stronie, z cytatem (parametr `ubezpieczenie_oc`). Brak informacji nie oznacza braku polisy,
  więc nie wolno pisać, że firma jest nieubezpieczona.
- **Uprawnienia i certyfikaty** (certyfikat księgowy, członkostwo w stowarzyszeniu): tak samo, tylko deklaracje ze strony
  z cytatem. Prompt `describe.md` zabrania pisać "licencjonowane" lub "certyfikowane" bez faktu w paczce.
- **Dane osobowe**: wiele biur to jednoosobowe działalności, a więc osoby fizyczne. Zasady z `docs/PLAN.md` sekcja 13
  (dane firmowe z rejestru, powiadomienia z art. 14 RODO, brak prywatnych adresów i telefonów) obowiązują bez zmian.
- **Treści opisowe**: bez obietnic skutków podatkowych i bez superlatywów (reguły w `describe.md`).
- **Pokrycie rejestru**: PKD 69.20.Z nie wyczerpuje branży (część biur ma inny główny kod), więc zgodność PKD wzmacnia
  wynik weryfikacji, ale jej brak nie odrzuca firmy.

## 5. Następne kroki

1. Zgoda właściciela na budżet próbki i zakup domeny.
2. ~~Rozwiązać blokery 1 i 2 z sekcji 2~~ (zrobione, migracja `0021` do zastosowania przez właściciela bazy).
3. Próbka w 2-3 miastach, zestaw wzorcowy (`golden/README.md`), pomiar precyzji klasyfikatora, uzupełnienie `blocklist`.
4. Dodać `abonament` do słów cenowych, słowa nazw (`ksiegowosc`, `rachunkowe`) do `names.py`.
5. Silnik wielu branż w `apps/web` (osobne zadanie, `TASKS.md`).
