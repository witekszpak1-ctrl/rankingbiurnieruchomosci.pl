# Codzienna praca Claude Code (uruchamiana z harmonogramu)

Pipeline na GitHub Actions co noc buduje paczki opisów i publikuje gotowe wpisy, a workflow `import` co 3 godziny
zapisuje w bazie wyniki z gałęzi `queue-data`. Ta sesja robi część, której nie da się zrobić bez modelu: pisze opisy
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
   w `queue/results/describe/`. Maksymalnie 60 na jedną sesję.
2. Rozdziel je na subagentów (narzędzie Agent), po 3 paczki na agenta, kilku równolegle. Każdy agent dostaje ścieżki
   swoich paczek i instrukcję: przeczytać `packages/verticals/nieruchomosci/prompts/describe.md`, zapisać wynik
   w `queue/results/describe/<firm_id>.json`, sprawdzić go poleceniem
   `cd apps/worker && . .venv/bin/activate && katalog validate --bundle <paczka> --result <wynik>` (kod 0 = poprawny),
   poprawić najwyżej 3 razy, a paczkę, która nie dotyczy biura nieruchomości, pominąć bez pliku wyniku.
3. Po zakończeniu agentów sprawdź sam każdy wynik walidatorem. Wyniki niepoprawne usuń.
4. `bash scripts/queue_sync.sh push-results`

## 2. Kandydaci z kolejnego miasta

Według `packages/verticals/nieruchomosci/prompts/candidates.md`: jedno miasto na sesję, potem
`bash scripts/queue_sync.sh push-candidates`.

## Zasady

- Nie zmieniaj kodu ani gałęzi `main`. Piszesz tylko do gałęzi `queue-data` przez `scripts/queue_sync.sh`.
- Nie używaj długich myślników (U+2013, U+2014) w żadnym tekście.
- Na końcu krótko podsumuj: ile paczek opisano, ile pominięto i dlaczego, które miasto zebrano i ile domen.
