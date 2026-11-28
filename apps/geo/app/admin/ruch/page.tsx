import { AppShell } from "@/components/shell/AppShell";
import { LineChart } from "@/components/ui/LineChart";
import { BarList, Card, EmptyState, PageHeader, Pill, StatTile } from "@/components/ui/ui";
import { requireAdmin } from "@/lib/auth";
import { formatInt, shortDate } from "@/lib/chart";
import { summarizeTraffic, topBots, trafficSeries } from "@/lib/master";
import { loadReferrers, loadTraffic, MIGRATION_HINT, safely } from "@/lib/master-repo";

export const metadata = { title: "Ruch i boty" };
export const dynamic = "force-dynamic";

export default async function AdminTraffic() {
  const me = await requireAdmin("/admin/ruch");
  const now = new Date();
  const res = await safely(async () => ({ traffic: await loadTraffic(30), referrers: await loadReferrers(15) }));
  const d = res.ok ? res.value : null;
  const sum = d ? summarizeTraffic(d.traffic, now) : null;
  const series = d ? trafficSeries(d.traffic, now, 30) : [];
  const bots = d ? topBots(d.traffic, now, 7, 10) : [];
  const maxBot = Math.max(...bots.map((b) => b.views), 1);
  const maxRef = Math.max(...(d?.referrers.map((r) => r.views) ?? [1]), 1);
  const humanTotal = series.reduce((s, p) => s + p.human, 0);
  const botTotal = series.reduce((s, p) => s + p.bot, 0);

  return (
    <AppShell user={me} current="/admin/ruch">
      <PageHeader eyebrow="Ruch" title="Ruch i boty" sub="Wejścia na portal rankingbiurnieruchomosci.pl liczone po stronie serwera (tabela odwiedzin nie rozróżnia portali, więc to ruch jedynego działającego portalu). Bez adresów IP i danych osobowych." />
      {!d || !sum ? <p className="error" role="alert">{MIGRATION_HINT}</p> : null}

      {d && sum ? (
        <>
          <div className="g4">
            <StatTile icon="eye" tone="good" label="Wejścia ludzi (30 dni)" value={formatInt(sum.humanViews30)} note="pełne wejścia i przejścia w serwisie" />
            <StatTile icon="bolt" label="Wejścia botów (30 dni)" value={formatInt(sum.botViews30)} note="wyszukiwarki, boty AI, podglądy linków" />
            <StatTile icon="users" tone="accent" label="Unikalni odwiedzający" value={formatInt(sum.humanVisitors30)} note="suma dziennych unikalnych, ludzie" />
            <StatTile icon="sparkle" tone="warn" label="Boty AI (7 dni)" value={formatInt(sum.aiBots7.total)} note={`OpenAI: ${sum.aiBots7.groups.OpenAI}, Claude: ${sum.aiBots7.groups.Claude}, Perplexity: ${sum.aiBots7.groups.Perplexity}`} />
          </div>

          <div className="g2 mt-16">
            <Card title="Wejścia ludzi na dzień" sub={`Ostatnie 30 dni, razem ${formatInt(humanTotal)}`}>
              {humanTotal > 0 ? (
                <LineChart ariaLabel="Wejścia ludzi na dzień w ostatnich 30 dniach" format="int" yLabel="Wejścia ludzi" points={series.map((p) => ({ date: p.day, value: p.human, title: `${shortDate(p.day)}: ${p.human}` }))} />
              ) : (
                <EmptyState icon="eye" title="Brak wejść ludzi w ostatnich 30 dniach" />
              )}
            </Card>
            <Card title="Wejścia botów na dzień" sub={`Ostatnie 30 dni, razem ${formatInt(botTotal)}`}>
              {botTotal > 0 ? (
                <LineChart ariaLabel="Wejścia botów na dzień w ostatnich 30 dniach" format="int" yLabel="Wejścia botów" points={series.map((p) => ({ date: p.day, value: p.bot, title: `${shortDate(p.day)}: ${p.bot}` }))} />
              ) : (
                <EmptyState icon="bolt" title="Brak wejść botów w ostatnich 30 dniach" />
              )}
            </Card>
          </div>

          <div className="g2 mt-16">
            <Card title="Najczęstsze boty (7 dni)" sub="Boty AI oznaczone">
              <BarList
                ranked
                empty="Brak wejść botów w ostatnich 7 dniach."
                items={bots.map((b) => ({ key: b.bot, label: b.bot, valueText: formatInt(b.views), ratio: b.views / maxBot, badge: b.ai ? <Pill tone="brand">AI: {b.ai}</Pill> : undefined, highlight: Boolean(b.ai) }))}
              />
            </Card>
            <Card title="Najczęstsze źródła wejść (30 dni)" sub="Tylko ludzie, domena odsyłająca bez ścieżki">
              <BarList
                ranked
                empty="Brak wejść z zewnętrznych źródeł."
                items={d.referrers.map((r) => ({ key: r.host, label: r.host, sub: `${formatInt(r.visitors)} odwiedzających`, valueText: formatInt(r.views), ratio: r.views / maxRef }))}
              />
            </Card>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
