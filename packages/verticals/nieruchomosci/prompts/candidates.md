# Zadanie dla Claude Code: kandydaci z wyszukiwarki (bez klucza API)

Zbierasz wyniki wyszukiwania dla jednego miasta własnym narzędziem WebSearch i zapisujesz je w pliku, który pipeline
importuje jako źródło `file` (`katalog discover --provider file`). Format pliku opisuje `apps/worker/katalog_worker/search/file.py`.

## Które miasto

Pierwsze miasto z `packages/verticals/nieruchomosci/cities.txt`, dla którego w `queue/candidates/` (po
`bash scripts/queue_sync.sh pull`) nie ma pliku zaczynającego się od jego sluga (małe litery, bez polskich znaków,
spacje jako myślnik, np. `wroclaw-`, `zielona-gora-`).

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
