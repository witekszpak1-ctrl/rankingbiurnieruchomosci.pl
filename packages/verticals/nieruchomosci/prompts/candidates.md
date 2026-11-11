# Zadanie dla Claude Code: kandydaci z wyszukiwarki (bez klucza API)

Zbierasz wyniki wyszukiwania dla jednego miasta własnym narzędziem WebSearch i zapisujesz je w pliku, który pipeline
importuje jako źródło `file` (`katalog discover --provider file`). Format pliku opisuje `apps/worker/katalog_worker/search/file.py`.

## Które miasta

Plik `queue/cities.json` (po `bash scripts/queue_sync.sh pull`) zawiera miasta włączone w panelu admina, w kolejności
szukania. Weź **3 pierwsze miasta do zrobienia**, gdzie "do zrobienia" znaczy:

- miasto ma `deep_requested_at` (zlecone w panelu) i w `queue/candidates/` nie ma pliku `<slug>-<data>-deep.json`
  z datą równą lub późniejszą niż data zlecenia, albo
- miasto ma `deep: true` i nie ma żadnego pliku `<slug>-*-deep.json`, albo
- w `queue/candidates/` nie ma żadnego pliku zaczynającego się od `<slug>-`.

Jeśli `queue/cities.json` nie istnieje, użyj `packages/verticals/nieruchomosci/cities.txt` (slug: małe litery, bez
polskich znaków, spacje jako myślnik).

W mniejszych miastach zapytania zwracają mniej biur: to normalne. Zapisz wyniki tak samo, nawet jeśli jest ich mało.

## Dokładne przeszukiwanie (deep)

Dla miast z `deep: true` albo `deep_requested_at` rób **około 50 zapytań** zamiast 7, żeby znaleźć jak najwięcej biur:

- dla każdej dzielnicy (w dużych miastach także popularnych osiedli) dwa zapytania:
  `biuro nieruchomości MIASTO DZIELNICA` oraz `agencja nieruchomości DZIELNICA MIASTO sprzedaż wynajem`,
- do tego 7 zapytań podstawowych z sekcji niżej oraz zapytania tematyczne: `pośrednik nieruchomości MIASTO`,
  `biuro nieruchomości MIASTO rynek pierwotny`, `biuro nieruchomości MIASTO domy działki`,
  `nieruchomości komercyjne MIASTO agencja`, `zarządzanie najmem MIASTO`, `wycena nieruchomości MIASTO biuro`,
  `biuro nieruchomości MIASTO licencja PFRN`, `biuro nieruchomości okolice MIASTA` (z 3-5 miejscowościami pod miastem).

Dzielnice bierz z wiedzy ogólnej (np. Warszawa: 18 dzielnic). Zapytania możesz rozdzielić na 3-4 subagentów
równolegle. Plik zapisz jako `queue/candidates/<slug>-<RRRR-MM-DD>-deep.json` (ten sam format, wszystkie zapytania
w jednej liście `queries`).

## Zapytania

7 zapytań, wszystkie z wykluczeniem portali i katalogów (parametr `blocked_domains` narzędzia WebSearch), tryb `standard`.
Wzory (MIASTO zastąp nazwą miasta):

1. `biuro nieruchomości MIASTO oferty sprzedaż mieszkań o nas kontakt`
2. `wynajem mieszkań MIASTO biuro nieruchomości oferta`
3. `agencja nieruchomości MIASTO sprzedaż domów oferty biuro`
4. `pośrednictwo nieruchomości MIASTO działki budowlane oferty biuro nieruchomości`
5. `nieruchomości komercyjne MIASTO biuro lokale użytkowe wynajem pośrednik`
6. `biuro nieruchomości MIASTO dzielnice sprzedaż wynajem` (dopisz 2-3 nazwy dzielnic, jeśli je znasz)
7. `biuro nieruchomości MIASTO zarządzanie najmem prowizja`

`blocked_domains`: otodom.pl, sonarhome.pl, aplikuj.pl, pracuj.pl, compabase.com, panoramafirm.pl, rankingpro.pl, gov.pl,
olx.pl, gratka.pl, domiporta.pl, morizon.pl, oferteo.pl, facebook.com, linkedin.com, wikipedia.org, youtube.com,
krs-online.com.pl, aleo.com, pkt.pl, zumi.pl, nieruchomosci-online.pl, tabelaofert.pl, okolica.pl, bazabiur.pl

## Plik

`queue/candidates/<slug-miasta>-<RRRR-MM-DD>.json`:

```json
{
  "city": "Kraków",
  "collected_at": "2026-11-12",
  "source": "Claude Code, narzędzie WebSearch (tryb standard)",
  "notes": "Zapytania z wykluczonymi portalami i katalogami. Wyniki w kolejności zwróconej przez narzędzie, bez ręcznej selekcji.",
  "queries": [
    {"query": "dokładny tekst zapytania", "results": [{"url": "https://...", "title": "..."}]}
  ]
}
```

Zapisuj adresy dokładnie tak, jak zwróciło je narzędzie, w tej samej kolejności, bez dopisywania wyników z pamięci.
Na koniec: `bash scripts/queue_sync.sh push-candidates`.
