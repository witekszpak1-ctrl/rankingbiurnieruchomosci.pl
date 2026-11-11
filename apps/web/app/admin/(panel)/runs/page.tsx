import Link from "next/link";

import { getAutomatStatus } from "@/lib/automat";
import {
  buildDayPlan,
  hhmm,
  runDuration,
  warsawDay,
  slotSummary,
  STATE_LABEL,
  type Run,
  type Slot,
} from "@/lib/automat-plan";
import { METRICS, dailyTotals, dayDetail, isDay, runsOfDay, warsawToday, type DayRow } from "@/lib/automat-report";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const STEPS = [
  {
    n: "1",
    title: "Szuka stron www biur",
    text: "Automat GitHub przez Serper (wyniki Google) wpisuje zapytania typu \"biuro nieruchomości Kraków\", \"agencja nieruchomości Mokotów Warszawa\". W dużych miastach osobno dla każdej dzielnicy. Pomija portale (Otodom, OLX, Gratka, Morizon), katalogi firm i Facebooka, zostawia tylko własne strony biur.",
  },
  {
    n: "2",
    title: "Otwiera każdą stronę i sprawdza, czy to biuro",
    text: "Pobiera stronę główną i podstrony: o nas, oferty, kontakt, zespół, usługi. Odrzuca deweloperów, portale, blogi, strony nieaktywne i firmy z innej branży.",
  },
  {
    n: "3",
    title: "Sprawdza firmę w rejestrach",
    text: "Szuka NIP na stronie i sprawdza go w wykazie podatników VAT i w KRS: pełna nazwa, adres siedziby, data założenia, czy firma działa. Firma bez potwierdzenia w rejestrze nie trafia do katalogu.",
  },
  {
    n: "4",
    title: "Zbiera informacje do opisu",
    text: "Wypisuje ze strony konkretne fakty: usługi (sprzedaż, wynajem, zarządzanie najmem, rynek pierwotny), obszar działania, specjalizacje, licencje, języki, liczbę agentów. Każdy fakt ma zapisane źródło.",
  },
  {
    n: "5",
    title: "Pisze własny opis firmy",
    text: "Claude pisze opis od zera (4-6 zdań), tylko z zebranych faktów. Nie kopiuje tekstów ze strony firmy: osobny test sprawdza, czy opis nie powtarza zdań ze źródła, i odrzuca taki opis.",
  },
  {
    n: "6",
    title: "Dodaje firmę do katalogu",
    text: "Firma z potwierdzonymi danymi i gotowym opisem pojawia się na stronie miasta i w rankingu.",
  },
  {
    n: "7",
    title: "Codziennie uzupełnia dane",
    text: "Pobiera aktualne oferty z cenami, telefon, e-mail, adres, Facebook i Instagram, logo i zdjęcie firmy. Z Map Google pobiera ocenę i liczbę opinii (gdy jest klucz Google).",
  },
];

const STAGE_NAME: Record<string, string> = {
  claude_session: "Sesja Claude",
  discover: "Dopisanie znalezionych stron",
  probe: "Otwieranie stron",
  verify: "Sprawdzanie w KRS i VAT",
  crawl_deep: "Pobieranie podstron",
  bundle: "Dane do opisów",
  import: "Zapis opisów",
  publish: "Publikacja firm",
  offers: "Oferty",
  contacts: "Kontakty i zdjęcia",
  google_reviews: "Opinie Google",
};

const SHORT: { key: keyof DayRow; label: string }[] = [
  { key: "searches", label: "Wyszukiwań" },
  { key: "found", label: "Stron www" },
  { key: "agencies", label: "Biur" },
  { key: "descriptions", label: "Opisów" },
  { key: "published", label: "Dodanych" },
  { key: "offers", label: "Ofert" },
];

const STATE_CLASS: Record<string, string> = {
  done: "ok",
  running: "live",
  plan_running: "live",
  failed: "bad",
  missed: "bad",
  queued: "warn",
  waiting_report: "warn",
  planned: "",
};

function dayLabel(day: string): string {
  if (day === warsawToday()) return "dziś";
  if (day === warsawToday(-1)) return "wczoraj";
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
}

function shiftDay(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function inMinutes(at: Date, now: Date): string {
  const m = Math.round((at.getTime() - now.getTime()) / 60000);
  if (m < 60) return `za ${m} min`;
  return `za ${Math.floor(m / 60)} godz. ${m % 60} min`;
}

function Timeline({ slots, showFuture = true }: { slots: Slot[]; showFuture?: boolean }) {
  const list = showFuture ? slots : slots.filter((s) => s.state !== "planned");
  return (
    <ol className="timeline">
      {list.map((s) => (
        <li key={`${s.kind}-${s.at.toISOString()}`} className={`tl-${STATE_CLASS[s.state] || "plan"}`}>
          <span className="tl-time">{hhmm(s.at)}</span>
          <span className="tl-dot" aria-hidden="true" />
          <div className="tl-body">
            <div className="tl-head">
              <b>{s.title}</b>
              <span className={`badge ${STATE_CLASS[s.state]}`}>{STATE_LABEL[s.state]}</span>
              {s.runs.length > 0 && <span className="note">{runDuration(s)}</span>}
            </div>
            <p>{s.runs.length > 0 ? slotSummary(s) : s.what}</p>
            {s.kind !== "claude" && s.runs.length > 1 && (
              <p className="tl-steps">
                {s.runs.map((r) => (
                  <span key={r.id} className={r.status === "failed" ? "bad" : r.status === "running" ? "live" : ""}>
                    {STAGE_NAME[r.stage] ?? r.stage}
                    {r.status === "failed" ? " (błąd)" : r.status === "running" ? " (trwa)" : ""}
                  </span>
                ))}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default async function RunsPage({ searchParams }: Props) {
  const params = await searchParams;
  const now = new Date();
  const today = warsawToday();
  const yesterday = warsawToday(-1);
  const tomorrow = warsawToday(1);
  const chosen = isDay(one(params.dzien)) && one(params.dzien) !== today ? (one(params.dzien) as string) : yesterday;
  const page = Math.max(0, Number.parseInt(one(params.strona) ?? "0", 10) || 0);
  const rangeTo = shiftDay(today, -14 * page);
  const rangeFrom = shiftDay(rangeTo, -13);

  const [s, history, pair, todayRuns, chosenRuns, chosenTotals, detail] = await Promise.all([
    getAutomatStatus(),
    dailyTotals(rangeFrom, rangeTo),
    dailyTotals(yesterday, today),
    runsOfDay(today),
    runsOfDay(chosen),
    dailyTotals(chosen, chosen),
    dayDetail(chosen),
  ]);
  const todayPlan = buildDayPlan(today, todayRuns as Run[], now);
  const chosenPlan = buildDayPlan(chosen, chosenRuns as Run[], now);
  const tomorrowPlan = buildDayPlan(tomorrow, [], now);
  const upcoming = [...todayPlan, ...tomorrowPlan].filter(
    (x) => x.at.getTime() > now.getTime() && x.at.getTime() <= now.getTime() + 24 * 3600 * 1000,
  );
  const live = todayPlan.filter((x) => x.state === "running" || x.state === "plan_running");
  const todayRow = pair.find((r) => r.day === today);
  const yesterdayRow = pair.find((r) => r.day === yesterday);
  const chosenRow = chosenTotals[0];
  const left = s.citiesTotal - s.citiesSearched;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Automat</h1>
          <p className="page-sub">Co działa teraz, co będzie dziś i co działo się wcześniej. Godziny w czasie polskim.</p>
        </div>
      </div>

      <section className="now-box">
        <h2>Teraz ({hhmm(now)})</h2>
        {live.length === 0 ? (
          <p className="now-idle">W tej chwili nic nie pracuje.</p>
        ) : (
          <ul className="now-list">
            {live.map((x) => (
              <li key={x.at.toISOString()}>
                <span className="pulse" aria-hidden="true" />
                <b>{x.title}</b> {x.state === "plan_running" ? `(start ${hhmm(x.at)}, według planu)` : runDuration(x)}
                <span className="note"> {x.runs.length > 0 ? slotSummary(x) || x.what : x.what}</span>
              </li>
            ))}
          </ul>
        )}
        {upcoming.length > 0 && (
          <>
            <h3 className="up-title">Najbliższe 24 godziny</h3>
            <div className="table-wrap">
              <table className="report upcoming">
                <thead>
                  <tr>
                    <th>Kiedy</th>
                    <th>Co</th>
                    <th>Jaki system</th>
                    <th>Co zrobi</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((x, i) => (
                    <tr key={`${x.kind}-${x.at.toISOString()}`} className={i === 0 ? "sel" : ""}>
                      <td>
                        <b>{hhmm(x.at)}</b>
                        <span className="note">
                          {" "}
                          {warsawDay(x.at) === tomorrow ? "jutro" : "dziś"}
                          {i === 0 ? `, ${inMinutes(x.at, now)}` : ""}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${x.kind === "claude" ? "warn" : "ok"}`}>{x.title}</span>
                      </td>
                      <td className="note">{x.system}</td>
                      <td className="wrap">{x.what}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="now-stats">
          <span>
            <b>{s.published}</b> firm w katalogu
          </span>
          <span>
            <b>{s.preparing}</b> w przygotowaniu
          </span>
          <span>
            <b>{s.bundlesWaiting}</b> czeka na opis
          </span>
          <span>
            <b>
              {s.citiesSearched}/{s.citiesTotal}
            </b>{" "}
            miast przeszukanych, zostało {left} (około {Math.max(1, Math.ceil(left / 120))} dni, 15 miast co 3 godziny)
          </span>
        </div>
      </section>

      <h2>Dziś: plan i wykonanie</h2>
      <p className="note">
        Sesja Claude wysyła raport po zakończeniu, a panel pokazuje go po najbliższym przebiegu automatu GitHub (do 3 godzin).
      </p>
      <Timeline slots={todayPlan} />

      <h2>Dziś i wczoraj w liczbach</h2>
      <div className="table-wrap">
        <table className="report">
          <thead>
            <tr>
              <th>Co zrobiono</th>
              <th className="num">Dziś</th>
              <th className="num">Wczoraj</th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => (
              <tr key={m.key}>
                <td>{m.label}</td>
                <td className="num">
                  <b>{todayRow?.[m.key] ?? 0}</b>
                </td>
                <td className="num">{yesterdayRow?.[m.key] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="historia">Co działo się wcześniej</h2>
      <form method="get" action="/admin/runs#dzien" className="form-row">
        <div>
          <label htmlFor="dzien">Wybierz dzień</label>
          <input id="dzien" name="dzien" type="date" defaultValue={chosen} max={today} />
        </div>
        <button className="primary" type="submit">
          Pokaż
        </button>
      </form>
      <div className="table-wrap">
        <table className="report">
          <thead>
            <tr>
              <th>Dzień</th>
              {SHORT.map((c) => (
                <th key={c.key} className="num">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((row) => (
              <tr key={row.day} className={row.day === chosen ? "sel" : ""}>
                <td>
                  {row.day === today ? (
                    <b>dziś</b>
                  ) : (
                    <Link href={`/admin/runs?dzien=${row.day}&strona=${page}#dzien`}>{dayLabel(row.day)}</Link>
                  )}
                  <span className="note"> {row.day}</span>
                </td>
                {SHORT.map((c) => (
                  <td key={c.key} className="num">
                    {row[c.key] || <span className="note">0</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pager">
        <Link className="btn" href={`/admin/runs?strona=${page + 1}&dzien=${chosen}#historia`}>
          Starsze dni
        </Link>
        {page > 0 && (
          <Link className="btn" href={`/admin/runs?strona=${page - 1}&dzien=${chosen}#historia`}>
            Nowsze dni
          </Link>
        )}
      </p>

      <h3 id="dzien">
        {dayLabel(chosen)} ({chosen})
      </h3>
      {chosenRuns.length === 0 && METRICS.every((m) => (chosenRow?.[m.key] ?? 0) === 0) ? (
        <p className="note">Tego dnia automat nic nie zapisał.</p>
      ) : (
        <>
          <div className="kpis compact">
            {METRICS.filter((m) => (chosenRow?.[m.key] ?? 0) > 0).map((m) => (
              <div className="kpi" key={m.key}>
                <b>{chosenRow?.[m.key]}</b>
                <span>{m.label}</span>
              </div>
            ))}
          </div>
          {detail.cities.length > 0 && (
            <p>
              <b>Gdzie szukano: </b>
              {detail.cities.map((c, i) => (
                <span key={c.city}>
                  {i > 0 && ", "}
                  {c.city} ({c.found} stron, {c.agencies} biur)
                </span>
              ))}
            </p>
          )}
          <Timeline slots={chosenPlan} showFuture={false} />
          {detail.published.length > 0 && (
            <>
              <h3>Firmy dodane tego dnia ({detail.published.length})</h3>
              <ul className="plain-list">
                {detail.published.map((f) => (
                  <li key={f.listingId}>
                    <Link href={`/admin/firms/${f.listingId}`}>{f.name}</Link> <span className="note">{f.city}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <details className="explain">
        <summary>Jak działa automat i jakich narzędzi używa</summary>
        <div className="steps">
          {STEPS.map((st) => (
            <div className="step" key={st.n}>
              <span className="step-n">{st.n}</span>
              <div>
                <b>{st.title}</b>
                <p>{st.text}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="note">
          Sesje Claude działają w chmurze Anthropic jako zaplanowane zadanie i piszą opisy firm. Szukanie stron w Google
          robi automat GitHub przez płatne API Serper (około 1 dolar za 1000 wyszukiwań).
          Automat GitHub to nasz program w Pythonie na serwerach GitHub Actions: pobiera strony (httpx, z poszanowaniem
          robots.txt), czyta je (BeautifulSoup), sprawdza firmy w wykazie VAT Ministerstwa Finansów i w KRS, oceny bierze
          z Google Places. Dane są w bazie Postgres (Neon), strona i panel na Vercel. Nic nie musi być włączone na Twoim
          komputerze.
        </p>
      </details>
    </>
  );
}
