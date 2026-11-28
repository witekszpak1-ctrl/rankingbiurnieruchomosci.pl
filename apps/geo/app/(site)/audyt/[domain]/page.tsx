import type { Metadata } from "next";
import Link from "next/link";

import { Notice, one, type SP } from "@/components/Notice";
import { WaitlistForm } from "@/components/WaitlistForm";
import { Icon } from "@/components/ui/Icon";
import { LineChart } from "@/components/ui/LineChart";
import { BarList, Card, Checklist, DataTable, EmptyState, Gauge, Pill, Segmented, StatTile, type BarItem } from "@/components/ui/ui";
import { OWN_PORTAL_DOMAIN, normalizeDomain, type AuditResult, type MetricRow } from "@/lib/audit";
import { loadAudit } from "@/lib/audit-cache";
import { formatPct, shortDate } from "@/lib/chart";
import { MIN_SAMPLE, SCORE_WEIGHTS } from "@/lib/measure";

// Wynik zależy od adresu i od bazy, ale jest tylko do odczytu: renderujemy na żądanie, a obliczony audyt jest trzymany
// w pamięci podręcznej serwera przez godzinę (lib/audit-cache.ts).
export const dynamic = "force-dynamic";

type Params = Promise<{ domain: string }>;

function decode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const domain = normalizeDomain(decode((await params).domain));
  return {
    title: domain ? `Audyt widoczności w AI: ${domain}` : "Audyt widoczności w AI",
    robots: { index: false, follow: false },
  };
}

const dateFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Warsaw" });
function fmtDate(iso: string | null): string {
  return iso ? dateFmt.format(new Date(iso)) : "brak daty";
}

function num1(x: number): string {
  return (Math.round(x * 10) / 10).toString().replace(".", ",");
}

function metricValue(m: MetricRow, v: number | null): string {
  if (v === null) return "brak";
  return m.kind === "position" ? num1(v) : formatPct(v);
}

function metricTarget(m: MetricRow): string {
  if (m.target === null) return "-";
  return m.kind === "position" ? `do ${num1(m.target)}` : `od ${formatPct(m.target)}`;
}

function Missing({ domain, status, sp }: { domain: string; status: "not_in_catalog" | "no_measurements"; sp: Record<string, string | string[] | undefined> }) {
  return (
    <div className="wrap page mid">
      <div className="eyebrow">Audyt widoczności w AI</div>
      <h1 style={{ fontSize: 32, margin: "8px 0 14px" }}>{domain}</h1>
      <Card>
        <EmptyState icon="search" title={status === "not_in_catalog" ? "Nie znamy jeszcze tej strony" : "Brak świeżych pomiarów dla miasta tej firmy"}>
          {status === "not_in_catalog"
            ? "Tej strony nie ma w naszym katalogu biur nieruchomości, więc nie wiemy, w jakim mieście działa, i nie mamy pomiarów, które da się do niej przypisać. Nie zgadujemy wyniku."
            : "Firma jest w naszym katalogu, ale nie mamy jeszcze świeżych pomiarów odpowiedzi AI dla jej miasta (z ostatnich 30 dni). Pomiary robimy co tydzień dla 20 największych miast, więc możliwe, że Twoje miasto jeszcze na nie czeka."}
        </EmptyState>
      </Card>
      <Card className="mt-16" title="Pełny audyt" sub="Pomiar na żywo dla Twojej firmy i pytań Twoich klientów będzie osobną usługą. Zostaw adres, a wyślemy jedną wiadomość, gdy będzie gotowy.">
        <Notice ok={sp.zapisano ? "Zapisane. Napiszemy, gdy pełny audyt będzie gotowy." : null} error={one(sp.error)} />
        <WaitlistForm domain={domain} from={`/audyt/${encodeURIComponent(domain)}`} />
      </Card>
      <p className="small" style={{ marginTop: 16 }}>
        <Link href="/audyt">Sprawdź inny adres</Link>
      </p>
    </div>
  );
}

function Breakdown({ a }: { a: AuditResult }) {
  const n = a.usage.count;
  if (!a.metrics.length) {
    return (
      <EmptyState icon="info" title="Za mało danych na rozbicie">
        Mamy {n} odpowiedzi AI dla miasta {a.city?.name}, a potrzebujemy co najmniej {MIN_SAMPLE}, żeby porównać wskaźniki z celem. Poniżej widać
        same liczby z tych odpowiedzi.
      </EmptyState>
    );
  }
  const counts: Record<string, number> = { mention: a.mentionedAnswers, recommendation: a.recommendedAnswers, citation: a.citedAnswers };
  return (
    <>
      <DataTable
        columns={[
          {
            header: "Metryka",
            cell: (m: MetricRow) => (
              <div className="metric-name">
                <b>{m.label}</b>
                <span>{m.hint}</span>
              </div>
            ),
          },
          {
            header: "Wynik",
            cell: (m: MetricRow) => (
              <>
                <span className={`val-pill ${m.tone === "neutral" ? "" : m.tone}`}>{metricValue(m, m.value)}</span>
                {counts[m.key] !== undefined ? <span className="cell-sub">{counts[m.key]} z {n} odpowiedzi</span> : null}
              </>
            ),
          },
          { header: "Cel", cell: (m: MetricRow) => <span className="muted">{metricTarget(m)}</span> },
        ]}
        rows={a.metrics}
        rowKey={(m) => m.key}
      />
      <div className="bench-note">
        <Icon name="info" size={15} />
        <span>
          {a.benchmark
            ? `Cel to ${a.benchmark.label}. Kolor wyniku: zielony od celu, żółty od połowy celu, czerwony poniżej. Dla pozycji mniej znaczy lepiej.`
            : "W tych odpowiedziach AI nie wymieniło żadnej innej firmy, więc nie mamy celu do porównania."}
        </span>
      </div>
    </>
  );
}

function History({ a }: { a: AuditResult }) {
  const h = a.history;
  if (!h.enough) {
    return (
      <EmptyState icon="clock" title="Historia pojawi się po kolejnym tygodniowym pomiarze">
        {h.points.length === 1
          ? `Mamy pomiary z jednego tygodnia (od ${shortDate(h.points[0].weekStart)}). Wykres narysujemy, gdy będą co najmniej dwa tygodnie.`
          : "Wykres narysujemy, gdy będą pomiary z co najmniej dwóch tygodni."}
      </EmptyState>
    );
  }
  const anyLow = h.points.some((p) => p.lowSample);
  return (
    <>
      <LineChart
        ariaLabel="Odsetek odpowiedzi AI z Twoją firmą w kolejnych tygodniach"
        format="pct"
        yLabel="Odpowiedzi z Twoją firmą (% odpowiedzi w tygodniu)"
        points={h.points.map((p) => ({
          date: p.weekStart,
          value: p.rate,
          hollow: p.lowSample,
          title: `Tydzień od ${shortDate(p.weekStart)}: ${p.mentioned} z ${p.sample} odpowiedzi (${formatPct(p.rate)})`,
        }))}
      />
      <p className="note">
        Każdy punkt to jeden tydzień (od poniedziałku).{anyLow ? ` Puste punkty to tygodnie z próbą mniejszą niż ${MIN_SAMPLE} odpowiedzi: traktuj je orientacyjnie.` : ""}
      </p>
    </>
  );
}

export default async function AuditResultPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const sp = await searchParams;
  const domain = normalizeDomain(decode((await params).domain));
  if (!domain) {
    return (
      <div className="wrap page narrow">
        <h1 style={{ fontSize: 28, marginBottom: 14 }}>Audyt widoczności w AI</h1>
        <p className="error" role="alert">To nie wygląda na adres strony firmy. Wpisz zwykłą domenę, np. mojafirma.pl.</p>
        <p style={{ marginTop: 16 }}><Link href="/audyt" className="btn">Wróć do formularza</Link></p>
      </div>
    );
  }

  let audit: AuditResult;
  try {
    audit = await loadAudit(domain);
  } catch {
    return (
      <div className="wrap page narrow">
        <h1 style={{ fontSize: 28, marginBottom: 14 }}>Audyt widoczności w AI: {domain}</h1>
        <p className="error" role="alert">Audyt jest chwilowo niedostępny. Spróbuj ponownie za kilka minut.</p>
        <p style={{ marginTop: 16 }}><Link href="/audyt">Wróć do formularza</Link></p>
      </div>
    );
  }

  if (audit.status !== "ok") return <Missing domain={domain} status={audit.status} sp={sp} />;

  const { usage } = audit;
  const n = usage.count;
  const cityName = audit.city?.name ?? "";
  const view = one(sp.widok) === "historia" ? "historia" : "rozbicie";
  const base = `/audyt/${encodeURIComponent(domain)}`;
  const dates =
    usage.firstMeasuredAt && usage.lastMeasuredAt && fmtDate(usage.firstMeasuredAt) !== fmtDate(usage.lastMeasuredAt)
      ? `${fmtDate(usage.firstMeasuredAt)} - ${fmtDate(usage.lastMeasuredAt)}`
      : fmtDate(usage.lastMeasuredAt);
  const noData = `za mało danych (próba ${n}, potrzeba ${MIN_SAMPLE})`;
  const rates = audit.rates;

  // Konkurenci razem z Twoją firmą (wyróżnioną), posortowani po liczbie odpowiedzi.
  const compItems: (BarItem & { answers: number })[] = [
    ...audit.competitors.map((c, i) => ({
      key: `c-${i}-${c.name}`,
      label: c.name,
      sub: c.domain ?? undefined,
      valueText: `${c.answers} z ${n}${audit.enoughData ? ` (${formatPct(c.share)})` : ""}`,
      ratio: c.answers / n,
      answers: c.answers,
      badge: c.inCatalog ? <Pill tone="good">w katalogu</Pill> : <Pill tone="neutral">poza katalogiem</Pill>,
    })),
    {
      key: "own",
      label: `${audit.firmName} (Ty)`,
      valueText: `${audit.mentionedAnswers} z ${n}${audit.enoughData && rates ? ` (${formatPct(rates.mention.value)})` : ""}`,
      ratio: audit.mentionedAnswers / n,
      answers: audit.mentionedAnswers,
      highlight: true,
      badge: <Pill tone="brand">Twoja firma</Pill>,
    },
  ].sort((a, b) => b.answers - a.answers);

  const srcItems: BarItem[] = audit.citedDomains.map((c) => ({
    key: c.domain,
    label: c.domain,
    valueText: `${c.answers} z ${n}${audit.enoughData ? ` (${formatPct(c.share)})` : ""}`,
    ratio: c.answers / n,
    highlight: c.isOwnPortal,
    badge: c.isOwnPortal ? <Pill tone="brand">nasz portal</Pill> : undefined,
  }));

  const platItems: BarItem[] = audit.byPlatform.map((p) => ({
    key: p.platform,
    label: p.label,
    sub: `${p.sample} odpowiedzi`,
    valueText: `${p.mentionedAnswers} z ${p.sample}`,
    ratio: p.sample ? p.mentionedAnswers / p.sample : 0,
  }));

  const recs = audit.recommendations.map((r, i) => ({
    key: `r${i}`,
    title: r.text,
    done: Boolean(r.done),
    href: r.href ?? (r.anchor ? `${base}${view === "historia" ? "?widok=historia" : ""}#${r.anchor}` : undefined),
    action: r.href ? "Zobacz profil" : r.anchor ? "Zobacz dane" : undefined,
  }));

  return (
    <div className="wrap page">
      <div className="report-h">
        <div>
          <div className="eyebrow">Audyt widoczności w AI</div>
          <h1>{audit.firmName}</h1>
          <div className="chips">
            <Pill tone="neutral" outline><Icon name="globe" size={13} /> {domain}</Pill>
            <Pill tone="neutral" outline><Icon name="target" size={13} /> {cityName}</Pill>
            <Pill tone="neutral" outline><Icon name="database" size={13} /> {n} odpowiedzi AI</Pill>
            <Pill tone="neutral" outline><Icon name="clock" size={13} /> {dates}</Pill>
          </div>
        </div>
        <Link href="/audyt" className="btn ghost sm"><Icon name="search" size={14} /> Sprawdź inny adres</Link>
      </div>
      <p className="muted small" style={{ margin: "-6px 0 18px", maxWidth: "80ch" }}>
        Platformy: {usage.platforms.map((p) => `${p.label} (${p.count})`).join(", ")}. To pomiar z biblioteki wspólnej dla wszystkich firm
        w mieście, nie pytanie zadane specjalnie o Twoją firmę.
      </p>

      <div className="g-score">
        <Card title="Wynik widoczności" sub={audit.score === null ? "Wynik pojawi się przy próbie co najmniej " + MIN_SAMPLE + " odpowiedzi" : `Z ${n} odpowiedzi AI`}>
          <Gauge value={audit.score} />
          <p className="note" style={{ textAlign: "center" }}>
            {audit.score === null
              ? `Za mało danych: ${n} odpowiedzi, potrzeba ${MIN_SAMPLE}. Nie zgadujemy wyniku, poniżej są same liczby.`
              : `Średnia ważona: wzmianki ${SCORE_WEIGHTS.mention * 100}%, polecenia ${SCORE_WEIGHTS.recommendation * 100}%, cytowania ${SCORE_WEIGHTS.citation * 100}%, pozycja ${SCORE_WEIGHTS.position * 100}%.`}
          </p>
        </Card>
        <Card
          id="analiza"
          flush
          title="Analiza wyniku"
          sub={`Pomiary: ${dates}`}
          actions={
            <Segmented
              label="Widok analizy"
              items={[
                { label: "Rozbicie", href: `${base}#analiza`, active: view === "rozbicie" },
                { label: "Historia", href: `${base}?widok=historia#analiza`, active: view === "historia" },
              ]}
            />
          }
        >
          {view === "historia" ? <div style={{ padding: "4px 20px 20px" }}><History a={audit} /></div> : <Breakdown a={audit} />}
        </Card>
      </div>

      <div className="g4 mt-16">
        <StatTile icon="eye" label="Wzmianki o Twojej firmie" value={`${audit.mentionedAnswers} z ${n}`} note={rates ? `${formatPct(rates.mention.value)} odpowiedzi (przedział 95%: ${formatPct(rates.mention.low)} - ${formatPct(rates.mention.high)})` : noData} />
        <StatTile icon="trophy" tone="accent" label="Polecenia" value={`${audit.recommendedAnswers} z ${n}`} note={rates ? `${formatPct(rates.recommendation.value)} odpowiedzi (przedział 95%: ${formatPct(rates.recommendation.low)} - ${formatPct(rates.recommendation.high)})` : noData} />
        <StatTile icon="link" tone="warn" label="Cytowania Twojej strony" value={`${audit.citedAnswers} z ${n}`} note={rates ? `${formatPct(rates.citation.value)} odpowiedzi (przedział 95%: ${formatPct(rates.citation.low)} - ${formatPct(rates.citation.high)})` : noData} />
        <StatTile icon="chart" tone="good" label="Udział w odpowiedziach" value={audit.shareOfVoice === null ? "-" : formatPct(audit.shareOfVoice)} note={audit.shareOfVoice === null ? noData : "wzmianki Twojej firmy do wszystkich wzmianek o firmach"} />
      </div>

      <div className="g2 mt-16">
        <Card title="Wyniki według platform" sub="W ilu odpowiedziach na danej platformie pojawia się Twoja firma">
          <BarList items={platItems} empty="Brak pomiarów." />
        </Card>
        <Card id="konkurencja" title={`Kogo AI wymienia w mieście ${cityName}`} sub="Liczba odpowiedzi z wzmianką o firmie">
          {audit.competitors.length ? (
            <BarList ranked items={compItems} />
          ) : (
            <p className="muted">W tych odpowiedziach AI nie wymieniło żadnej innej firmy.</p>
          )}
        </Card>
      </div>

      <div className="g2 mt-16">
        <Card id="zrodla" title="Z jakich stron korzysta AI" sub="Odpowiedzi, które cytują daną stronę">
          {srcItems.length ? <BarList ranked items={srcItems} /> : <p className="muted">Odpowiedzi nie podawały źródeł.</p>}
          <p className="note">
            {audit.ownPortal.cited
              ? `Nasz portal ${OWN_PORTAL_DOMAIN} jest cytowany w ${audit.ownPortal.answers} z ${n} odpowiedzi.`
              : `Nasz portal ${OWN_PORTAL_DOMAIN} nie jest cytowany w żadnej z tych odpowiedzi.`}
            {audit.profileUrl ? (
              <>
                {" "}Twój profil w katalogu: <a href={audit.profileUrl} rel="noopener">{audit.profileUrl}</a>.
              </>
            ) : null}
          </p>
        </Card>
        <Card title="Co możesz zrobić" sub="Wnioski wynikające wyłącznie z liczb w tym raporcie">
          <Checklist items={recs} />
        </Card>
      </div>

      <div className="g2 mt-16">
        <Card title="Pytania, na które odpowiadało AI" sub={`${usage.prompts.length} pytań w pomiarze`}>
          <ul className="q-list">
            {usage.prompts.map((p) => (
              <li key={p}>
                <Icon name="quote" size={15} />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="tint" title="Chcesz pełny audyt?" sub="Ta wersja opiera się na pomiarach biblioteki dla miasta. Pełny audyt zmierzy na żywo pytania Twoich klientów o Twoją firmę.">
          <Notice ok={sp.zapisano ? "Zapisane. Napiszemy, gdy pełny audyt będzie gotowy." : null} error={one(sp.error)} />
          <WaitlistForm domain={domain} from={base} />
        </Card>
      </div>
    </div>
  );
}
