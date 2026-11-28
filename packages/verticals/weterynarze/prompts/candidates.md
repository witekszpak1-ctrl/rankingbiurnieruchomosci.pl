# Zadanie dla Claude Code: kandydaci z wyszukiwarki (bez klucza API), branża kliniki weterynaryjne

Zbierasz wyniki wyszukiwania dla jednego miasta własnym narzędziem WebSearch i zapisujesz je w pliku, który pipeline
importuje jako źródło `file` (`katalog discover --vertical weterynarze --provider file`). Format pliku opisuje
`apps/worker/katalog_worker/search/file.py`. To ścieżka zapasowa: podstawą jest automat z LiteScrape, a WebSearch nie
generuje kosztów w płatnych API.

## Które miasta

Plik `queue/cities.json` (po `bash scripts/queue_sync.sh pull`) zawiera miasta włączone w panelu admina, w kolejności
szukania. Weź **3 pierwsze miasta do zrobienia**, gdzie "do zrobienia" znaczy:

- miasto ma `deep_requested_at` (zlecone w panelu) i w `queue/candidates/` nie ma pliku `<slug>-<data>-deep.json`
  z datą równą lub późniejszą niż data zlecenia, albo
- miasto ma `deep: true` i nie ma żadnego pliku `<slug>-*-deep.json`, albo
- w `queue/candidates/` nie ma żadnego pliku zaczynającego się od `<slug>-`.

Jeśli `queue/cities.json` nie istnieje, użyj `packages/verticals/weterynarze/cities.txt` (slug: małe litery, bez
polskich znaków, spacje jako myślnik).

W mniejszych miastach zapytania zwracają mniej firm: to normalne. Zapisz wyniki tak samo, nawet jeśli jest ich mało.

## Dokładne przeszukiwanie (deep)

Dla miast z `deep: true` albo `deep_requested_at` rób **około 25 zapytań** zamiast 7: 7 zapytań podstawowych z sekcji niżej
oraz zapytania tematyczne: `sterylizacja kotki MIASTO weterynarz`, `szczepienie psa MIASTO weterynarz`, `stomatologia weterynaryjna MIASTO`, `weterynarz MIASTO DZIELNICA (po jednej frazie na dzielnicę, 3 strony)`, `weterynarz okolice MIASTA (3-5 miejscowości pod miastem)`.

Plik zapisz jako `queue/candidates/<slug>-<RRRR-MM-DD>-deep.json` (ten sam format, wszystkie zapytania w jednej
liście `queries`).

## Zapytania

7 zapytań, wszystkie z wykluczeniem portali, katalogów i serwisów informacyjnych (parametr `blocked_domains` narzędzia
WebSearch), tryb `standard`. Wzory (MIASTO zastąp nazwą miasta):

1. `klinika weterynaryjna MIASTO weterynarz o nas kontakt`
2. `weterynarz MIASTO cennik wizyta szczepienia`
3. `lecznica dla zwierząt MIASTO gabinet weterynaryjny`
4. `weterynarz całodobowy MIASTO nagłe przypadki`
5. `weterynarz MIASTO chirurgia USG RTG diagnostyka`
6. `weterynarz dla zwierząt egzotycznych MIASTO`
7. `weterynarz z dojazdem MIASTO wizyty domowe`

`blocked_domains`: panoramafirm.pl, aleo.com, pkt.pl, zumi.pl, oferteo.pl, fixly.pl, gov.pl, olx.pl, pracuj.pl, aplikuj.pl, facebook.com, linkedin.com, wikipedia.org, youtube.com, znanylekarz.pl, zooplus.pl, zooart.com.pl, krakvet.pl, oferia.pl (lista startowa, do uzupełnienia po przeglądzie próbki wzorcowej)

## Plik

`queue/candidates/<slug-miasta>-<RRRR-MM-DD>.json`:

```json
{
  "city": "Kraków",
  "collected_at": "2026-11-12",
  "source": "Claude Code, narzędzie WebSearch (tryb standard)",
  "notes": "Zapytania z wykluczonymi portalami, katalogami i serwisami informacyjnymi. Wyniki w kolejności zwróconej przez narzędzie, bez ręcznej selekcji.",
  "queries": [
    {"query": "dokładny tekst zapytania", "results": [{"url": "https://...", "title": "..."}]}
  ]
}
```

Zapisuj adresy dokładnie tak, jak zwróciło je narzędzie, w tej samej kolejności, bez dopisywania wyników z pamięci.
Na koniec: `bash scripts/queue_sync.sh push-candidates`.
