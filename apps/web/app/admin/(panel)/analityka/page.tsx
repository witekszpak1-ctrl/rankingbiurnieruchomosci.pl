import Link from "next/link";

import { trackingAction } from "../../actions";
import { Flash } from "@/components/admin";
import { CUSTOM_CODE_MAX, getTracking } from "@/lib/tracking";
import { TOOLS } from "@/lib/tracking-tools";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const CATEGORY_LABEL = { statistics: "statystyczne", marketing: "marketingowe", any: "obie kategorie" } as const;

export default async function TrackingPage({ searchParams }: Props) {
  const params = await searchParams;
  const settings = await getTracking();
  const active = TOOLS.filter((t) => settings.ids[t.key]).length;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Analityka i piksele</h1>
          <p className="page-sub">
            Wpisz identyfikatory narzędzi, a strona wczyta je sama. Narzędzia statystyczne uruchamiają się u osób, które
            zgodziły się na statystyki, a reklamowe u tych, które zgodziły się na marketing. Wszystkie wejścia, także bez
            zgody, liczy serwer w zakładce <Link href="/admin/ruch">Ruch na stronie</Link>.
          </p>
        </div>
      </div>
      <Flash params={params} />

      <div className="kpis compact">
        <div className="kpi">
          <b>{active}</b>
          <span>włączone narzędzia z listy</span>
        </div>
        <div className="kpi">
          <b>{[settings.customStatistics, settings.customMarketing].filter(Boolean).length}</b>
          <span>własne kody</span>
        </div>
      </div>

      <form action={trackingAction} className="tracking-form">
        <section className="panel">
          <h3>Identyfikatory narzędzi</h3>
          <div className="tracking-grid">
            {TOOLS.map((tool) => (
              <div key={tool.key} className="tracking-field">
                <label htmlFor={tool.key}>
                  {tool.label} <span className="chip">{CATEGORY_LABEL[tool.category]}</span>
                </label>
                <input
                  id={tool.key}
                  name={tool.key}
                  defaultValue={settings.ids[tool.key] ?? ""}
                  placeholder={tool.placeholder}
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="note">{tool.help}</p>
              </div>
            ))}
          </div>
        </section>

        {(["Statistics", "Marketing"] as const).map((kind) => {
          const current = kind === "Statistics" ? settings.customStatistics : settings.customMarketing;
          return (
            <section key={kind} className="panel">
              <h3>Własny kod: {kind === "Statistics" ? "statystyczny" : "marketingowy"}</h3>
              <p className="note">
                Dowolny kod HTML lub JavaScript od dostawcy narzędzia (np. inny piksel albo licznik). Uruchomi się po zgodzie
                na kategorię {kind === "Statistics" ? "statystyczną" : "marketingową"}. Wklejaj tylko kod od zaufanych
                dostawców: działa na każdej stronie publicznej.
              </p>
              <label htmlFor={`custom${kind}Description`}>Nazwa narzędzia i dostawcy (pokażemy ją w banerze i polityce prywatności)</label>
              <input
                id={`custom${kind}Description`}
                name={`custom${kind}Description`}
                defaultValue={current?.description ?? ""}
                placeholder="np. Piksel Pinterest (Pinterest Europe Ltd.)"
                maxLength={200}
              />
              <label htmlFor={`custom${kind}`} style={{ marginTop: 10 }}>
                Kod
              </label>
              <textarea
                id={`custom${kind}`}
                name={`custom${kind}`}
                defaultValue={current?.code ?? ""}
                rows={8}
                maxLength={CUSTOM_CODE_MAX}
                spellCheck={false}
                placeholder="<script>...</script>"
              />
            </section>
          );
        })}

        <div className="row-actions">
          <button className="primary" type="submit">
            Zapisz ustawienia
          </button>
        </div>
      </form>
      <p className="note">
        Po zapisaniu lista narzędzi trafia automatycznie do banera zgody i do{" "}
        <Link href="/polityka-prywatnosci#cookies" target="_blank">
          polityki prywatności
        </Link>
        . Gdy dodasz albo usuniesz narzędzie, baner zapyta odwiedzających o zgodę ponownie.
      </p>
    </>
  );
}
