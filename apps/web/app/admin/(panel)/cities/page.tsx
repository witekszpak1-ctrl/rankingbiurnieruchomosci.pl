import { cityAction } from "../../actions";
import { Flash, when } from "@/components/admin";
import { listAdminCitiesWithProgress } from "@/lib/admin-cities";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function CitiesPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = one(params.q).trim().toLowerCase();
  const all = await listAdminCitiesWithProgress();
  const cities = q ? all.filter((c) => c.name.toLowerCase().includes(q)) : all;
  const searched = all.filter((c) => c.lastSearchedAt).length;
  const withFirms = all.filter((c) => c.published > 0).length;
  const queue = all.filter((c) => c.searchEnabled && !c.lastSearchedAt);
  const next = queue[0];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Miasta</h1>
          <p className="page-sub">
            Automat codziennie szuka biur nieruchomości w kolejnym mieście z tej listy, od góry.
          </p>
        </div>
      </div>
      <Flash params={params} />

      <div className="stats">
        <div className="stat">
          <b>{all.length}</b>
          <span>miast na liście</span>
        </div>
        <div className="stat">
          <b>{searched}</b>
          <span>już przeszukanych</span>
        </div>
        <div className="stat">
          <b>{withFirms}</b>
          <span>z firmami w katalogu</span>
        </div>
        <div className="stat">
          <b>{queue.length}</b>
          <span>czeka w kolejce</span>
        </div>
      </div>

      {next && (
        <div className="alert ok">
          Następne w kolejce: <b>{next.name}</b>. Automat bierze jedno miasto dziennie.
        </div>
      )}

      <div className="form-row">
        <form method="get" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label htmlFor="q">Szukaj miasta</label>
            <input id="q" name="q" defaultValue={one(params.q)} />
          </div>
          <button type="submit">Szukaj</button>
        </form>
        <form action={cityAction} style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginLeft: "auto" }}>
          <input type="hidden" name="action" value="add" />
          <div>
            <label htmlFor="name">Dodaj miasto</label>
            <input id="name" name="name" placeholder="np. Zakopane" required />
          </div>
          <button className="primary" type="submit">
            Dodaj na koniec kolejki
          </button>
        </form>
      </div>

      <div className="tablewrap">
        <table className="tight">
          <thead>
            <tr>
              <th>Miasto</th>
              <th className="num" title="Firm w katalogu">Firm</th>
              <th className="num" title="Firm w przygotowaniu">W przyg.</th>
              <th className="num" title="Znalezione strony www">Stron</th>
              <th>Szukano</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cities.map((c) => (
              <tr key={c.id}>
                <td>
                  <b>{c.name}</b>
                  {c.deepRequestedAt ? (
                    <span className="chip warn" style={{ marginLeft: 6 }}>
                      zlecone
                    </span>
                  ) : c.deep ? (
                    <span className="chip" style={{ marginLeft: 6 }}>
                      dokładne
                    </span>
                  ) : null}
                </td>
                <td className="num">
                  <b>{c.published}</b>
                </td>
                <td className="num">{c.preparing || "-"}</td>
                <td className="num">{c.found || "-"}</td>
                <td>{c.lastSearchedAt ? when(c.lastSearchedAt).split(",")[0] : <span className="note">jeszcze nie</span>}</td>
                <td>
                  <span className={`badge ${c.searchEnabled ? "ok" : ""}`}>{c.searchEnabled ? "włączone" : "wyłączone"}</span>
                </td>
                <td>
                  <div className="row-actions">
                    {!c.deepRequestedAt && (
                      <form action={cityAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="action" value="deep" />
                        <button type="submit">Dokładnie</button>
                      </form>
                    )}
                    {c.searchEnabled && !c.lastSearchedAt && c.id !== next?.id && (
                      <form action={cityAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="action" value="next" />
                        <button type="submit">Jako następne</button>
                      </form>
                    )}
                    <form action={cityAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="action" value={c.searchEnabled ? "disable" : "enable"} />
                      <button type="submit">{c.searchEnabled ? "Wyłącz" : "Włącz"}</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        Przycisk „Dokładnie” to około 50 wyszukiwań po dzielnicach i rodzajach usług zamiast 7. 12 największych miast
        jest przeszukiwanych dokładnie automatycznie. W mniejszych miastach automat zwykle znajduje kilka biur.
      </p>
    </>
  );
}
