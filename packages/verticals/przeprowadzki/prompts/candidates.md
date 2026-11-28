# Zadanie dla Claude Code: kandydaci z wyszukiwarki (bez klucza API), branża firmy przeprowadzkowe

Zbierasz wyniki wyszukiwania dla jednego miasta własnym narzędziem WebSearch i zapisujesz je w pliku, który pipeline
importuje jako źródło `file` (`katalog discover --vertical przeprowadzki --provider file`). Format pliku opisuje
`apps/worker/katalog_worker/search/file.py`. To ścieżka zapasowa: podstawą jest automat z LiteScrape, a WebSearch nie
generuje kosztów w płatnych API.

## Które miasta

Plik `queue/cities.json` (po `bash scripts/queue_sync.sh pull`) zawiera miasta włączone w panelu admina, w kolejności
szukania. Weź **3 pierwsze miasta do zrobienia**, gdzie "do zrobienia" znaczy:

- miasto ma `deep_requested_at` (zlecone w panelu) i w `queue/candidates/` nie ma pliku `<slug>-<data>-deep.json`
  z datą równą lub późniejszą niż data zlecenia, albo
- miasto ma `deep: true` i nie ma żadnego pliku `<slug>-*-deep.json`, albo
- w `queue/candidates/` nie ma żadnego pliku zaczynającego się od `<slug>-`.

Jeśli `queue/cities.json` nie istnieje, użyj `packages/verticals/przeprowadzki/cities.txt` (slug: małe litery, bez
polskich znaków, spacje jako myślnik).

W mniejszych miastach zapytania zwracają mniej firm: to normalne. Zapisz wyniki tak samo, nawet jeśli jest ich mało.

## Dokładne przeszukiwanie (deep)

Dla miast z `deep: true` albo `deep_requested_at` rób **około 25 zapytań** zamiast 7: 7 zapytań podstawowych z sekcji niżej
oraz zapytania tematyczne: `przeprowadzki międzynarodowe MIASTO`, `pakowanie i magazynowanie MIASTO przeprowadzki`, `utylizacja mebli przeprowadzka MIASTO`, `tanie przeprowadzki MIASTO`, `przeprowadzki okolice MIASTA (3-5 miejscowości pod miastem)`.

Plik zapisz jako `queue/candidates/<slug>-<RRRR-MM-DD>-deep.json` (ten sam format, wszystkie zapytania w jednej
liście `queries`).

## Zapytania

7 zapytań, wszystkie z wykluczeniem portali, katalogów i serwisów informacyjnych (parametr `blocked_domains` narzędzia
WebSearch), tryb `standard`. Wzory (MIASTO zastąp nazwą miasta):

1. `firma przeprowadzkowa MIASTO przeprowadzki o nas kontakt`
2. `przeprowadzki mieszkań MIASTO cennik firma`
3. `transport mebli MIASTO przeprowadzka ekipa`
4. `przeprowadzki biur MIASTO firma przeprowadzkowa`
5. `transport pianina MIASTO przeprowadzki`
6. `przeprowadzki z dźwigiem wniesienie MIASTO`
7. `przeprowadzki MIASTO ubezpieczenie OC cena za godzinę`

`blocked_domains`: panoramafirm.pl, aleo.com, pkt.pl, zumi.pl, oferteo.pl, fixly.pl, gov.pl, olx.pl, pracuj.pl, aplikuj.pl, facebook.com, linkedin.com, wikipedia.org, youtube.com, trans.eu, timocom.com, oferia.pl (lista startowa, do uzupełnienia po przeglądzie próbki wzorcowej)

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
