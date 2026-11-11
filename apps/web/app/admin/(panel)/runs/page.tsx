import { ActivityFeed, when } from "@/components/admin";
import { listRuns } from "@/lib/admin-data";
import { getAutomatStatus, warsawTime } from "@/lib/automat";

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

export default async function RunsPage() {
  const [runs, s] = await Promise.all([listRuns(60), getAutomatStatus()]);
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

      <h2>Co ostatnio zrobił automat</h2>
      <ActivityFeed runs={runs} />
    </>
  );
}
