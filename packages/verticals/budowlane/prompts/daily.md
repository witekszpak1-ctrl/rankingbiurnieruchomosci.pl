# Praca Claude Code (świeża sesja na Sonnecie 5.5): branża firmy budowlane (budowa domów)

Gdy nie ma paczek do opisania, nie instaluj niczego i nie uruchamiaj subagentów: zapisz raport z described 0
i zakończ. Oszczędzaj tokeny. Wszystkie polecenia `katalog` dla tej branży uruchamiasz z opcją `--vertical budowlane`.

Branża nie ma harmonogramu: sesję i zbieranie uruchamia człowiek po zgodzie właściciela na budżet (docs/geo/branze-3-8.md).

## Przygotowanie

Repozytorium `witekszpak1-ctrl/rankingbiurnieruchomosci.pl` jest sklonowane w katalogu roboczym sesji
(sprawdź `git remote -v`). W jego katalogu głównym:

```bash
git checkout main && git pull origin main      # najnowszy kod i instrukcje
cd apps/worker && python3 -m venv .venv && . .venv/bin/activate && pip install -q -e . && cd ../..
bash scripts/queue_sync.sh pull
```

## 1. Opisy

1. Paczki do zrobienia: pliki `queue/pending/budowlane/describe/*.json`, dla których nie ma pliku o tej samej nazwie
   ani w `queue/results/budowlane/describe/`, ani w `queue/results/budowlane/skipped/describe/`. Maksymalnie 300 na jedną sesję.
   Przy dużej liczbie paczek wysyłaj wyniki partiami (`bash scripts/queue_sync.sh push-results` po każdej partii około 30).
2. Rozdziel je na subagentów (model Sonnet), po 4-5 paczek na agenta, do 8 równolegle. Każdy agent dostaje ścieżki
   swoich paczek i instrukcję: przeczytać prompt opisów `packages/verticals/budowlane/prompts/describe.md`, zapisać wynik
   w `queue/results/budowlane/describe/<firm_id>.json`, sprawdzić go poleceniem
   `cd apps/worker && . .venv/bin/activate && katalog validate --bundle <paczka> --result <wynik>` (kod 0 = poprawny),
   poprawić najwyżej 3 razy. Paczkę, która nie dotyczy tej branży (deweloper (sprzedaż gotowych mieszkań i domów), pracownia projektowa bez wykonawstwa, sprzedawca projektów gotowych, hurtownia lub skład budowlany, portal z porównywaniem ofert, szkolenia, urząd, firma z innej branży), pominąć: zamiast wyniku zapisać
   `queue/results/budowlane/skipped/describe/<firm_id>.json` z treścią `{"reason": "krótki powód"}`. Import zamknie wtedy to
   zadanie i paczka nie wróci następnego dnia.
3. Po zakończeniu agentów sprawdź sam każdy wynik walidatorem. Wyniki niepoprawne usuń (paczka wróci następnym razem).
4. `bash scripts/queue_sync.sh push-results`

## 2. Szukanie nowych firm

Nie szukasz. Firmy w kolejnych miastach wyszukuje automat GitHub przez LiteScrape (wyniki Google, w zapasie Serper),
za zgodą właściciela na budżet. Plik kandydatów zbierasz narzędziem WebSearch według `prompts/candidates.md` tylko wtedy,
gdy w `queue/cities.json` jest miasto z `deep_requested_at` późniejszym niż `last_searched_at`, a od zlecenia minęło
ponad 6 godzin.

## 3. Raport sesji (widoczny w panelu, zakładka Automat)

Na samym początku sesji zapamiętaj czas startu (`date -u +%Y-%m-%dT%H:%M:%SZ`). Na końcu zapisz
`queue/results/sessions/<RRRR-MM-DD>T<GGMM>.json` (data i godzina startu w UTC):

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

Gdy coś się nie udało, `"status": "failed"` i opis w `errors` (lista obiektów `{"message": "..."}`). Potem
`bash scripts/queue_sync.sh push-results`.

## Zasady

- Nie zmieniaj kodu ani gałęzi `main`. Piszesz tylko do gałęzi `queue-data` repozytorium kolejki
  (`witekszpak1-ctrl/rankingbiur-kolejka`) przez `scripts/queue_sync.sh`. Jeśli skrypt nie ma dostępu do tego
  repozytorium, napisz to w podsumowaniu i zakończ, niczego nie wysyłając gdzie indziej.
- Nie wywołuj płatnych API (LiteScrape, Serper, Brave) poza tym, co robi automat. Nowe zapytania wymagają zgody właściciela.
- Nie używaj długich myślników (U+2013, U+2014) w żadnym tekście.
- Na końcu krótko podsumuj: ile paczek opisano, ile pominięto i dlaczego.
