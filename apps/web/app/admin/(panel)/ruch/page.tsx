import Link from "next/link";

import { type CountRow, topBots, topValues, trafficByDay, trafficSummary } from "@/lib/analytics";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const RANGES: [number, string][] = [
  [1, "Dziś i wczoraj"],
  [7, "7 dni"],
  [30, "30 dni"],
  [90, "90 dni"],
  [365, "Rok"],
];

const DEVICE_LABEL: Record<string, string> = { mobile: "telefon", tablet: "tablet", desktop: "komputer", other: "inne" };
const AD_LABEL: Record<string, string> = {
  meta: "Meta (Facebook, Instagram)",
  google: "Google Ads",
  microsoft: "Microsoft Ads (Bing)",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
};

function fmt(n: number): string {
  return n.toLocaleString("pl-PL");
}

function Table({ title, rows, labelHeader, visitors = true, map }: {
  title: string;
  rows: CountRow[];
  labelHeader: string;
  visitors?: boolean;
  map?: (label: string) => React.ReactNode;
}) {
  const max = Math.max(1, ...rows.map((r) => r.views));
  return (
    <section className="traffic-table">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className="note">Brak danych w tym okresie.</p>
      ) : (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>{labelHeader}</th>
                <th className="num">Wczytania</th>
                {visitors && <th className="num">Odwiedzający</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <td>
                    <span className="traffic-bar" style={{ width: `${Math.round((row.views / max) * 100)}%` }} aria-hidden="true" />
                    <span className="traffic-label">{map ? map(row.label) : row.label || "-"}</span>
                  </td>
                  <td className="num">{fmt(row.views)}</td>
                  {visitors && <td className="num">{fmt(row.visitors)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function TrafficPage({ searchParams }: Props) {
  const params = await searchParams;
  const requested = Number(typeof params.dni === "string" ? params.dni : 30);
  const days = RANGES.some(([d]) => d === requested) ? requested : 30;
  const span = days === 1 ? 2 : days;
  const [summary, byDay, paths, referrers, utm, countries, cities, devices, browsers, systems, bots, ads, adLandings, adCampaigns] = await Promise.all([
    trafficSummary(span),
    trafficByDay(span),
    topValues("path", span, 25),
    topValues("referrer", span),
    topValues("utm", span),
    topValues("country", span),
    topValues("city", span),
    topValues("device", span),
    topValues("browser", span),
    topValues("os", span),
    topBots(span),
    topValues("ad", span),
    topValues("adLanding", span),
    topValues("adCampaign", span),
  ]);
  const peak = Math.max(1, ...byDay.map((d) => d.views));
  const pagesPerVisitor = summary.visitors ? (summary.views / summary.visitors).toFixed(1).replace(".", ",") : "0";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ruch na stronie</h1>
          <p className="page-sub">
            Każde wczytanie strony publicznej (wejście z wyszukiwarki, linku, kampanii, wpisany adres, odświeżenie), liczone
            przez serwer bez plików cookie i bez zgody, więc także od osób, które odrzuciły statystyki w banerze. Adresów IP
            nie zapisujemy.
          </p>
        </div>
      </div>

      <div className="tabs">
        {RANGES.map(([d, label]) => (
          <Link key={d} href={`/admin/ruch?dni=${d}`} className={`tab${d === days ? " active" : ""}`}>
            {label}
          </Link>
        ))}
      </div>

      <div className="kpis">
        <div className="kpi">
          <b>{fmt(summary.visitors)}</b>
          <span>odwiedzający (unikalni w ciągu dnia, zsumowani)</span>
        </div>
        <div className="kpi">
          <b>{fmt(summary.views)}</b>
          <span>wczytania stron</span>
        </div>
        <div className="kpi">
          <b>{fmt(summary.entries)}</b>
          <span>wejścia z zewnątrz (wyszukiwarki, linki, kampanie)</span>
        </div>
        <div className="kpi">
          <b>{pagesPerVisitor}</b>
          <span>wczytania na odwiedzającego</span>
        </div>
        <div className="kpi">
          <b>{fmt(summary.adClicks)}</b>
          <span>wejścia z kliknięcia w reklamę (Meta, Google i inne)</span>
        </div>
        <div className="kpi">
          <b>{fmt(summary.bots)}</b>
          <span>wejścia robotów (wyszukiwarki, AI, podglądy linków)</span>
        </div>
      </div>

      <section className="panel traffic-chart" aria-label="Odsłony dzień po dniu">
        <h3>Wczytania stron i odwiedzający dzień po dniu</h3>
        <div className="chart-bars" style={{ gridTemplateColumns: `repeat(${byDay.length}, minmax(0, 1fr))` }}>
          {byDay.map((d) => (
            <div
              key={d.day}
              className="chart-col"
              title={`${d.day}: ${fmt(d.views)} wczytań stron, ${fmt(d.visitors)} odwiedzających, ${fmt(d.bots)} wejść robotów`}
            >
              <span className="chart-bar views" style={{ height: `${(d.views / peak) * 100}%` }} />
              <span className="chart-bar visitors" style={{ height: `${(d.visitors / peak) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="chart-axis">
          <span>{byDay[0]?.day}</span>
          <span className="chart-legend">
            <i className="views" /> wczytania stron <i className="visitors" /> odwiedzający
          </span>
          <span>{byDay[byDay.length - 1]?.day}</span>
        </div>
      </section>

      <div className="traffic-grid">
        <Table
          title="Najczęściej oglądane strony"
          rows={paths}
          labelHeader="Strona"
          map={(label) => (
            <a href={label} target="_blank" rel="noopener">
              {label}
            </a>
          )}
        />
        <Table title="Skąd przychodzą (źródła wejść)" rows={referrers} labelHeader="Źródło" />
        <Table title="Kliknięcia w reklamy według sieci" rows={ads} labelHeader="Sieć reklamowa" map={(l) => AD_LABEL[l] ?? l} />
        <Table title="Kampanie reklamowe (sieć: kampania UTM)" rows={adCampaigns} labelHeader="Kampania" />
        <Table title="Strony docelowe reklam" rows={adLandings} labelHeader="Sieć: strona" />
        <Table title="Kampanie (parametry UTM)" rows={utm} labelHeader="źródło / medium / kampania" />
        <Table title="Kraje" rows={countries} labelHeader="Kraj" />
        <Table title="Miasta (przybliżone, z adresu IP)" rows={cities} labelHeader="Miasto" />
        <Table title="Urządzenia" rows={devices} labelHeader="Urządzenie" map={(l) => DEVICE_LABEL[l] ?? l} />
        <Table title="Przeglądarki" rows={browsers} labelHeader="Przeglądarka" />
        <Table title="Systemy" rows={systems} labelHeader="System" />
        <Table title="Roboty" rows={bots} labelHeader="Robot" visitors={false} />
      </div>
      <p className="note">
        Serwer widzi każde wczytanie strony, ale nie przejścia między podstronami bez przeładowania (serwis wczytuje je w
        tle). Te przejścia, czas na stronie i ścieżki wizyt pokazują narzędzia z zakładki „Analityka i piksele” (np.
        Google Analytics, WitekCRM) u osób, które zgodziły się na statystyki. Odwiedzających liczymy po skrócie z adresu IP
        i przeglądarki z solą zmienianą codziennie, więc ta sama osoba w dwa różne dni liczy się dwa razy.
      </p>
    </>
  );
}
