import Link from "next/link";

import { AppShell } from "@/components/shell/AppShell";
import { LineChart } from "@/components/ui/LineChart";
import { BarList, Card, DataTable, Donut, EmptyState, PageHeader, StatTile } from "@/components/ui/ui";
import { loadMeasurementsPerDay, loadOverview, loadSources } from "@/lib/admin-repo";
import { fillDays, formatDateTime, formatShare, PLATFORM_LABEL } from "@/lib/admin-stats";
import { formatPln } from "@/lib/affiliate";
import { requireAdmin } from "@/lib/auth";
import { formatInt, shortDate } from "@/lib/chart";

export const metadata = { title: "Widoczność AI - przegląd" };
export const dynamic = "force-dynamic";

const DAYS = 30;

export default async function AdminOverview() {
  const me = await requireAdmin("/admin/ai");
  const [o, perDay, sources] = await Promise.all([loadOverview(), loadMeasurementsPerDay(DAYS), loadSources("")]);
  const mentionTotal = o.mentions.matched + o.mentions.unmatched;
  const series = fillDays(perDay, new Date().toISOString().slice(0, 10), DAYS);
  const dayTotal = series.reduce((s, p) => s + p.count, 0);
  const done = o.measurementsByPlatform.reduce((s, p) => s + p.done, 0);
  const failed = o.measurementsByPlatform.reduce((s, p) => s + p.failed, 0);
  const topSources = sources.top.slice(0, 8);
  const maxSrc = Math.max(...topSources.map((r) => r.answers), 1);
  const accounts = o.accountsByPlan.reduce((s, p) => s + p.count, 0);

  return (
    <AppShell user={me} current="/admin/ai">
      <PageHeader eyebrow="Administracja" title="Widoczność AI - przegląd" sub="Dane z bazy, bez zapytań do dostawców AI. Odświeżane przy każdym wejściu." />

      <div className="g4">
        <StatTile icon="database" label="Pomiary gotowe" value={formatInt(done)} note={failed ? `${failed} z błędem` : "bez błędów"} href="/admin/pomiary" />
        <StatTile icon="globe" tone="accent" label="Miasta z pomiarem" value={o.citiesMeasured} note={`${o.prompts} pytań w bibliotece`} href="/admin/pomiary" />
        <StatTile icon="users" tone="good" label="Użytkownicy" value={o.users.total} note={`administratorzy: ${o.users.admins}, wyłączeni: ${o.users.disabled}`} href="/admin/uzytkownicy" />
        <StatTile icon="mail" tone="warn" label="Lista oczekujących" value={o.waitlist} note={`konta firm: ${accounts}`} href="/admin/lista" />
      </div>

      <div className="g2 mt-16">
        <Card title="Pomiary w ostatnich 30 dniach" sub={`${dayTotal} pomiarów, ostatni: ${formatDateTime(o.lastMeasuredAt)}`}>
          {dayTotal > 0 ? (
            <LineChart
              ariaLabel="Liczba pomiarów na dzień w ostatnich 30 dniach"
              format="int"
              yLabel="Pomiary na dzień"
              points={series.map((p) => ({ date: p.day, value: p.count, title: `${shortDate(p.day)}: ${p.count}` }))}
            />
          ) : (
            <EmptyState icon="pulse" title="Brak pomiarów w ostatnich 30 dniach">Wykres pojawi się po pierwszym pomiarze.</EmptyState>
          )}
        </Card>
        <Card title="Pomiary według platformy" sub="Gotowe odpowiedzi">
          {done > 0 ? (
            <Donut
              centerValue={formatInt(done)}
              centerLabel="odpowiedzi"
              segments={o.measurementsByPlatform.filter((p) => p.done > 0).map((p) => ({ label: PLATFORM_LABEL[p.platform] ?? p.platform, value: p.done }))}
            />
          ) : (
            <EmptyState icon="pulse" title="Brak gotowych pomiarów" />
          )}
        </Card>
      </div>

      <div className="g2 mt-16">
        <Card title="Najczęściej cytowane źródła" sub={`W ${sources.answersWithCitations} odpowiedziach ze źródłami`} actions={<Link href="/admin/zrodla" className="btn ghost sm">Wszystkie</Link>}>
          <BarList
            ranked
            empty="Brak cytowań."
            items={topSources.map((r) => ({
              key: r.domain,
              label: r.domain,
              valueText: `${r.answers} z ${sources.answersWithCitations}`,
              ratio: r.answers / maxSrc,
              highlight: r.own,
              badge: r.own ? <span className="pill own">nasz portal</span> : undefined,
            }))}
          />
          <p className="note">
            Odpowiedzi cytujące nasz portal: {formatShare(o.citations.answersCitingOwn, o.citations.answersWithCitations)} odpowiedzi ze źródłami.
          </p>
        </Card>
        <Card flush title="Stan pomiarów" sub="Według platformy">
          <DataTable
            columns={[
              { header: "Platforma", cell: (p: (typeof o.measurementsByPlatform)[number]) => PLATFORM_LABEL[p.platform] ?? p.platform },
              { header: "Gotowe", num: true, cell: (p) => <Link href={`/admin/pomiary?platforma=${p.platform}&status=done`}>{p.done}</Link> },
              { header: "Błędy", num: true, cell: (p) => (p.failed ? <Link href={`/admin/pomiary?platforma=${p.platform}&status=failed`}>{p.failed}</Link> : 0) },
              { header: "W toku", num: true, cell: (p) => p.other },
              { header: "Ostatni", cell: (p) => formatDateTime(p.last) },
            ]}
            rows={o.measurementsByPlatform}
            rowKey={(p) => p.platform}
            empty="Brak pomiarów."
          />
        </Card>
      </div>

      <h2 className="sec">Firmy i źródła w odpowiedziach</h2>
      <div className="g4">
        <StatTile icon="building" tone="good" label="Wzmianki z katalogu" value={formatInt(o.mentions.matched)} note={`dopasowanie: ${formatShare(o.mentions.matched, mentionTotal)}`} href="/admin/firmy?typ=matched" />
        <StatTile icon="search" tone="warn" label="Kandydaci (bez dopasowania)" value={formatInt(o.mentions.unmatched)} note="wzmianki firm spoza katalogu" href="/admin/firmy?typ=unmatched" />
        <StatTile icon="link" label="Cytowania naszego portalu" value={formatInt(o.citations.ownPortal)} href="/admin/zrodla" />
        <StatTile icon="list" tone="accent" label="Cytowania razem" value={formatInt(o.citations.total)} href="/admin/zrodla" />
      </div>

      <h2 className="sec">Konta i program partnerski</h2>
      <div className="g2">
        <Card flush title="Konta według pakietu">
          <DataTable
            columns={[
              { header: "Pakiet", cell: (p: (typeof o.accountsByPlan)[number]) => p.plan },
              { header: "Konta", num: true, cell: (p) => p.count },
            ]}
            rows={o.accountsByPlan}
            rowKey={(p) => p.plan}
            empty="Brak kont."
          />
        </Card>
        <div className="g2">
          <StatTile icon="users" label="Partnerzy" value={`${o.affiliates.active} / ${o.affiliates.total}`} note="aktywni / wszyscy" href="/admin/partnerzy" />
          <StatTile icon="eye" tone="accent" label="Kliknięcia linków" value={o.clicks30d} note="ostatnie 30 dni" />
          <StatTile icon="gift" tone="good" label="Polecone konta" value={o.referrals} />
          <StatTile icon="wallet" tone="warn" label="Do wypłaty" value={formatPln(o.commissions.availableGrosze)} note={`w okresie zwrotów: ${formatPln(o.commissions.pendingGrosze)}, wypłacone: ${formatPln(o.commissions.paidGrosze)}`} href="/admin/partnerzy" />
        </div>
      </div>
    </AppShell>
  );
}
