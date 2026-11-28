import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/shell/AppShell";
import { LineChart } from "@/components/ui/LineChart";
import { BarList, Card, DataTable, Donut, EmptyState, PageHeader, Pill, StatTile } from "@/components/ui/ui";
import { fillDays, formatDate, formatDateTime, formatShare } from "@/lib/admin-stats";
import { requireAdmin } from "@/lib/auth";
import { formatInt, shortDate } from "@/lib/chart";
import { PORTAL_STATUS_LABEL, portalTone, vercelProjectUrl } from "@/lib/master";
import { DOMAIN_STATUS_LABEL, getPortal, loadPortalDetail, MIGRATION_HINT, safely } from "@/lib/master-repo";

export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9-]{2,40}$/;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `Portal ${slug}` };
}

export default async function AdminPortalDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await requireAdmin(`/admin/portale/${slug}`);
  if (!SLUG_RE.test(slug)) notFound();
  const pres = await safely(() => getPortal(slug));
  if (pres.ok && !pres.value) notFound();
  const portal = pres.ok ? pres.value : null;
  const dres = portal ? await safely(() => loadPortalDetail(slug)) : null;
  const d = dres && dres.ok ? dres.value : null;
  const series = d ? fillDays(d.domainsDaily.map((x) => ({ day: x.day, count: x.count })), new Date().toISOString().slice(0, 10), 30) : [];
  const seriesTotal = series.reduce((s, p) => s + p.count, 0);
  const maxCity = Math.max(...(d?.cities.map((c) => c.published) ?? [1]), 1);
  const statusTotal = d?.statusCounts.reduce((s, x) => s + x.count, 0) ?? 0;
  const vercel = vercelProjectUrl(portal?.vercelProject);

  return (
    <AppShell user={me} current={`/admin/portale/${slug}`}>
      <PageHeader
        eyebrow={<Link href="/admin/portale">Portale</Link>}
        title={portal?.name ?? slug}
        sub={portal ? <><Pill tone={portalTone(portal.status)} dot>{PORTAL_STATUS_LABEL[portal.status]}</Pill> {portal.domain ?? "brak domeny"}{portal.notes ? `. ${portal.notes}` : ""}</> : undefined}
        actions={
          <>
            {portal?.url ? <a className="btn ghost sm" href={portal.url} target="_blank" rel="noopener noreferrer">Portal</a> : null}
            {vercel ? <a className="btn ghost sm" href={vercel} target="_blank" rel="noopener noreferrer">Vercel</a> : null}
          </>
        }
      />
      {!portal || !d ? <p className="error" role="alert">{MIGRATION_HINT}</p> : null}

      {portal && d ? (
        <>
          {!portal.hasStats ? (
            <p className="muted small">Ten portal nie ma jeszcze branży w katalogu (brak wiersza w tabeli branż), więc nie ma statystyk danych.</p>
          ) : null}
          <div className="g4">
            <StatTile icon="check" tone="good" label="Opublikowane profile" value={formatInt(portal.published)} note={`firmy w rejestrze: ${formatInt(portal.brands)}`} />
            <StatTile icon="globe" label="Miasta z profilami" value={formatInt(portal.publishedCities)} note={`ostatnia publikacja: ${formatDate(portal.lastPublishedAt)}`} />
            <StatTile icon="database" tone="accent" label="Domeny znalezione" value={formatInt(portal.domainsTotal)} note={`ostatnia nowa: ${formatDate(portal.lastDomainAt)}`} />
            <StatTile icon="pulse" tone="warn" label="Odpowiedzi AI (branża)" value={formatInt(d.ai.answers)} note={`ostatni pomiar: ${formatDateTime(d.ai.lastMeasuredAt)}`} />
          </div>

          <div className="g2 mt-16">
            <Card title="Opublikowane profile według miast" sub="15 miast z największą liczbą">
              <BarList
                ranked
                empty="Brak opublikowanych profili."
                items={d.cities.map((c) => ({ key: c.city, label: c.city, valueText: c.published, ratio: c.published / maxCity }))}
              />
            </Card>
            <Card title="Domeny według statusu weryfikacji" sub={`Razem ${formatInt(statusTotal)}`}>
              {statusTotal > 0 ? (
                <Donut
                  centerValue={formatInt(statusTotal)}
                  centerLabel="domen"
                  segments={d.statusCounts.filter((s) => s.count > 0).map((s) => ({ label: DOMAIN_STATUS_LABEL[s.status] ?? s.status, value: s.count }))}
                />
              ) : (
                <EmptyState icon="database" title="Brak domen">Robot nie zebrał jeszcze domen dla tej branży.</EmptyState>
              )}
            </Card>
          </div>

          <Card className="mt-16" title="Nowe domeny dziennie" sub={`Ostatnie 30 dni, razem ${formatInt(seriesTotal)}`}>
            {seriesTotal > 0 ? (
              <LineChart
                ariaLabel="Liczba nowych domen na dzień w ostatnich 30 dniach"
                format="int"
                yLabel="Nowe domeny na dzień"
                points={series.map((p) => ({ date: p.day, value: p.count, title: `${shortDate(p.day)}: ${p.count}` }))}
              />
            ) : (
              <EmptyState icon="pulse" title="Brak nowych domen w ostatnich 30 dniach" />
            )}
          </Card>

          <h2 className="sec">Pomiary AI dla branży</h2>
          <div className="g2">
            <Card flush title="Najczęściej wymieniane firmy" sub={`Z gotowych odpowiedzi dla branży (${d.ai.answers})`}>
              <DataTable
                columns={[
                  { header: "Firma", cell: (f: (typeof d.ai.topFirms)[number]) => <>{f.name} {f.inCatalog ? <span className="pill own">w katalogu</span> : null}</> },
                  { header: "Odpowiedzi", num: true, cell: (f) => f.answers },
                  { header: "Udział", cell: (f) => formatShare(f.answers, d.ai.answers) },
                  { header: "Polecona", num: true, cell: (f) => f.recommended },
                ]}
                rows={d.ai.topFirms}
                rowKey={(f) => f.name}
                empty="Brak pomiarów dla tej branży (pytania z industry = slug)."
              />
            </Card>
            <Card title="Cytowania naszego portalu" sub="Odpowiedzi ze źródłami">
              <div className="t-val">{formatShare(d.ai.ownCitations, d.ai.answersWithCitations)}</div>
              <p className="note">Odpowiedzi cytujące nasz portal wśród odpowiedzi ze źródłami: {d.ai.answersWithCitations}. Nieudane pomiary: {d.ai.failed}.</p>
              <p className="note"><Link href="/admin/pomiary">Wszystkie pomiary</Link></p>
            </Card>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
