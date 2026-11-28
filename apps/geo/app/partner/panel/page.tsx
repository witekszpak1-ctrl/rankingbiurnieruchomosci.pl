import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { savePayoutAction } from "@/app/actions";
import { LinkBuilder } from "@/components/LinkBuilder";
import { Notice, one, type SP } from "@/components/Notice";
import { AppShell } from "@/components/shell/AppShell";
import { Card, DataTable, EmptyState, PageHeader, Pill, StatTile } from "@/components/ui/ui";
import { canRequestPayout, formatPln } from "@/lib/affiliate";
import { affiliateByUser, currentTerms, dashboard } from "@/lib/affiliate-repo";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Panel partnera" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { pending: "czeka na okres zwrotów", approved: "zatwierdzona", void: "anulowana", paid: "wypłacona" };
const KIND: Record<string, string> = { payment: "płatność", refund: "zwrot", chargeback: "obciążenie zwrotne" };

export default async function AffiliatePanel({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await requireUser("/partner/panel");
  const aff = await affiliateByUser(user.id);
  if (!aff) redirect("/partner/dolacz");
  const [d, terms, h] = await Promise.all([dashboard(aff.id), currentTerms(), headers()]);
  const origin = process.env.GEO_PUBLIC_URL ?? `https://${h.get("host")}`;
  const now = new Date();
  return (
    <AppShell user={user} current="/partner/panel">
      <PageHeader eyebrow="Rozwój" title="Panel partnera" sub={`Twój kod: ${aff.code}. Prowizja ${terms.rateBps / 100}% od każdej płatności poleconego klienta.`} />
      {one(sp.nowy) ? <p className="ok" style={{ marginBottom: 16 }}>Witaj w programie. Twój kod: <b>{aff.code}</b>. Skopiuj link poniżej i zacznij polecać.</p> : null}
      {aff.status !== "active" ? <p className="error" style={{ marginBottom: 16 }}>Konto partnera jest {aff.status === "suspended" ? "zawieszone" : "zablokowane"}. Nowe prowizje nie są naliczane.</p> : null}

      <div className="g4">
        <StatTile icon="eye" label="Kliknięcia w 30 dni" value={d.clicks30} note={`${d.clicksAll} łącznie`} />
        <StatTile icon="users" tone="accent" label="Polecone konta" value={d.referrals} note={`${d.paying} płacących klientów`} />
        <StatTile
          icon="wallet"
          tone="good"
          label="Do wypłaty"
          value={formatPln(Math.max(0, d.balance.availableGrosze))}
          note={d.balance.availableGrosze < 0 ? `zwrot klienta ${formatPln(d.balance.availableGrosze)} odejmiemy od kolejnych prowizji` : `wypłacone dotąd: ${formatPln(d.balance.paidGrosze)}`}
        />
        <StatTile icon="clock" tone="warn" label="W okresie na zwroty" value={formatPln(d.balance.pendingGrosze)} note={`${terms.holdDays} dni od płatności`} />
      </div>
      {d.rejected ? <p className="small muted" style={{ marginTop: 10 }}>Odrzucone polecenia (np. własne konto): {d.rejected}.</p> : null}
      <p className="small muted" style={{ margin: "8px 0 0" }}>
        {canRequestPayout(d.balance, terms)
          ? "Saldo przekracza minimum: wypłacimy je w najbliższym miesięcznym rozliczeniu na podany niżej rachunek."
          : `Wypłata od ${formatPln(terms.minPayoutGrosze)}. Rozliczamy raz w miesiącu.`}
      </p>

      <div className="g2 mt-16">
        <Card title="Twój link" sub={`Możesz też podać kod ${aff.code}: klient wpisze go przy zakładaniu konta.`}>
          <LinkBuilder origin={origin} code={aff.code} />
        </Card>
        <Card title="Dane do wypłaty" sub="Wypłacamy raz w miesiącu przelewem">
          <Notice error={one(sp.error)} ok={one(sp.zapisano) ? "Dane zapisane." : null} />
          <form action={savePayoutAction} className="stack" style={{ maxWidth: "none", marginTop: 8 }}>
            <label>Imię i nazwisko lub nazwa firmy<input id="payoutName" name="payoutName" type="text" defaultValue={aff.payoutName ?? ""} required /></label>
            <label>Numer rachunku<input id="payoutIban" name="payoutIban" type="text" defaultValue={aff.payoutIban ?? ""} required inputMode="numeric" /></label>
            <label className="check">
              <input id="payoutIsCompany" name="payoutIsCompany" type="checkbox" defaultChecked={aff.payoutIsCompany ?? false} />
              <span className="small">Rozliczam się jako firma (wystawię fakturę)</span>
            </label>
            <label>NIP (dla firm)<input id="payoutNip" name="payoutNip" type="text" defaultValue={aff.payoutNip ?? ""} inputMode="numeric" /></label>
            <div><button type="submit">Zapisz dane</button></div>
          </form>
        </Card>
      </div>

      {d.campaigns.length ? (
        <Card flush className="mt-16" title="Kampanie">
          <DataTable
            columns={[
              { header: "Kampania", cell: (c: (typeof d.campaigns)[number]) => c.campaign },
              { header: "Kliknięcia", num: true, cell: (c) => c.clicks },
              { header: "Polecone konta", num: true, cell: (c) => c.referrals },
            ]}
            rows={d.campaigns}
            rowKey={(c) => c.campaign}
          />
        </Card>
      ) : null}

      <Card flush className="mt-16" title="Prowizje">
        {d.commissions.length === 0 ? (
          <div style={{ padding: "0 20px 20px" }}>
            <EmptyState icon="wallet" title="Jeszcze nie ma prowizji">Pojawią się po pierwszej płatności poleconego klienta.</EmptyState>
          </div>
        ) : (
          <DataTable
            columns={[
              { header: "Data", cell: (c: (typeof d.commissions)[number]) => c.createdAt.toLocaleDateString("pl-PL") },
              { header: "Klient", cell: (c) => c.accountLabel },
              { header: "Rodzaj", cell: (c) => KIND[c.kind] ?? c.kind },
              { header: "Podstawa netto", num: true, cell: (c) => formatPln(c.baseNetGrosze) },
              { header: "Stawka", num: true, cell: (c) => `${c.rateBps / 100}%` },
              { header: "Prowizja", num: true, cell: (c) => formatPln(c.amountGrosze) },
              {
                header: "Status",
                cell: (c) => <Pill tone={c.status === "paid" ? "good" : c.status === "void" ? "neutral" : "warn"}>{c.status === "pending" && c.amountGrosze < 0 ? "odjęta od salda" : c.status === "pending" && c.availableAt <= now ? "do wypłaty" : STATUS[c.status]}</Pill>,
              },
            ]}
            rows={d.commissions}
            rowKey={(c) => c.id}
          />
        )}
      </Card>
    </AppShell>
  );
}
