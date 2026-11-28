# Praca Claude Code (3 razy dziennie, świeża sesja na Sonnecie 5.5): branża biura rachunkowe

Gdy nie ma paczek do opisania, nie instaluj niczego i nie uruchamiaj subagentów: zapisz raport z described 0
i uruchom automat (sekcja 4). Oszczędzaj tokeny.

Pipeline na GitHub Actions co noc buduje paczki opisów i publikuje gotowe wpisy, a workflow `import` co 3 godziny
zapisuje w bazie wyniki z gałęzi `queue-data` prywatnego repozytorium kolejki. Ta sesja robi część, której nie da się
zrobić bez modelu: pisze opisy i (wyjątkowo) zbiera kandydatów z kolejnego miasta. Nic nie wymaga klikania przez człowieka.
Wszystkie polecenia `katalog` dla tej branży uruchamiasz z opcją `--vertical rachunkowe`.

## Przygotowanie

Repozytorium `witekszpak1-ctrl/rankingbiurnieruchomosci.pl` jest sklonowane w katalogu roboczym sesji
(sprawdź `git remote -v`). W jego katalogu głównym:

```bash
git checkout main && git pull origin main      # najnowszy kod i instrukcje
cd apps/worker && python3 -m venv .venv && . .venv/bin/activate && pip install -q -e . && cd ../..
bash scripts/queue_sync.sh pull
```

## 1. Opisy

1. Paczki do zrobienia: pliki `queue/pending/describe/*.json`, dla których nie ma pliku o tej samej nazwie
   ani w `queue/results/describe/`, ani w `queue/results/skipped/describe/`. Maksymalnie 300 na jedną sesję. Przy dużej liczbie paczek wysyłaj
   wyniki partiami (`bash scripts/queue_sync.sh push-results` po każdej partii około 30), żeby import nie czekał na koniec sesji.
2. Rozdziel je na subagentów (narzędzie Agent z parametrem `model: "sonnet"`, czyli Claude Sonnet: tańszy i szybszy,
   a walidator i tak odrzuca zły opis), po 4-5 paczek na agenta, do 8 równolegle. Każdy agent dostaje ścieżki
   swoich paczek i instrukcję: przeczytać prompt opisów `queue/prompts/describe.md` (wersja ustawiona w panelu;
   gdy pliku nie ma, `packages/verticals/rachunkowe/prompts/describe.md`), zapisać wynik
   w `queue/results/describe/<firm_id>.json`, sprawdzić go poleceniem
   `cd apps/worker && . .venv/bin/activate && katalog validate --bundle <paczka> --result <wynik>` (kod 0 = poprawny),
   poprawić najwyżej 3 razy. Paczkę, która nie dotyczy biura rachunkowego (oprogramowanie księgowe, portal lub
   porównywarka, szkolenia i kursy, urząd lub BIP, kancelaria prawna bez usług księgowych i podatkowych, firma
   rekrutująca księgowych, firma z innej branży), pominąć: zamiast wyniku zapisać
   `queue/results/skipped/describe/<firm_id>.json` z treścią `{"reason": "krótki powód"}`. Import zamknie wtedy to
   zadanie i paczka nie wróci następnego dnia. Doradcy podatkowi i kancelarie podatkowe z własną ofertą nie są
   powodem do pominięcia (zawód regulowany: oznaczenie robi pole wpisu, nie ty).
3. Po zakończeniu agentów sprawdź sam każdy wynik walidatorem. Wyniki niepoprawne usuń (paczka wróci jutro).
4. `bash scripts/queue_sync.sh push-results`

## 2. Szukanie nowych biur

Nie szukasz. Biura w kolejnych miastach wyszukuje automat GitHub przez LiteScrape (wyniki Google, w zapasie Serper),
15 miast na przebieg.
Plik kandydatów zbierasz narzędziem WebSearch według `prompts/candidates.md` tylko wtedy, gdy w `queue/cities.json`
jest miasto z `deep_requested_at` późniejszym niż `last_searched_at`, a od zlecenia minęło ponad 6 godzin (automat
z jakiegoś powodu go nie przeszukał).

## 3. Raport sesji (widoczny w panelu, zakładka Automat)

Na samym początku sesji zapamiętaj czas startu (`date -u +%Y-%m-%dT%H:%M:%SZ`). Na końcu zapisz
`queue/results/sessions/<RRRR-MM-DD>T<GGMM>.json` (data i godzina startu w UTC, np. `2026-11-11T0941.json`):

```json
{
  "started_at": "2026-11-11T09:41:05Z",
  "finished_at": "2026-11-11T10:32:40Z",
  "status": "ok",
  "described": 42,
  "skipped": 3,
  "cities": [],
  "errors": []
}
```

`domains` to liczba różnych domen w pliku kandydatów miasta. Gdy coś się nie udało, `"status": "failed"` i opis
w `errors` (lista obiektów `{"message": "..."}`). Potem `bash scripts/queue_sync.sh push-results`.

## 4. Uruchomienie automatu GitHub

Harmonogram GitHub Actions w tym repozytorium się nie uruchamia, więc to sesja go zastępuje. Na koniec, po wysłaniu
wyników, uruchom workflow `pipeline.yml` przez REST API (GraphQL jest niedostępny):
`gh api -X POST repos/witekszpak1-ctrl/rankingbiurnieruchomosci.pl/actions/workflows/pipeline.yml/dispatches -f ref=main`.
Zapisze opisy, opublikuje firmy, przeszuka kolejne miasta przez LiteScrape i przygotuje nowe paczki. Workflow `offers.yml`
dla tej branży uruchamiasz tylko po to, by zebrać kontakty i oceny z Map Google (to płatne zapytania LiteScrape, więc
wyłącznie w zakresie zgody właściciela); etap ofert nie dotyczy biur rachunkowych. Nie uruchamiaj
workflow, jeśli ten sam jest już w kolejce lub trwa:
`gh api "repos/witekszpak1-ctrl/rankingbiurnieruchomosci.pl/actions/workflows/<plik>/runs?per_page=5" --jq '.workflow_runs[] | .status'`
(status queued albo in_progress).

## Zasady

- Nie zmieniaj kodu ani gałęzi `main`. Piszesz tylko do gałęzi `queue-data` repozytorium kolejki
  (`witekszpak1-ctrl/rankingbiur-kolejka`) przez `scripts/queue_sync.sh`. Jeśli skrypt nie ma dostępu do tego
  repozytorium, napisz to w podsumowaniu i zakończ, niczego nie wysyłając gdzie indziej.
- Nie wywołuj płatnych API (LiteScrape, Serper, Brave) poza tym, co robi automat. Nowe zapytania wymagają zgody właściciela.
- Nie używaj długich myślników (U+2013, U+2014) w żadnym tekście.
- Na końcu krótko podsumuj: ile paczek opisano, ile pominięto i dlaczego, które miasta zebrano i ile domen w każdym.
