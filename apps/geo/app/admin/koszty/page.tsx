import { AppShell } from "@/components/shell/AppShell";
import { BarList, Card, DataTable, EmptyState, PageHeader, StatTile } from "@/components/ui/ui";
import { requireAdmin } from "@/lib/auth";
import { formatInt } from "@/lib/chart";
import { formatUsd, groupUsage, KIND_LABEL, LITESCRAPE_USD_PER_1000, litescrapeCostUsd, SERVICE_LABEL, splitUsage } from "@/lib/master";
import { loadApiUsage, MIGRATION_HINT, safely } from "@/lib/master-repo";

export const metadata = { title: "Koszty API" };
export const dynamic = "force-dynamic";

export default async function AdminCosts() {
  const me = await requireAdmin("/admin/koszty");
  const res = await safely(loadApiUsage);
  const usage = res.ok ? res.value : null;
  const months = usage ? groupUsage(usage.rows) : [];
  const thisMonth = new Date().toISOString().slice(0, 7);
  const current = months.find((m) => m.month === thisMonth);
  const cur = splitUsage(current?.services ?? {});
  const maxLs = Math.max(...months.map((m) => splitUsage(m.services).litescrape), 1);
  const limits = new Map((usage?.limits ?? []).map((l) => [l.service, l.limit]));
  const lsLimit = limits.get("litescrape");

  return (
    <AppShell user={me} current="/admin/koszty">
      <PageHeader eyebrow="Dane" title="Koszty API" sub="Liczniki płatnych zapytań z ustawienia api_usage (zapisuje je robot). Tylko odczyt: nic tu nie wysyła zapytań do dostawców." />
      {!usage ? <p className="error" role="alert">{MIGRATION_HINT}</p> : null}

      {usage ? (
        <>
          <div className="g4">
            <StatTile icon="wallet" tone="warn" label={`LiteScrape, ${thisMonth}`} value={formatInt(cur.litescrape)} unit="zapytań" note={lsLimit ? `limit miesięczny: ${formatInt(lsLimit)}` : "bez limitu w ustawieniach"} />
            <StatTile icon="database" tone="accent" label="Szacowany koszt LiteScrape" value={formatUsd(litescrapeCostUsd(cur.litescrape))} note={`${LITESCRAPE_USD_PER_1000.toString().replace(".", ",")} USD za 1000 zapytań, szacunek`} />
            {cur.others.filter((o) => o.service !== "google_places").slice(0, 2).map((o) => (
              <StatTile key={o.service} icon="chart" label={`${SERVICE_LABEL[o.service] ?? o.service}, ${thisMonth}`} value={formatInt(o.count)} unit="zapytań" note={limits.get(o.service) ? `limit: ${formatInt(limits.get(o.service) as number)}` : "koszt: w panelu dostawcy"} />
            ))}
          </div>

          <div className="g2 mt-16">
            <Card title="LiteScrape: zapytania według miesięcy" sub="Szacunek kosztu przy stałej cenie, saldo sprawdzaj u dostawcy">
              <BarList
                empty="Brak liczników LiteScrape."
                items={months.map((m) => {
                  const n = splitUsage(m.services).litescrape;
                  return { key: m.month, label: m.month, valueText: `${formatInt(n)} zap. (${formatUsd(litescrapeCostUsd(n))})`, ratio: n / maxLs, highlight: m.month === thisMonth };
                })}
              />
            </Card>
            <Card title={`LiteScrape według rodzaju, ${thisMonth}`} sub="Podliczniki zapisywane przez robota">
              <BarList
                empty="Brak podliczników w tym miesiącu."
                items={cur.litescrapeKinds.map((k) => ({
                  key: k.kind,
                  label: KIND_LABEL[k.kind] ?? k.kind,
                  sub: k.kind in KIND_LABEL ? undefined : "(rodzaj bez opisu)",
                  valueText: `${formatInt(k.count)} (${formatUsd(litescrapeCostUsd(k.count))})`,
                  ratio: k.count / Math.max(cur.litescrape, 1),
                }))}
              />
              <p className="note">Podliczniki to rozbicie licznika głównego, więc nie sumuj ich z nim.</p>
            </Card>
          </div>

          <Card flush className="mt-16" title="Pozostali dostawcy" sub="Liczba zapytań w miesiącu, koszt tylko w panelu dostawcy">
            <DataTable
              columns={[
                { header: "Miesiąc", cell: (m: (typeof months)[number]) => m.month },
                { header: "LiteScrape", num: true, cell: (m) => formatInt(splitUsage(m.services).litescrape) },
                { header: "Szac. koszt LiteScrape", num: true, cell: (m) => formatUsd(litescrapeCostUsd(splitUsage(m.services).litescrape)) },
                { header: "Pozostali", cell: (m) => splitUsage(m.services).others.map((o) => `${SERVICE_LABEL[o.service] ?? o.service}: ${formatInt(o.count)}`).join(", ") || "-" },
              ]}
              rows={months}
              rowKey={(m) => m.month}
              empty="Licznik api_usage jest jeszcze pusty."
            />
          </Card>

          <Card className="mt-16" title="Neon i Vercel">
            <p className="small">Koszty bazy danych i hostingu nie trafiają do naszych liczników. Sprawdzaj je w panelach dostawców.</p>
            <p className="small">
              <a href="https://console.neon.tech" target="_blank" rel="noopener noreferrer">Neon (konsola)</a>{" | "}
              <a href="https://vercel.com/witek1/~/usage" target="_blank" rel="noopener noreferrer">Vercel (zużycie)</a>
            </p>
          </Card>
          {!months.length ? <EmptyState icon="info" title="Licznik api_usage jest pusty">Robot zapisze zużycie po pierwszym płatnym zapytaniu.</EmptyState> : null}
        </>
      ) : null}
    </AppShell>
  );
}
