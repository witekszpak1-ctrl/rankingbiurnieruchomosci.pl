# katalog

Platforma katalogów firm pod wyszukiwarki AI. Pierwsza branża: biura nieruchomości (`rankingbiurnieruchomosci.pl`,
cała Polska w rozbiciu na miasta). Pełny plan: [docs/PLAN.md](docs/PLAN.md).

## Co jest zrobione (F0 i F1, bez strony publicznej i panelu)

- `db/migrations/0001_init.sql`: schemat rdzenia (branże, miasta, podmioty, domeny, fakty, ceny, opisy, kolejka, przebiegi).
- `apps/worker`: worker w Pythonie. Pipeline S1-S7, klienci rejestrów, adaptery wyszukiwania, walidator wyników.
- `packages/verticals/nieruchomosci`: konfiguracja branży, prompty dla Claude Code, szablony zestawu wzorcowego.
- `apps/web`: pusty katalog na stronę publiczną i panel admina (F2/F3).

## Uruchomienie

```bash
cd apps/worker
python3 -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
python -m pytest            # testy bazy wymagają lokalnego Postgresa, patrz niżej
```

Testy bazy używają `TEST_ADMIN_URL` (domyślnie `postgresql://postgres@127.0.0.1:54329/postgres`) i tworzą w tym
serwerze tymczasowe bazy. Bez serwera testy bazy są pomijane. Konfiguracja produkcyjna: skopiuj `.env.example` do `.env`.

## Pipeline

Każdy etap to osobne polecenie (`katalog --help`). Kolejność:

| Polecenie | Etap | Co robi |
|---|---|---|
| `katalog migrate` | | stosuje migracje (wymaga `DATABASE_URL`) |
| `katalog discover --city Wrocław --provider brave` | S1 | zapytania -> domeny kandydatów |
| `katalog probe` | S3 | strona główna i kontakt, klasyfikacja heurystyczna |
| `katalog verify` | S4 | NIP ze strony -> biała lista VAT i KRS -> weryfikacja domeny |
| `katalog crawl-deep` | S5 | kolejne podstrony zweryfikowanych domen |
| `katalog bundle` | S6 | paczki dla Claude Code w `queue/pending/` |
| `katalog import` | S7 | walidacja wyników z `queue/results/` i zapis w bazie |
| `katalog status` | | liczby rekordów według statusów |
| `katalog validate --bundle B --result R` | | walidacja jednego wyniku (kod wyjścia 0 = OK) |
| `katalog ab-search --csv entities.csv` | | test A/B dostawców wyszukiwania |

## Kolejka dla Claude Code

`katalog bundle` zapisuje paczki JSON (bez e-maili i telefonów) do `queue/pending/<typ>/<id>.json`.
Claude Code czyta je według instrukcji z `packages/verticals/nieruchomosci/prompts/` i zapisuje wyniki do
`queue/results/<typ>/<id>.json`. `katalog import` waliduje wynik w kodzie: cytaty muszą występować w źródle, każde
zdanie opisu wskazuje fakty, opis nie kopiuje źródła, liczby i tryb VAT w cenach zgadzają się z cytatem.
Katalogi `queue/` i `snapshots/` są w `.gitignore` (dane trzymamy poza repozytorium kodu).

## Zasady

- Do katalogu trafiają tylko firmy ze zweryfikowaną stroną (NIP ze strony zgodny z rejestrem).
- Zapisujemy tylko dane firmowe. Z białej listy VAT odrzucamy przedstawicieli, PESEL i rachunki, z KRS nie czytamy
  działu z osobami. Dla osób fizycznych bez adresu działalności zachowujemy tylko miasto i kod pocztowy.
- Crawler respektuje robots.txt, ma własny User-Agent z kontaktem i odstęp między zapytaniami do jednego hosta.

## Stan weryfikacji

Przetestowane: schemat bazy (lokalny Postgres 16), moduły ekstrakcji i weryfikacji, walidator, przepływ S1-S7 z
atrapami, klienci KRS i białej listy VAT także na żywych API (jedno zapytanie każdy).
Nieprzetestowane na żywo: adaptery Brave i Serper (kontrakt z pamięci, brak kluczy), crawler na prawdziwych stronach,
Crawl4AI (nie jest jeszcze użyty, fetcher używa httpx bez renderowania JS), workflow GitHub Actions, CEIDG.
Baza Neon: nie utworzona (konto zarządzane przez Vercel), migracja nie jest zastosowana.
