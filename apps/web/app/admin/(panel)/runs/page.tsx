import { ActivityFeed, when } from "@/components/admin";
import { listRuns } from "@/lib/admin-data";
import { getAutomatStatus, warsawTime } from "@/lib/automat";

const DAY = [
  {
    time: () => warsawTime(3, 17),
    title: "W nocy: sprawdzanie znalezionych stron",
    text: "Automat otwiera strony znalezione rano, odrzuca portale i deweloperów, potwierdza firmy w KRS i wykazie VAT, zbiera informacje i przygotowuje dane do opisów. Wysyła też do porannej sesji kolejkę miast z panelu."
  },
  {
    time: () => warsawTime(5, 7),
    title: "Nad ranem: oferty, kontakt, zdjęcia, opinie",
    text: "Dla firm w katalogu: aktualne oferty z cenami, telefon, e-mail, social media, logo i zdjęcie, a gdy jest klucz Google, ocena i opinie."
  },
  {
    time: () => warsawTime(5, 22),
    title: "Rano: opisy i nowe miasto",
    text: "Sesja Claude pisze opisy firm przygotowanych w nocy i wyszukuje biura w kolejnym mieście z kolejki (7 wyszukiwań, bez portali i katalogów)."
  },
  {
    time: () => "co 3 godziny",
    title: "W ciągu dnia: zapis opisów i publikacja",
    text: "Gotowe opisy trafiają do bazy, a firmy z potwierdzonymi danymi i opisem pojawiają się w katalogu."
  },
];

export default async function RunsPage() {
  const [runs, s] = await Promise.all([listRuns(60), getAutomatStatus()]);
  const daysLeft = s.citiesQueued;
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
          <span>opisów do napisania jutro rano</span>
        </div>
      </div>

      <h2>Droga nowej firmy do katalogu</h2>
      <ol className="pipeline">
        <li>
          <b>Dzień 1, rano</b>
          <span>wyszukanie biur w kolejnym mieście</span>
        </li>
        <li>
          <b>Noc z 1 na 2</b>
          <span>sprawdzenie stron i rejestrów, dane do opisu</span>
        </li>
        <li>
          <b>Dzień 2, rano</b>
          <span>opis firmy</span>
        </li>
        <li>
          <b>Dzień 2, do 3 godzin później</b>
          <span>firma w katalogu</span>
        </li>
        <li>
          <b>Dzień 3, nad ranem</b>
          <span>oferty, kontakt, zdjęcia</span>
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
          <span>miast w kolejce, jedno dziennie</span>
        </div>
        <div className="kpi">
          <b>{daysLeft > 0 ? finish.toLocaleDateString("pl-PL", { month: "long", year: "numeric" }) : "-"}</b>
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
