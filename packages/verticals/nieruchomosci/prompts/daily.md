# Praca Claude Code (uruchamiana z harmonogramu co 2 godziny, tryb szybki)

Pipeline na GitHub Actions co noc buduje paczki opisów i publikuje gotowe wpisy, a workflow `import` co 3 godziny
zapisuje w bazie wyniki z gałęzi `queue-data` prywatnego repozytorium `witekszpak1-ctrl/rankingbiur-kolejka`. Ta sesja robi część, której nie da się zrobić bez modelu: pisze opisy
i zbiera kandydatów z kolejnego miasta. Nic nie wymaga klikania przez człowieka.

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
   gdy pliku nie ma, `packages/verticals/nieruchomosci/prompts/describe.md`), zapisać wynik
   w `queue/results/describe/<firm_id>.json`, sprawdzić go poleceniem
   `cd apps/worker && . .venv/bin/activate && katalog validate --bundle <paczka> --result <wynik>` (kod 0 = poprawny),
   poprawić najwyżej 3 razy. Paczkę, która nie dotyczy biura nieruchomości (deweloper, portal, urząd lub BIP, rzeczoznawca bez pośrednictwa,
   zarządca wspólnot lub firma tylko od zarządzania nieruchomościami, bez sprzedaży i wynajmu, firma z innej branży),
   pominąć: zamiast wyniku zapisać `queue/results/skipped/describe/<firm_id>.json` z treścią
   `{"reason": "krótki powód"}`. Import zamknie wtedy to zadanie i paczka nie wróci następnego dnia.
3. Po zakończeniu agentów sprawdź sam każdy wynik walidatorem. Wyniki niepoprawne usuń (paczka wróci jutro).
4. `bash scripts/queue_sync.sh push-results`

## 2. Szukanie nowych biur

Nie szukasz. Biura w kolejnych miastach wyszukuje automat GitHub przez Serper (wyniki Google), 15 miast co 3 godziny.
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
wyników, uruchom narzędziem GitHub (actions_run_trigger, method run_workflow, ref main) workflow `pipeline.yml`:
zapisze opisy, opublikuje firmy, przeszuka kolejne miasta przez Serper i przygotuje nowe paczki. W sesji, która startuje
między 6:00 a 7:59 czasu polskiego, uruchom też `offers.yml` (oferty, kontakty, opinie Google). Nie uruchamiaj, jeśli
ten sam workflow jest już w kolejce lub trwa (sprawdź actions_list, list_workflow_runs, status queued/in_progress).

## Zasady

- Nie zmieniaj kodu ani gałęzi `main`. Piszesz tylko do gałęzi `queue-data` repozytorium kolejki
  (`witekszpak1-ctrl/rankingbiur-kolejka`) przez `scripts/queue_sync.sh`. Jeśli skrypt nie ma dostępu do tego
  repozytorium, napisz to w podsumowaniu i zakończ, niczego nie wysyłając gdzie indziej.
- Nie używaj długich myślników (U+2013, U+2014) w żadnym tekście.
- Na końcu krótko podsumuj: ile paczek opisano, ile pominięto i dlaczego, które miasta zebrano i ile domen w każdym.
