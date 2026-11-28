# Zadanie dla Claude Code: kandydaci z wyszukiwarki (bez klucza API), branża biura rachunkowe

Zbierasz wyniki wyszukiwania dla jednego miasta własnym narzędziem WebSearch i zapisujesz je w pliku, który pipeline
importuje jako źródło `file` (`katalog discover --vertical rachunkowe --provider file`). Format pliku opisuje
`apps/worker/katalog_worker/search/file.py`. To ścieżka zapasowa: podstawą jest automat z LiteScrape, a WebSearch nie
generuje kosztów w płatnych API.

## Które miasta

Plik `queue/cities.json` (po `bash scripts/queue_sync.sh pull`) zawiera miasta włączone w panelu admina, w kolejności
szukania. Weź **3 pierwsze miasta do zrobienia**, gdzie "do zrobienia" znaczy:

- miasto ma `deep_requested_at` (zlecone w panelu) i w `queue/candidates/` nie ma pliku `<slug>-<data>-deep.json`
  z datą równą lub późniejszą niż data zlecenia, albo
- miasto ma `deep: true` i nie ma żadnego pliku `<slug>-*-deep.json`, albo
- w `queue/candidates/` nie ma żadnego pliku zaczynającego się od `<slug>-`.

Jeśli `queue/cities.json` nie istnieje, użyj `packages/verticals/rachunkowe/cities.txt` (slug: małe litery, bez
polskich znaków, spacje jako myślnik).

W mniejszych miastach zapytania zwracają mniej biur: to normalne. Zapisz wyniki tak samo, nawet jeśli jest ich mało.

## Dokładne przeszukiwanie (deep)

Dla miast z `deep: true` albo `deep_requested_at` rób **około 25 zapytań** zamiast 7. Biura rachunkowe obsługują klientów
zdalnie, więc dzielnice nic nie wnoszą. Zamiast nich:

- 7 zapytań podstawowych z sekcji niżej oraz zapytania tematyczne: `księgowa MIASTO`, `usługi księgowe MIASTO`,
  `księgowość dla firm MIASTO`, `biuro rachunkowe MIASTO kadry i płace`, `biuro rachunkowe MIASTO spółki z o.o.`,
  `biuro rachunkowe MIASTO e-commerce`, `biuro rachunkowe MIASTO KSeF`, `biuro rachunkowe MIASTO ryczałt`,
  `biuro rachunkowe MIASTO cennik`, `kancelaria podatkowa MIASTO` (doradcy podatkowi to zawód regulowany: wyniki
  zbieraj, ale oznacz je w `notes`), `biuro rachunkowe okolice MIASTA` (z 3-5 miejscowościami pod miastem).

Plik zapisz jako `queue/candidates/<slug>-<RRRR-MM-DD>-deep.json` (ten sam format, wszystkie zapytania w jednej
liście `queries`).

## Zapytania

7 zapytań, wszystkie z wykluczeniem portali, katalogów i oprogramowania księgowego (parametr `blocked_domains` narzędzia
WebSearch), tryb `standard`. Wzory (MIASTO zastąp nazwą miasta):

1. `biuro rachunkowe MIASTO księgowość o nas kontakt`
2. `księgowość KPiR ryczałt MIASTO biuro rachunkowe cennik`
3. `pełna księgowość spółki MIASTO biuro rachunkowe oferta`
4. `kadry i płace MIASTO biuro rachunkowe usługi`
5. `księgowość JDG MIASTO abonament biuro rachunkowe`
6. `księgowość e-commerce MIASTO biuro rachunkowe`
7. `biuro rachunkowe MIASTO rozliczenia VAT KSeF doradca podatkowy`

`blocked_domains`: panoramafirm.pl, aleo.com, pkt.pl, zumi.pl, oferteo.pl, fixly.pl, rankingpro.pl, gov.pl, olx.pl,
pracuj.pl, aplikuj.pl, facebook.com, linkedin.com, wikipedia.org, youtube.com, krs-online.com.pl, infakt.pl, wfirma.pl,
ifirma.pl, fakturownia.pl, saldeo.pl, ksiegowosc.infor.pl, poradnikprzedsiebiorcy.pl, gofin.pl, podatki.gov.pl, ceidg.gov.pl
(lista startowa, do uzupełnienia po przeglądzie próbki wzorcowej)

## Plik

`queue/candidates/<slug-miasta>-<RRRR-MM-DD>.json`:

```json
{
  "city": "Kraków",
  "collected_at": "2026-11-12",
  "source": "Claude Code, narzędzie WebSearch (tryb standard)",
  "notes": "Zapytania z wykluczonymi portalami, katalogami i oprogramowaniem księgowym. Wyniki w kolejności zwróconej przez narzędzie, bez ręcznej selekcji.",
  "queries": [
    {"query": "dokładny tekst zapytania", "results": [{"url": "https://...", "title": "..."}]}
  ]
}
```

Zapisuj adresy dokładnie tak, jak zwróciło je narzędzie, w tej samej kolejności, bez dopisywania wyników z pamięci.
Na koniec: `bash scripts/queue_sync.sh push-candidates`.
