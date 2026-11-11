import Link from "next/link";

import { ActivityFeed, when } from "@/components/admin";
import type { RunRow } from "@/lib/admin-data";
import { getAutomatStatus, warsawTime } from "@/lib/automat";
import { METRICS, dailyTotals, dayDetail, isDay, runsOfDay, warsawToday, type DayRow } from "@/lib/automat-report";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const STEPS = [
  {
    n: "1",
    title: "Szuka stron www biur",
    text: "Wpisuje w Google zapytania typu \"biuro nieruchomości Kraków\", \"agencja nieruchomości Mokotów Warszawa\". W dużych miastach osobno dla każdej dzielnicy. Pomija portale (Otodom, OLX, Gratka, Morizon), katalogi firm i Facebooka, zostawia tylko własne strony biur.",
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

const SHORT: { key: keyof DayRow; label: string }[] = [
  { key: "searches", label: "Wyszukiwań" },
  { key: "found", label: "Stron www" },
  { key: "agencies", label: "Biur" },
  { key: "descriptions", label: "Opisów" },
  { key: "published", label: "Dodanych" },
  { key: "offers", label: "Ofert" },
  { key: "contacts", label: "Kontaktów" },
];

function dayLabel(day: string): string {
  const today = warsawToday();
  if (day === today) return "dziś";
  if (day === warsawToday(-1)) return "wczoraj";
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "long" });
}

function shiftDay(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Godziny sesji Claude (czas polski): co 2 godziny od 6:41 do 22:41. */
const SESSION_HOURS = [6, 8, 10, 12, 14, 16, 18, 20, 22];
/** Sprawdzanie stron i zapis do katalogu: GitHub Actions o :17 co 3 godziny (UTC). */
const PIPELINE_UTC = [0, 3, 6, 9, 12, 15, 18, 21];
const CITIES_PER_DAY = SESSION_HOURS.length * 3;

function warsawNow(): { h: number; m: number } {
  const t = new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });
  const [h, m] = t.split(":").map(Number);
  return { h, m };
}

function nextSession(): string {
  const { h, m } = warsawNow();
  const next = SESSION_HOURS.find((x) => x > h || (x === h && m < 41));
  return next === undefined ? `jutro o ${SESSION_HOURS[0]}:41` : `o ${next}:41`;
}

const pipelineTimes = () => PIPELINE_UTC.map((h) => warsawTime(h, 17)).sort().join(", ");

const DAY = [
  {
    time: () => SESSION_HOURS.map((h) => `${h}:41`).join(", "),
    title: "Sesja Claude: opisy i nowe miasta (9 razy dziennie)",
    text: "Za każdym razem: pisze opisy firm, które czekają (do 150 naraz), a potem wyszukuje biura w 3 kolejnych miastach z kolejki. Duże miasta przeszukuje dokładnie, dzielnica po dzielnicy (około 50 wyszukiwań zamiast 7). Cała sesja trwa zwykle 30-60 minut."
  },
  {
    time: pipelineTimes,
    title: "Sprawdzanie stron i publikacja (8 razy dziennie)",
    text: "Automat otwiera znalezione strony, odrzuca portale i deweloperów, potwierdza firmy w KRS i wykazie VAT, zbiera informacje do opisu (do 150 firm naraz). W tym samym przebiegu zapisuje gotowe opisy i publikuje firmy w katalogu."
  },
  {
    time: () => warsawTime(5, 7),
    title: "Raz dziennie rano: oferty, kontakt, zdjęcia, opinie",
    text: "Dla wszystkich firm w katalogu: aktualne oferty z cenami, telefon, e-mail, social media, logo i zdjęcie, a gdy jest klucz Google, ocena i opinie."
  },
];

export default async function RunsPage({ searchParams }: Props) {
  const params = await searchParams;
  const today = warsawToday();
  const yesterday = warsawToday(-1);
  const chosen = isDay(one(params.dzien)) ? (one(params.dzien) as string) : today;
  const page = Math.max(0, Number.parseInt(one(params.strona) ?? "0", 10) || 0);
  const rangeTo = shiftDay(today, -14 * page);
  const rangeFrom = shiftDay(rangeTo, -13);
  const [s, history, pair, chosenTotals, detail, dayRuns] = await Promise.all([
    getAutomatStatus(),
    dailyTotals(rangeFrom, rangeTo),
    dailyTotals(yesterday, today),
    dailyTotals(chosen, chosen),
    dayDetail(chosen),
    runsOfDay(chosen),
  ]);
  const todayRow = pair.find((r) => r.day === today);
  const yesterdayRow = pair.find((r) => r.day === yesterday);
  const chosenRow = chosenTotals[0];
  const daysLeft = Math.ceil(s.citiesQueued / CITIES_PER_DAY);
  const finish = new Date(Date.now() + daysLeft * 24 * 3600 * 1000);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Automat</h1>
          <p className="page-sub">Jak katalog sam się powiększa: co, kiedy i z jakim skutkiem.</p>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <b>
            {s.citiesSearched}/{s.citiesTotal}
          </b>
          <span>miast przeszukanych</span>
        </div>
        <div className="stat">
          <b>{s.foundLast7}</b>
          <span>nowych stron w 7 dni</span>
        </div>
        <div className="stat">
          <b>{s.publishedLast7}</b>
          <span>firm dodanych w 7 dni</span>
        </div>
        <div className="stat">
          <b>{s.preparing}</b>
          <span>firm w przygotowaniu</span>
        </div>
        <div className="stat">
          <b>{s.bundlesWaiting}</b>
          <span>opisów czeka na sesję {nextSession()}</span>
        </div>
      </div>

      <h2>Raport: dziś i wczoraj</h2>
      <div className="table-wrap">
        <table className="report">
          <thead>
            <tr>
              <th>Co zrobił automat</th>
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

      <h2 id="historia">Historia</h2>
      <form method="get" action="/admin/runs#dzien" className="form-row">
        <div>
          <label htmlFor="dzien">Pokaż dowolny dzień</label>
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
                  <Link href={`/admin/runs?dzien=${row.day}&strona=${page}#dzien`}>{dayLabel(row.day)}</Link>
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

      <h2 id="dzien">Szczegóły dnia: {dayLabel(chosen)} ({chosen})</h2>
      <div className="kpis compact">
        {METRICS.filter((m) => (chosenRow?.[m.key] ?? 0) > 0).map((m) => (
          <div className="kpi" key={m.key}>
            <b>{chosenRow?.[m.key]}</b>
            <span>{m.label}</span>
          </div>
        ))}
        {detail.rejected > 0 && (
          <div className="kpi">
            <b>{detail.rejected}</b>
            <span>Stron odrzuconych (portale, deweloperzy, inna branża)</span>
          </div>
        )}
      </div>
      {METRICS.every((m) => (chosenRow?.[m.key] ?? 0) === 0) && <p className="note">Tego dnia automat nic nie zapisał.</p>}

      {detail.cities.length > 0 && (
        <>
          <h3>Gdzie szukał</h3>
          <p>
            {detail.cities.map((c, i) => (
              <span key={c.city}>
                {i > 0 && ", "}
                <b>{c.city}</b> ({c.found} stron, w tym {c.agencies} biur)
              </span>
            ))}
          </p>
        </>
      )}

      {detail.published.length > 0 && (
        <>
          <h3>Firmy dodane do katalogu ({detail.published.length})</h3>
          <ul className="plain-list">
            {detail.published.map((f) => (
              <li key={f.listingId}>
                <Link href={`/admin/firms/${f.listingId}`}>{f.name}</Link> <span className="note">{f.city}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>Przebiegi automatu tego dnia</h3>
      <ActivityFeed runs={dayRuns as unknown as RunRow[]} />

      <h2>Co dokładnie robi automat</h2>
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

      <h2>Droga nowej firmy do katalogu</h2>
      <p className="note">
        Przykład dla miasta wyszukanego w sesji o 8:41 (godziny dzisiejsze, czas polski). Cała droga trwa około 5 godzin,
        oferty i kontakt dochodzą następnego dnia rano.
      </p>
      <ol className="pipeline">
        <li>
          <b>8:41-9:30</b>
          <span>sesja Claude wyszukuje biura w mieście</span>
        </li>
        <li>
          <b>{warsawTime(9, 17)}</b>
          <span>automat sprawdza strony, KRS i VAT, zbiera dane do opisu</span>
        </li>
        <li>
          <b>10:41-11:30</b>
          <span>następna sesja Claude pisze opisy</span>
        </li>
        <li>
          <b>{warsawTime(12, 17)}</b>
          <span>firma pojawia się w katalogu</span>
        </li>
        <li>
          <b>jutro {warsawTime(5, 7)}</b>
          <span>oferty, telefon, e-mail, logo, zdjęcia</span>
        </li>
      </ol>

      <h2>Plan dnia (czas polski)</h2>
      <div className="day-plan">
        {DAY.map((d) => (
          <div key={d.title} className="day-item">
            <span className="day-time">{d.time()}</span>
            <div>
              <b>{d.title}</b>
              <p>{d.text}</p>
            </div>
          </div>
        ))}
      </div>

      <h2>Miasta</h2>
      <div className="kpis compact">
        <div className="kpi">
          <b>{s.nextCities[0] ?? "-"}</b>
          <span>następne miasto</span>
        </div>
        <div className="kpi">
          <b>{s.lastSearched ? s.lastSearched.name : "-"}</b>
          <span>ostatnio przeszukane{s.lastSearched ? ` (${when(s.lastSearched.at).split(",")[0]})` : ""}</span>
        </div>
        <div className="kpi">
          <b>{s.citiesQueued}</b>
          <span>miast w kolejce, około {CITIES_PER_DAY} dziennie</span>
        </div>
        <div className="kpi">
          <b>{daysLeft > 0 ? finish.toLocaleDateString("pl-PL", { day: "numeric", month: "long" }) : "-"}</b>
          <span>szacowany koniec listy przy obecnym tempie</span>
        </div>
      </div>
      {s.nextCities.length > 1 && (
        <p className="note">
          Kolejne w kolejce: {s.nextCities.join(", ")}. Kolejność zmienisz w zakładce Miasta.
        </p>
      )}


    </>
  );
}
