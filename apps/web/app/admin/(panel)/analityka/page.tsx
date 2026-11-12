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

      <section className="panel">
        <h3>Testowanie narzędzi</h3>
        <p>
          <a className="btn" href="/?test_narzedzi=1" target="_blank" rel="noopener">
            Otwórz stronę w trybie testowym
          </a>
        </p>
        <p className="note">
          W trybie testowym wszystkie zapisane narzędzia (piksele, Analytics, własny kod) uruchamiają się od razu, bez banera,
          ale tylko w Twojej przeglądarce i tylko gdy jesteś zalogowany do panelu. Zwykli odwiedzający nadal widzą baner.
          Działanie sprawdzisz w Menedżerze zdarzeń Meta (Testuj zdarzenia), w rozszerzeniu Meta Pixel Helper albo w raporcie
          Google Analytics „W czasie rzeczywistym”. Tryb wyłączysz linkiem na dole strony albo zamykając kartę.
        </p>
      </section>

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

        <section className="panel">
          <h3>Meta Conversions API (zdarzenia z serwera)</h3>
          <p className="note">
            Serwer wysyła do Meta te same zdarzenia co piksel (odsłony, oglądanie profilu, kontakt, wyszukiwanie, zapytania),
            więc dochodzą także od osób z blokerem reklam i z iPhone&apos;ów. Przy wysłanym zapytaniu dołączamy zahaszowany
            e-mail, telefon i imię, co poprawia dopasowanie konwersji. Działa tylko u osób ze zgodą na marketing, razem z
            pikselem Meta (wpisz jego identyfikator wyżej). Token wygenerujesz w Menedżerze zdarzeń: Źródła danych, piksel,
            Ustawienia, Conversions API, „Wygeneruj token dostępu”.
          </p>
          <div className="tracking-grid">
            <div className="tracking-field">
              <label htmlFor="metaCapiToken">
                Token dostępu Conversions API{" "}
                <span className="chip">{settings.metaCapiToken ? `zapisany (...${settings.metaCapiToken.slice(-4)})` : "brak"}</span>
              </label>
              <input
                id="metaCapiToken"
                name="metaCapiToken"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={settings.metaCapiToken ? "zostaw puste, żeby zachować zapisany token" : "EAAG..."}
              />
              {settings.metaCapiToken && (
                <label className="inline-check">
                  <input type="checkbox" name="metaCapiTokenRemove" /> usuń zapisany token
                </label>
              )}
            </div>
            <div className="tracking-field">
              <label htmlFor="metaTestCode">Kod testowy (nieobowiązkowo, tylko na czas testów)</label>
              <input
                id="metaTestCode"
                name="metaTestCode"
                defaultValue={settings.metaTestCode ?? ""}
                placeholder="TEST12345"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="note">
                Z zakładki Testuj zdarzenia w Menedżerze zdarzeń. Zdarzenia z kodem widać tam na żywo. Po testach usuń kod.
              </p>
            </div>
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
