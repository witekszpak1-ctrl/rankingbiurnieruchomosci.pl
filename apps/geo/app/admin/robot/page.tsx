import Link from "next/link";

import { AppShell } from "@/components/shell/AppShell";
import { type SP } from "@/components/Notice";
import { LineChart } from "@/components/ui/LineChart";
import { Card, DataTable, EmptyState, PageHeader, Pill } from "@/components/ui/ui";
import { formatDateTime } from "@/lib/admin-stats";
import { requireAdmin } from "@/lib/auth";
import { formatInt, shortDate } from "@/lib/chart";
import { dailySeries, formatCounts, formatDuration, parseRunFilters, RUN_STATUS_LABEL, runTone } from "@/lib/master";
import { loadQueues, loadRunFilterOptions, loadRuns, loadSearchDaily, MIGRATION_HINT, safely } from "@/lib/master-repo";

export const metadata = { title: "Robot i kolejki" };
export const dynamic = "force-dynamic";

async function load(f: ReturnType<typeof parseRunFilters>) {
  const [runs, failed, options, search, queues] = await Promise.all([loadRuns(f, 7), loadRuns({ stage: "", status: "failed", vertical: "" }, 7, 20), loadRunFilterOptions(), loadSearchDaily(30), loadQueues()]);
  return { runs, failed, options, search, queues };
}

export default async function AdminRobot({ searchParams }: { searchParams: SP }) {
  const me = await requireAdmin("/admin/robot");
  const f = parseRunFilters(await searchParams);
  const now = new Date();
  const res = await safely(() => load(f));
  const d = res.ok ? res.value : null;
  const providers = d ? [...new Set(d.search.map((r) => r.provider))].sort() : [];
  const filtered = Boolean(f.stage || f.status || f.vertical);

  return (
    <AppShell user={me} current="/admin/robot">
      <PageHeader eyebrow="Dane" title="Robot i kolejki" sub="Przebiegi robota danych (GitHub Actions), wyszukiwania na dzień i kolejki domen do sprawdzenia. Tylko odczyt." />
      {!d ? <p className="error" role="alert">{MIGRATION_HINT}</p> : null}

      {d ? (
        <>
          <form method="get" action="/admin/robot" className="filters">
            <label>Etap
              <select name="etap" defaultValue={f.stage}>
                <option value="">wszystkie</option>
                {d.options.stages.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>Status
              <select name="status" defaultValue={f.status}>
                <option value="">wszystkie</option>
                <option value="ok">ok</option>
                <option value="failed">błąd</option>
                <option value="running">w toku</option>
              </select>
            </label>
            <label>Branża
              <select name="branza" defaultValue={f.vertical}>
                <option value="">wszystkie</option>
                {d.options.verticals.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <button type="submit">Pokaż</button>
            {filtered ? <Link href="/admin/robot" className="btn ghost">Wyczyść</Link> : null}
          </form>

          <Card flush title={`Przebiegi z 7 dni (${d.runs.length})`} sub="Najnowsze na górze, do 300 pozycji">
            <DataTable
              columns={[
                { header: "Start", cell: (r: (typeof d.runs)[number]) => formatDateTime(r.startedAt) },
                { header: "Etap", cell: (r) => r.stage },
                { header: "Branża", cell: (r) => r.vertical ?? "wszystkie" },
                { header: "Status", cell: (r) => <Pill tone={runTone(r.status)} dot>{RUN_STATUS_LABEL[r.status] ?? r.status}</Pill> },
                { header: "Czas", cell: (r) => formatDuration(r.startedAt, r.finishedAt) },
                { header: "Liczniki", cell: (r) => <span className="small">{formatCounts(r.counts)}</span> },
                { header: "Koszt", num: true, cell: (r) => (r.costUsd > 0 ? `${r.costUsd.toFixed(4).replace(".", ",")} USD` : "-") },
              ]}
              rows={d.runs}
              rowKey={(r) => r.id}
              empty="Brak przebiegów w tym zakresie."
            />
          </Card>

          <Card flush className="mt-16" title="Błędy robota" sub="Nieudane przebiegi z 7 dni z treścią błędu (do 20)">
            <DataTable
              columns={[
                { header: "Start", cell: (r: (typeof d.failed)[number]) => formatDateTime(r.startedAt) },
                { header: "Etap", cell: (r) => r.stage },
                { header: "Branża", cell: (r) => r.vertical ?? "wszystkie" },
                { header: "Błąd", cell: (r) => <span className="errtext">{r.error ?? "brak komunikatu"}</span> },
              ]}
              rows={d.failed}
              rowKey={(r) => r.id}
              empty="Brak nieudanych przebiegów w ostatnich 7 dniach."
            />
          </Card>

          <h2 className="sec">Wyszukiwania na dzień (30 dni)</h2>
          {providers.length ? (
            <div className="g2">
              {providers.map((p) => {
                const rows = d.search.filter((r) => r.provider === p);
                const series = dailySeries(rows.map((r) => ({ day: r.day, value: r.queries })), now, 30);
                const total = series.reduce((s, x) => s + x.value, 0);
                const newDomains = rows.reduce((s, r) => s + r.newDomains, 0);
                return (
                  <Card key={p} title={`Dostawca: ${p}`} sub={`${formatInt(total)} zapytań, ${formatInt(newDomains)} nowych domen`}>
                    <LineChart
                      ariaLabel={`Zapytania wyszukiwania na dzień, dostawca ${p}`}
                      format="int"
                      height={200}
                      yLabel="Zapytania na dzień"
                      points={series.map((x) => ({ date: x.day, value: x.value, title: `${shortDate(x.day)}: ${x.value}` }))}
                    />
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card><EmptyState icon="search" title="Brak zapytań wyszukiwania w ostatnich 30 dniach" /></Card>
          )}

          <Card flush className="mt-16" title="Kolejki per branża" sub="Domeny czekające na sprawdzenie strony i na weryfikację firmy">
            <DataTable
              columns={[
                { header: "Branża", cell: (q: (typeof d.queues)[number]) => <Link href={`/admin/portale/${q.slug}`}>{q.name}</Link> },
                { header: "Do sprawdzenia strony", num: true, cell: (q) => formatInt(q.probe) },
                { header: "Do weryfikacji firmy", num: true, cell: (q) => formatInt(q.verify) },
                { header: "Do przeglądu", num: true, cell: (q) => formatInt(q.review) },
                { header: "Kandydaci razem", num: true, cell: (q) => formatInt(q.candidate) },
              ]}
              rows={d.queues}
              rowKey={(q) => q.slug}
              empty="Brak branż w katalogu."
            />
          </Card>
          <p className="note">Do sprawdzenia strony: domena nieznanej klasy i status kandydat. Do weryfikacji firmy: domena oficjalna albo niepewna, jeszcze kandydat. Zapytania sprzed obsługi wielu branż liczymy jako nieruchomości.</p>
        </>
      ) : null}
    </AppShell>
  );
}
