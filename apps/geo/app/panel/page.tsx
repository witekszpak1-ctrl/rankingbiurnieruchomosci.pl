import Link from "next/link";

import { one, type SP } from "@/components/Notice";
import { AppShell } from "@/components/shell/AppShell";
import { Icon } from "@/components/ui/Icon";
import { Card, Checklist, DataTable, EmptyState, Gauge, PageHeader, Pill, StatTile } from "@/components/ui/ui";
import { requireUser } from "@/lib/auth";
import { formatPct } from "@/lib/chart";
import { loadPanelContext } from "@/lib/panel-repo";
import type { PanelAccount } from "@/lib/panel";

export const metadata = { title: "Pulpit" };
export const dynamic = "force-dynamic";

export default async function PanelPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await requireUser("/panel");
  const ctx = await loadPanelContext(user.id);
  const { audit, steps, attention, domain, facts } = ctx;
  const done = steps.filter((s) => s.done).length;
  const ok = audit?.status === "ok" ? audit : null;
  const auditHref = domain ? `/audyt/${encodeURIComponent(domain)}` : "/audyt";

  return (
    <AppShell user={user} current="/panel">
      <PageHeader
        eyebrow="Widoczność"
        title="Pulpit"
        sub={ctx.primary ? `${ctx.primary.name}${domain ? `, ${domain}` : ""}` : "Dodaj firmę, żeby zobaczyć wynik widoczności w AI."}
        actions={
          <Link href={auditHref} className="btn">
            Zobacz audyt <Icon name="arrow" size={14} />
          </Link>
        }
      />
      {one(sp.nowe) ? <p className="ok" style={{ marginBottom: 16 }}>Konto założone. Audyt widoczności pokażemy, gdy dla Twojej strony będą pomiary.</p> : null}

      <div className="g-score">
        <Card title="Wynik widoczności" sub={ok ? `${ok.firmName}, ${ok.city?.name ?? ""}` : "Twoja domena"}>
          {ok ? (
            <>
              <Gauge value={ok.score} />
              <p className="note" style={{ textAlign: "center" }}>
                {ok.score === null ? `Za mało danych: ${ok.usage.count} odpowiedzi, potrzeba ${ok.minSample}.` : `Z ${ok.usage.count} odpowiedzi AI. `}
                {ok.score !== null ? <Link href={auditHref}>Zobacz rozbicie</Link> : null}
              </p>
            </>
          ) : (
            <EmptyState
              icon="chart"
              title={domain ? "Brak wyniku dla tej domeny" : "Dodaj domenę"}
              action={<Link href={domain ? "/audyt" : "/rejestracja"} className="btn sm soft">{domain ? "Sprawdź inny adres" : "Dodaj firmę"}</Link>}
            >
              {domain
                ? "Domeny nie ma w naszym katalogu albo jej miasto nie ma jeszcze świeżych pomiarów, więc nie pokazujemy wyniku."
                : "Podaj adres strony firmy, a pokażemy wynik, jeśli mamy dla niej pomiary."}
            </EmptyState>
          )}
        </Card>
        <Card
          title="Zacznij tutaj"
          sub={`${done} z ${steps.length} kroków zrobionych`}
          actions={<Pill tone={done === steps.length ? "good" : "brand"}>{done}/{steps.length}</Pill>}
        >
          <Checklist items={steps.map((s) => ({ key: s.key, title: s.title, hint: s.hint, done: s.done, href: s.href, action: s.action }))} />
        </Card>
      </div>

      <div className="g4 mt-16">
        <StatTile icon="database" label="Odpowiedzi AI w próbie" value={ok ? ok.usage.count : "-"} note={ok ? `miasto ${ok.city?.name}` : "brak pomiarów dla domeny"} />
        <StatTile icon="eye" tone="accent" label="Wzmianki o firmie" value={ok ? `${ok.mentionedAnswers}` : "-"} note={ok?.rates ? `${formatPct(ok.rates.mention.value)} odpowiedzi` : ok ? "za mało danych" : undefined} />
        <StatTile icon="link" tone="warn" label="Cytowania strony" value={ok ? `${ok.citedAnswers}` : "-"} note={ok?.rates ? `${formatPct(ok.rates.citation.value)} odpowiedzi` : ok ? "za mało danych" : undefined} />
        <StatTile icon="gift" tone="good" label="Pakiet" value={ctx.primary?.planName ?? "Free"} note="pakiety płatne uruchomimy wkrótce" href="/#cennik" />
      </div>

      <div className="g2 mt-16">
        <Card title={`Wymaga uwagi${attention.length ? ` · ${attention.length}` : ""}`} sub="Wynika wyłącznie z danych Twojego konta i audytu">
          {attention.length ? (
            <Checklist
              mode="attention"
              items={attention.map((a, i) => ({ key: `a${i}`, title: a.text, tone: a.tone, href: a.href, action: a.action }))}
            />
          ) : (
            <EmptyState icon="check" title="Nic nie wymaga uwagi">
              {ctx.primary ? "Nie widzimy teraz niczego, co wymagałoby Twojej reakcji." : "Dodaj firmę, a pokażemy tu rzeczy do zrobienia."}
            </EmptyState>
          )}
        </Card>
        <Card flush title="Firmy" sub={user.email}>
          {facts.accounts.length ? (
            <DataTable<PanelAccount>
              columns={[
                { header: "Firma", cell: (a) => a.name },
                { header: "Strona", cell: (a) => a.domain ?? "-" },
                { header: "Pakiet", cell: (a) => <>{a.planName ?? "Free"} {a.status && a.status !== "active" ? <Pill tone="warn">{a.status}</Pill> : null}</> },
              ]}
              rows={facts.accounts}
              rowKey={(a) => a.id}
            />
          ) : (
            <div style={{ padding: "0 20px 20px" }}>
              <EmptyState icon="building" title="Nie masz jeszcze konta firmy" action={<Link href="/rejestracja" className="btn sm soft">Dodaj firmę</Link>}>
                Konto firmy łączy Twoją domenę z pomiarami i pakietem.
              </EmptyState>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
