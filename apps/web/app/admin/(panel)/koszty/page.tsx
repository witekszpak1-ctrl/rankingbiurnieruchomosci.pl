import { apiLimitAction } from "../../actions";
import { getApiUsage, monthKey } from "@/lib/api-usage";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const fmt = (n: number) => n.toLocaleString("pl-PL");

/** Płatne usługi podłączone do serwisu: liczniki z bazy i opis, jak ograniczyć koszty. */
export default async function CostsPage({ searchParams }: Props) {
  const params = await searchParams;
  const ok = typeof params.ok === "string" ? params.ok : null;
  const error = typeof params.error === "string" ? params.error : null;
  const usage = await getApiUsage().catch(() => []);
  const month = monthKey();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Koszty i limity</h1>
          <p className="page-sub">
            Liczniki płatnych API w bieżącym miesiącu ({month}, liczony w UTC) i limity, po których automat przestaje wysyłać
            zapytania. Niżej lista pozostałych usług, za które możesz płacić, i jak je ograniczyć.
          </p>
        </div>
      </div>
      {ok && <div className="alert ok">{ok}</div>}
      {error && <div className="alert bad">{error}</div>}

      {usage.map((u) => {
        const pct = u.limit ? Math.min(100, Math.round((100 * u.used) / Math.max(1, u.limit))) : null;
        const tone = u.limit == null ? "" : u.used >= u.limit ? "bad" : pct != null && pct >= 80 ? "warn" : "ok";
        return (
          <section key={u.key} className="cost-card">
            <h2>{u.label}</h2>
            <div className="kpis compact">
              <div className="kpi">
                <b>
                  {fmt(u.used)}
                  {u.limit != null ? ` / ${fmt(u.limit)}` : ""}
                </b>
                <span>
                  zapytań w tym miesiącu{u.estimated ? " (szacunek z danych, licznik ruszy przy najbliższym przebiegu automatu)" : ""}
                </span>
              </div>
              <div className="kpi">
                <b>{u.limit == null ? "brak" : u.used >= u.limit ? "zatrzymany" : `${fmt(u.limit - u.used)} zostało`}</b>
                <span>{u.limit == null ? "limitu (bez zatrzymania)" : "do limitu w tym miesiącu"}</span>
              </div>
            </div>
            {pct != null && (
              <div className="cost-bar" aria-label={`${pct}% limitu`}>
                <span className={`cost-fill ${tone}`} style={{ width: `${pct}%` }} />
              </div>
            )}
            {u.key === "google_places" && (
              <p className="page-sub">
                Każde zapytanie z opiniami to w cenniku Google SKU „Text Search Enterprise + Atmosphere”: 1000 darmowych
                zapytań miesięcznie, potem 40 USD za 1000. Automat liczy każde zapytanie przed wysłaniem, zatrzymuje się na
                limicie i rozkłada resztę limitu równo na pozostałe dni miesiąca. Firmy odświeża najwyżej raz na 30 dni.
              </p>
            )}
            {u.key !== "google_places" && (
              <p className="page-sub">
                Zapytania liczymy z zapisanych wyszukiwań. Serper i Brave rozliczają się z wykupionych kredytów lub planu, więc
                zwykle nie można ich przekroczyć ponad saldo. Limit tutaj zatrzymuje szukanie nowych biur w danym miesiącu.
              </p>
            )}
            <form action={apiLimitAction} className="inline-form">
              <input type="hidden" name="service" value={u.key} />
              <label>
                Limit miesięczny{" "}
                <input type="number" name="limit" min={0} max={1000000} defaultValue={u.limit ?? ""} placeholder="bez limitu" />
              </label>
              <button type="submit">Zapisz limit</button>
              {u.key !== "google_places" && (
                <button type="submit" name="clear" value="1" className="link-button">
                  usuń limit
                </button>
              )}
            </form>
            {u.history.length > 0 && (
              <div className="tablewrap">
                <table className="tight">
                  <thead>
                    <tr>
                      <th>Miesiąc</th>
                      <th className="num">Zapytania</th>
                    </tr>
                  </thead>
                  <tbody>
                    {u.history.slice(0, 12).map((h) => (
                      <tr key={h.month}>
                        <td>{h.month}</td>
                        <td className="num">{fmt(h.used)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      <h2>Pozostałe usługi i jak ograniczyć koszty</h2>
      <div className="tablewrap">
        <table className="tight">
          <thead>
            <tr>
              <th>Usługa</th>
              <th>Za co płacisz</th>
              <th>Jak ograniczyć</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Google Cloud (klucz Places)</td>
              <td>Zapytania ponad darmową pulę</td>
              <td>
                Twardy limit po stronie Google: Google Cloud, Interfejsy API i usługi, Places API (New), Limity: ustaw limit
                zapytań Text Search na dzień (np. 31). Do tego Płatności, Budżety i alerty: budżet z powiadomieniem.
              </td>
            </tr>
            <tr>
              <td>Serper</td>
              <td>Kredyty na zapytania do wyszukiwarki</td>
              <td>Płacisz z góry za pakiet kredytów, bez automatycznego doładowania nie przekroczysz salda. Limit wyżej.</td>
            </tr>
            <tr>
              <td>Brave Search</td>
              <td>Plan API (darmowy limit miesięczny, potem płatny)</td>
              <td>Automat nie używa go na co dzień. W panelu Brave ustaw limit planu albo usuń klucz BRAVE_API_KEY z GitHuba.</td>
            </tr>
            <tr>
              <td>Vercel (hosting strony)</td>
              <td>Plan konta i użycie ponad limity planu (funkcje, transfer)</td>
              <td>
                Na darmowym planie Hobby nic nie płacisz, a po przekroczeniu limitów projekt jest wstrzymywany. Na planie Pro:
                ustawienia zespołu, Billing, Spend Management, limit wydatków z wstrzymaniem projektu.
              </td>
            </tr>
            <tr>
              <td>Neon (baza danych)</td>
              <td>Czas pracy bazy i miejsce na dane ponad darmowy plan</td>
              <td>W konsoli Neon: Billing (plan i limity), a w ustawieniach bazy autosuspend, żeby baza usypiała bez ruchu.</td>
            </tr>
            <tr>
              <td>GitHub Actions (automat)</td>
              <td>Repozytorium jest publiczne, więc minuty są bezpłatne</td>
              <td>Nic do zrobienia. Gdyby repozytorium stało się prywatne, ustaw limit wydatków na Actions na 0.</td>
            </tr>
            <tr>
              <td>Domena</td>
              <td>Opłata roczna u rejestratora</td>
              <td>Wyłącz automatyczne odnowienie innych usług dodanych do domeny, jeśli ich nie używasz.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
