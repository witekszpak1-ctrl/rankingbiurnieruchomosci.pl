import Link from "next/link";

import { when } from "@/components/admin";
import { listSearches, listSites, siteCities, siteState, SITE_STATES } from "@/lib/admin-sites";
import { ADMIN_TZ_LABEL } from "@/lib/tz";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

const TONE: Record<string, string> = {
  czeka: "",
  biuro: "warn",
  potwierdzona: "ok",
  bez_potwierdzenia: "warn",
  odrzucona: "bad",
  na_stronie: "ok",
};

const CLASS_LABEL: Record<string, string> = {
  official: "strona biura",
  media: "portal lub media",
  marketplace: "serwis ogłoszeń",
  directory: "katalog firm",
  irrelevant: "inna branża",
  parked: "domena nieaktywna",
  uncertain: "niepewne",
  unknown: "jeszcze nie otwarta",
};

function reasonText(reasons: unknown): string {
  if (!Array.isArray(reasons) || reasons.length === 0) return "-";
  return reasons
    .slice(0, 2)
    .map((r) => (typeof r === "string" ? r : typeof r === "object" && r && "message" in r ? String((r as { message: unknown }).message) : JSON.stringify(r)))
    .join("; ");
}

export default async function SitesPage({ searchParams }: Props) {
  const params = await searchParams;
  const view = one(params.widok) === "wyszukiwania" ? "wyszukiwania" : "strony";
  const page = Math.max(0, Number.parseInt(one(params.strona), 10) || 0);
  const filters = { state: one(params.stan), city: one(params.miasto), q: one(params.q), page };

  const link = (extra: Record<string, string>) => {
    const base: Record<string, string> = { widok: view };
    if (filters.state) base.stan = filters.state;
    if (filters.city) base.miasto = filters.city;
    if (filters.q) base.q = filters.q;
    return `/admin/sites?${new URLSearchParams({ ...base, ...extra })}`;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Znalezione strony</h1>
          <p className="page-sub">
            Wszystko, co automat znalazł w Google, i co się z tym dzieje. Widoczne tylko w panelu. Godziny: {ADMIN_TZ_LABEL}.
          </p>
        </div>
      </div>
      <div className="tabs">
        <Link className={view === "strony" ? "tab active" : "tab"} href="/admin/sites">
          Strony
        </Link>
        <Link className={view === "wyszukiwania" ? "tab active" : "tab"} href="/admin/sites?widok=wyszukiwania">
          Wyszukiwania w Google
        </Link>
      </div>
      {view === "strony" ? <Sites filters={filters} link={link} /> : <Searches q={filters.q} page={page} link={link} />}
    </>
  );
}

async function Sites({
  filters,
  link,
}: {
  filters: { state: string; city: string; q: string; page: number };
  link: (extra: Record<string, string>) => string;
}) {
  const [{ rows, counts }, cities] = await Promise.all([listSites(filters), siteCities()]);
  return (
    <>
      <div className="kpis compact">
        <div className="kpi">
          <b>{counts.all ?? 0}</b>
          <span>znalezionych stron</span>
        </div>
        <div className="kpi">
          <b>{(counts.potwierdzona ?? 0) + (counts.bez_potwierdzenia ?? 0)}</b>
          <span>to biura nieruchomości</span>
        </div>
        <div className="kpi hot">
          <b>
            <Link href="/admin/sites?stan=na_stronie">{counts.na_stronie ?? 0}</Link>
          </b>
          <span>dodanych na stronę (widoczne publicznie)</span>
        </div>
        <div className="kpi">
          <b>{counts.czeka ?? 0}</b>
          <span>czeka na sprawdzenie</span>
        </div>
      </div>
      <div className="chips-row">
        <Link className={!filters.state ? "chip-link active" : "chip-link"} href="/admin/sites">
          wszystkie <b>{counts.all ?? 0}</b>
        </Link>
        {Object.entries(SITE_STATES).map(([key, s]) => (
          <Link
            key={key}
            className={filters.state === key ? "chip-link active" : "chip-link"}
            href={`/admin/sites?${new URLSearchParams({ stan: key, ...(filters.city && { miasto: filters.city }) })}`}
          >
            {s.label} <b>{counts[key] ?? 0}</b>
          </Link>
        ))}
      </div>
      <form method="get" className="form-row">
        {filters.state && <input type="hidden" name="stan" value={filters.state} />}
        <div>
          <label htmlFor="miasto">Miasto</label>
          <select id="miasto" name="miasto" defaultValue={filters.city}>
            <option value="">wszystkie</option>
            {cities.map((c) => (
              <option key={c.city} value={c.city}>
                {c.city} ({c.n})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="q">Domena lub nazwa</label>
          <input id="q" name="q" defaultValue={filters.q} />
        </div>
        <button type="submit">Pokaż</button>
      </form>
      <div className="tablewrap">
        <table className="tight">
          <thead>
            <tr>
              <th>Strona</th>
              <th>Miasto</th>
              <th>Znaleziona</th>
              <th>Stan</th>
              <th>Co to jest</th>
              <th>Powód</th>
              <th>Firma w katalogu</th>
              <th>Fraza w Google</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const state = siteState(r);
              return (
                <tr key={r.id}>
                  <td>
                    <a href={r.url ?? `https://${r.host}/`} target="_blank" rel="noreferrer">
                      {r.host}
                    </a>
                  </td>
                  <td>{r.city ?? "-"}</td>
                  <td>{when(r.firstSeenAt)}</td>
                  <td>
                    <span className={`badge ${TONE[state]}`}>{SITE_STATES[state].label}</span>
                  </td>
                  <td className="note">{CLASS_LABEL[r.classification] ?? r.classification}</td>
                  <td className="note wrap-cell">{reasonText(r.reasons)}</td>
                  <td>
                    {r.listingId ? (
                      <>
                        <Link href={`/admin/firms/${r.listingId}`}>{r.firmName}</Link>
                        {r.listingStatus === "published" && (
                          <span className="badge ok" style={{ marginLeft: 6 }}>
                            na stronie
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="note">-</span>
                    )}
                  </td>
                  <td className="note">{r.query ?? "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="note">Brak stron dla tych filtrów.</p>}
      <p className="pager">
        {filters.page > 0 && (
          <Link className="btn" href={link({ strona: String(filters.page - 1) })}>
            Poprzednie 100
          </Link>
        )}
        {rows.length === 100 && (
          <Link className="btn" href={link({ strona: String(filters.page + 1) })}>
            Następne 100
          </Link>
        )}
      </p>
    </>
  );
}

async function Searches({ q, page, link }: { q: string; page: number; link: (extra: Record<string, string>) => string }) {
  const { rows, total, today } = await listSearches(q, page);
  return (
    <>
      <div className="kpis compact">
        <div className="kpi">
          <b>{today}</b>
          <span>wyszukiwań Serper w ostatnich 24 godzinach</span>
        </div>
        <div className="kpi">
          <b>{total}</b>
          <span>wyszukiwań Serper łącznie (około {(total / 1000).toFixed(2)} USD)</span>
        </div>
      </div>
      <form method="get" className="form-row">
        <input type="hidden" name="widok" value="wyszukiwania" />
        <div>
          <label htmlFor="q">Fraza zawiera</label>
          <input id="q" name="q" defaultValue={q} placeholder="np. Kraków" />
        </div>
        <button type="submit">Pokaż</button>
      </form>
      <div className="tablewrap">
        <table className="tight">
          <thead>
            <tr>
              <th>Kiedy</th>
              <th>Fraza</th>
              <th>Narzędzie</th>
              <th className="num">Wyników</th>
              <th className="num">Nowych stron</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{when(r.createdAt)}</td>
                <td>{r.query}</td>
                <td className="note">{r.provider === "serper" ? "Serper (Google)" : r.provider === "claude_websearch" ? "Claude" : r.provider}</td>
                <td className="num">{r.results}</td>
                <td className="num">{r.newDomains ? <b>{r.newDomains}</b> : <span className="note">0</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pager">
        {page > 0 && (
          <Link className="btn" href={link({ strona: String(page - 1) })}>
            Nowsze
          </Link>
        )}
        {rows.length === 200 && (
          <Link className="btn" href={link({ strona: String(page + 1) })}>
            Starsze
          </Link>
        )}
      </p>
    </>
  );
}
