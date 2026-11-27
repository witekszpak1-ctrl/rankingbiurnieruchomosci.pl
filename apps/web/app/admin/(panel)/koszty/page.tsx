import { apiLimitAction, liteScrapeAction } from "../../actions";
import { getApiUsage, monthKey } from "@/lib/api-usage";
import { COST_PER_1000_USD, getLiteScrape, keyStatus, maskKey, MAX_SEARCH_RESULTS } from "@/lib/litescrape";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const fmt = (n: number) => n.toLocaleString("pl-PL");

/** Płatne usługi podłączone do serwisu: liczniki z bazy i opis, jak ograniczyć koszty. */
export default async function CostsPage({ searchParams }: Props) {
  const params = await searchParams;
  const ok = typeof params.ok === "string" ? params.ok : null;
  const error = typeof params.error === "string" ? params.error : null;
  const [usage, ls] = await Promise.all([getApiUsage().catch(() => []), getLiteScrape()]);
  const status = ls.apiKey ? await keyStatus(ls.apiKey) : null;
  const month = monthKey();
  const pages = Math.ceil(ls.searchResults / 10);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Koszty i limity</h1>
          <p className="page-sub">
            Klucz LiteScrape, liczniki płatnych API w bieżącym miesiącu ({month}, liczony w UTC) i limity, po których automat
            przestaje wysyłać zapytania. Niżej lista pozostałych usług, za które możesz płacić, i jak je ograniczyć.
          </p>
        </div>
      </div>
      {ok && <div className="alert ok">{ok}</div>}
      {error && <div className="alert bad">{error}</div>}

      <section className="cost-card">
        <h2>LiteScrape: klucz i ustawienia</h2>
        <p className="page-sub">
          LiteScrape dostarcza wyniki Google (szukanie nowych biur), oceny i treść opinii z Map Google oraz pobiera strony
          biur. Płacisz z góry za saldo ({COST_PER_1000_USD.toLocaleString("pl-PL")} USD za 1000 zapytań, nieudane
          zapytania są bezpłatne), więc bez doładowania nie wydasz więcej, niż wpłaciłeś. Gdy klucza nie ma albo saldo się
          skończy, automat szuka przez Serper, a strony pobiera własnym crawlerem. Google Places API jest wyłączone.
        </p>
        {status && (
          <div className={`alert ${status.ok ? "ok" : "bad"}`}>
            {status.ok
              ? `Klucz działa (${status.status}). Saldo: ${status.remainingCalls != null ? status.remainingCalls.toLocaleString("pl-PL") : "brak danych"} zapytań${
                  status.concurrencyLimit != null ? `, do ${status.concurrencyLimit} zapytań naraz` : ""
                }.`
              : status.message}
          </div>
        )}
        <form action={liteScrapeAction} className="tracking-grid">
          <div className="tracking-field">
            <label htmlFor="apiKey">
              Klucz API LiteScrape <span className="chip">{maskKey(ls.apiKey)}</span>
            </label>
            <input
              id="apiKey"
              name="apiKey"
              type="password"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              data-bwignore
              data-form-type="other"
              spellCheck={false}
              placeholder={ls.apiKey ? "zostaw puste, żeby zachować zapisany klucz" : "wklej klucz z litescrape.com"}
            />
            {ls.apiKey && (
              <label className="inline-check">
                <input type="checkbox" name="apiKeyRemove" /> usuń zapisany klucz
              </label>
            )}
            <p className="note">Klucz sprawdzamy przy zapisie (bez kosztu). W panelu widać tylko jego końcówkę.</p>
          </div>
          <div className="tracking-field">
            <label htmlFor="searchResults">Wyników Google na jedną frazę</label>
            <input
              id="searchResults"
              name="searchResults"
              type="number"
              min={10}
              max={MAX_SEARCH_RESULTS}
              step={10}
              defaultValue={ls.searchResults}
            />
            <p className="note">
              Teraz {ls.searchResults} wyników, czyli {pages} {pages === 1 ? "strona" : pages < 5 ? "strony" : "stron"} wyników
              Google na frazę ({pages} {pages === 1 ? "zapytanie" : pages < 5 ? "zapytania" : "zapytań"}). Frazy: biuro, agencja
              i pośrednik nieruchomości w danym mieście, w dużych miastach także dzielnice. Gdy Google nie ma już kolejnej
              strony, automat jej nie pobiera.
            </p>
          </div>
          <div className="tracking-field">
            <b>Do czego automat używa LiteScrape</b>
            <label className="inline-check">
              <input type="checkbox" name="useSearch" defaultChecked={ls.useSearch} /> szukanie nowych biur w Google
            </label>
            <label className="inline-check">
              <input type="checkbox" name="useMaps" defaultChecked={ls.useMaps} /> oceny i opinie z Map Google (2 zapytania na
              firmę, odświeżane co 30 dni, do 50 opinii z treścią i odpowiedzią firmy)
            </label>
            <label className="inline-check">
              <input type="checkbox" name="useFetch" defaultChecked={ls.useFetch} /> pobieranie stron biur (1 zapytanie na
              stronę, z robots.txt i naszym User-Agentem; zapas: własny crawler)
            </label>
          </div>
          <div>
            <button type="submit">Zapisz ustawienia LiteScrape</button>
          </div>
        </form>
      </section>

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
            {u.breakdown && u.used > 0 && (
              <p className="page-sub">
                W tym: {u.breakdown.map((b) => `${b.label} ${fmt(b.used)}`).join(", ")}. Koszt w tym miesiącu ok.{" "}
                {((u.used / 1000) * COST_PER_1000_USD).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} USD.
              </p>
            )}
            {u.key === "litescrape" ? (
              <p className="page-sub">
                Automat liczy udane zapytania i dopisuje je po każdym kroku. Limit poniżej (nieobowiązkowy) zatrzymuje
                LiteScrape w danym miesiącu: wtedy szukanie przechodzi na Serper, a pobieranie stron na własny crawler.
              </p>
            ) : (
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
              {u.limit != null && (
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
              <td>Google Cloud (Places API)</td>
              <td>Nic, automat już go nie używa (wyłączony, za drogi)</td>
              <td>
                Dla pewności w Google Cloud: Interfejsy API i usługi, Places API (New), Wyłącz API, a w Danych logowania usuń
                klucz. Na GitHubie usuń sekret GOOGLE_PLACES_API_KEY (Settings, Secrets and variables, Actions).
              </td>
            </tr>
            <tr>
              <td>LiteScrape</td>
              <td>Przedpłacone saldo (od 10 USD, ważne 6 miesięcy)</td>
              <td>Nie włączaj automatycznego doładowania, a koszt nie przekroczy wpłaty. Limit miesięczny wyżej.</td>
            </tr>
            <tr>
              <td>Serper</td>
              <td>Kredyty na zapytania do wyszukiwarki</td>
              <td>Zapas dla LiteScrape. Płacisz z góry za pakiet kredytów, bez automatycznego doładowania nie przekroczysz salda.</td>
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
