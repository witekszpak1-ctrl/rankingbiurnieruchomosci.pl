import Link from "next/link";

import { AppShell } from "@/components/shell/AppShell";
import { Checklist, Card, DataTable, EmptyState, PageHeader, Pill, StatTile } from "@/components/ui/ui";
import { loadOverview } from "@/lib/admin-repo";
import { formatDateTime, PLATFORM_LABEL } from "@/lib/admin-stats";
import { requireAdmin } from "@/lib/auth";
import { formatInt } from "@/lib/chart";
import {
  ageHours, buildAlerts, formatAge, formatUsd, groupUsage, litescrapeCostUsd, RUN_STATUS_LABEL, runTone, splitUsage, summarizeTraffic, STAGE_MAX_AGE_HOURS,
} from "@/lib/master";
import {
  DOMAIN_STATUS_LABEL, listPortals, loadApiUsage, loadCatalogTotals, loadFailedMeasurements48h, loadFailedRuns24h, loadLastRunPerStage, loadLeadsAndRequests,
  loadTraffic, MIGRATION_HINT, safely,
} from "@/lib/master-repo";

export const metadata = { title: "Przegląd całości" };
export const dynamic = "force-dynamic";

async function loadMaster() {
  const [portals, totals, lastRuns, failedRuns, failedMeasure, usage, traffic, leads] = await Promise.all([
    listPortals(), loadCatalogTotals(), loadLastRunPerStage(), loadFailedRuns24h(), loadFailedMeasurements48h(), loadApiUsage(), loadTraffic(30), loadLeadsAndRequests(),
  ]);
  return { portals, totals, lastRuns, failedRuns, failedMeasure, usage, traffic, leads };
}

export default async function AdminMaster() {
  const me = await requireAdmin("/admin");
  const now = new Date();
  const [o, mres] = await Promise.all([loadOverview(), safely(loadMaster)]);
  const m = mres.ok ? mres.value : null;
  const accounts = o.accountsByPlan.reduce((s, p) => s + p.count, 0);
  const done = o.measurementsByPlatform.reduce((s, p) => s + p.done, 0);
  const plans = o.accountsByPlan.map((p) => `${p.plan}: ${p.count}`).join(", ");

  const alerts = m
    ? buildAlerts({ now, lastRuns: m.lastRuns, failedRuns24h: m.failedRuns, failedMeasurements48h: m.failedMeasure, lastMeasuredAt: o.lastMeasuredAt,
        portals: m.portals.map((p) => ({ slug: p.slug, name: p.name, status: p.status, domain: p.domain, published: p.published, domains: p.domainsTotal })) })
    : [];

  const traffic = m ? summarizeTraffic(m.traffic, now) : null;
  const month = now.toISOString().slice(0, 7);
  const usage = m ? groupUsage(m.usage.rows).find((x) => x.month === month) : undefined;
  const split = splitUsage(usage?.services ?? {});
  const byStatus = (s: string) => m?.portals.filter((p) => p.status === s).length ?? 0;

  return (
    <AppShell user={me} current="/admin">
      <PageHeader eyebrow="Master Dashboard" title="Przegląd całości" sub="Portale, wspólny rejestr firm, robot danych, pomiary AI i biznes GeoTrace w jednym miejscu. Dane z bazy, bez płatnych zapytań." />

      {!m ? <p className="error" role="alert">{MIGRATION_HINT}</p> : null}

      {m ? (
        <Card title="Wymaga uwagi" sub="Wyliczane z danych przy każdym wejściu">
          {alerts.length ? (
            <Checklist
              mode="attention"
              items={alerts.map((a) => ({ key: a.key, title: a.title, hint: a.detail, tone: a.tone, href: a.href, action: "Zobacz" }))}
            />
          ) : (
            <EmptyState icon="check" title="Nic nie wymaga uwagi">Robot działa na czas, pomiary są świeże, portale mają dane.</EmptyState>
          )}
        </Card>
      ) : null}

      <h2 className="sec">Portale i katalog</h2>
      <div className="g4">
        <StatTile icon="globe" tone="good" label="Portale" value={m ? `${byStatus("live")} / ${byStatus("private")} / ${byStatus("planned")}` : "-"} note="działa / prywatne / planowane" href="/admin/portale" />
        <StatTile icon="building" label="Firmy w rejestrze" value={m ? formatInt(m.totals.brands) : "-"} note="marki z ofertami w katalogu (bez odrzuconych)" href="/admin/portale" />
        <StatTile icon="check" tone="good" label="Opublikowane profile" value={m ? formatInt(m.totals.published) : "-"} note="oferty ze statusem opublikowana" href="/admin/portale" />
        <StatTile
          icon="database"
          tone="accent"
          label="Domeny"
          value={m ? formatInt(m.totals.domainsTotal) : "-"}
          note={m ? m.totals.domainsByStatus.map((d) => `${DOMAIN_STATUS_LABEL[d.status]}: ${formatInt(d.count)}`).join(", ") : undefined}
          href="/admin/robot"
        />
      </div>

      <h2 className="sec">Widoczność w AI</h2>
      <div className="g4">
        <StatTile icon="pulse" label="Odpowiedzi AI zmierzone" value={formatInt(done)} note={`ostatni pomiar: ${formatDateTime(o.lastMeasuredAt)}`} href="/admin/pomiary" />
        <StatTile icon="link" tone="good" label="Cytowania naszych portali" value={formatInt(o.citations.ownPortal)} note={`cytowania razem: ${formatInt(o.citations.total)}`} href="/admin/zrodla" />
        <StatTile icon="sparkle" tone="accent" label="Platformy z pomiarem" value={o.measurementsByPlatform.filter((p) => p.done > 0).length} note={o.measurementsByPlatform.filter((p) => p.done > 0).map((p) => PLATFORM_LABEL[p.platform] ?? p.platform).join(", ") || "brak"} href="/admin/ai" />
        <StatTile icon="search" tone="warn" label="Kandydaci spoza katalogu" value={formatInt(o.mentions.unmatched)} note="wzmianki firm bez dopasowania" href="/admin/firmy?typ=unmatched" />
      </div>

      <h2 className="sec">GeoTrace (biznes)</h2>
      <div className="g4">
        <StatTile icon="users" label="Użytkownicy" value={o.users.total} note={`konta firm: ${accounts}${plans ? ` (${plans})` : ""}`} href="/admin/uzytkownicy" />
        <StatTile icon="gift" tone="good" label="Partnerzy" value={`${o.affiliates.active} / ${o.affiliates.total}`} note={`aktywni / wszyscy, polecone konta: ${o.referrals}`} href="/admin/partnerzy" />
        <StatTile icon="mail" tone="warn" label="Lista oczekujących" value={o.waitlist} href="/admin/lista" />
        <StatTile icon="mail" tone="accent" label="Zapytania klientów (30 dni)" value={m ? formatInt(m.leads.leads30d) : "-"} note={m ? `zgłoszenia firm do obsługi: ${m.leads.requestsNew + m.leads.claimsNew}` : undefined} />
      </div>

      <h2 className="sec">Ruch i koszty</h2>
      <div className="g4">
        <StatTile icon="eye" label="Wejścia ludzi (30 dni)" value={traffic ? formatInt(traffic.humanViews30) : "-"} note={traffic ? `boty: ${formatInt(traffic.botViews30)}, portal nieruchomości` : undefined} href="/admin/ruch" />
        <StatTile
          icon="bolt"
          tone="accent"
          label="Boty AI (7 dni)"
          value={traffic ? formatInt(traffic.aiBots7.total) : "-"}
          note={traffic ? `OpenAI: ${traffic.aiBots7.groups.OpenAI}, Claude: ${traffic.aiBots7.groups.Claude}, Perplexity: ${traffic.aiBots7.groups.Perplexity}` : undefined}
          href="/admin/ruch"
        />
        <StatTile icon="wallet" tone="warn" label={`LiteScrape (${month})`} value={m ? formatInt(split.litescrape) : "-"} unit="zapytań" note={m ? `szacunek ${formatUsd(litescrapeCostUsd(split.litescrape))}` : undefined} href="/admin/koszty" />
        <StatTile icon="database" label="Kolejka robota" value={m ? formatInt(m.totals.queueProbe + m.totals.queueVerify) : "-"} note={m ? `do sprawdzenia: ${m.totals.queueProbe}, do weryfikacji: ${m.totals.queueVerify}` : undefined} href="/admin/robot" />
      </div>

      <Card flush className="mt-16" title="Robot danych" sub="Ostatni przebieg każdego etapu" actions={<Link href="/admin/robot" className="btn ghost sm">Szczegóły</Link>}>
        {m ? (
          <DataTable
            columns={[
              { header: "Etap", cell: (r: (typeof m.lastRuns)[number]) => <Link href={`/admin/robot?etap=${encodeURIComponent(r.stage)}`}>{r.stage}</Link> },
              { header: "Status", cell: (r) => <Pill tone={runTone(r.status)} dot>{RUN_STATUS_LABEL[r.status] ?? r.status}</Pill> },
              { header: "Branża", cell: (r) => r.vertical ?? "wszystkie" },
              { header: "Start", cell: (r) => formatDateTime(r.startedAt) },
              {
                header: "Wiek",
                cell: (r) => {
                  const h = ageHours(r.startedAt, now);
                  return <span className={h !== null && h > STAGE_MAX_AGE_HOURS && h <= 168 ? "stale" : undefined}>{formatAge(h)}</span>;
                },
              },
            ]}
            rows={m.lastRuns}
            rowKey={(r) => r.stage}
            empty="Robot nie zapisał jeszcze żadnego przebiegu."
          />
        ) : (
          <EmptyState icon="alert" title="Brak danych robota">{MIGRATION_HINT}</EmptyState>
        )}
      </Card>
    </AppShell>
  );
}
