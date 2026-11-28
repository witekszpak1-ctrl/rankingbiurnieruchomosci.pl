import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LinkBuilder } from "@/components/LinkBuilder";
import { Notice, one, type SP } from "@/components/Notice";
import { canRequestPayout, formatPln } from "@/lib/affiliate";
import { affiliateByUser, currentTerms, dashboard } from "@/lib/affiliate-repo";
import { requireUser } from "@/lib/auth";

import { savePayoutAction } from "../../actions";

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
    <>
      <h1>Panel partnera</h1>
      {one(sp.nowy) ? <p className="ok">Witaj w programie. Twój kod: <b>{aff.code}</b>. Skopiuj link poniżej i zacznij polecać.</p> : null}
      {aff.status !== "active" ? <p className="error">Konto partnera jest {aff.status === "suspended" ? "zawieszone" : "zablokowane"}. Nowe prowizje nie są naliczane.</p> : null}
      <h2>Twój link</h2>
      <LinkBuilder origin={origin} code={aff.code} />
      <p className="small muted">Możesz też podać kod <b>{aff.code}</b> - klient wpisze go przy zakładaniu konta.</p>

      <h2>Wyniki</h2>
      <div className="grid">
        <div className="card stat"><b>{d.clicks30}</b><span>kliknięć w 30 dni ({d.clicksAll} łącznie)</span></div>
        <div className="card stat"><b>{d.referrals}</b><span>poleconych kont</span></div>
        <div className="card stat"><b>{d.paying}</b><span>płacących klientów</span></div>
        <div className="card stat">
          <b>{formatPln(Math.max(0, d.balance.availableGrosze))}</b>
          <span>do wypłaty{d.balance.availableGrosze < 0 ? ` (zwrot klienta ${formatPln(d.balance.availableGrosze)} odejmiemy od kolejnych prowizji)` : ""}</span>
        </div>
        <div className="card stat"><b>{formatPln(d.balance.pendingGrosze)}</b><span>w okresie na zwroty ({terms.holdDays} dni)</span></div>
        <div className="card stat"><b>{formatPln(d.balance.paidGrosze)}</b><span>wypłacone</span></div>
      </div>
      {d.rejected ? <p className="small muted">Odrzucone polecenia (np. własne konto): {d.rejected}.</p> : null}
      <p className="small muted">
        {canRequestPayout(d.balance, terms)
          ? "Saldo przekracza minimum: wypłacimy je w najbliższym miesięcznym rozliczeniu na podany niżej rachunek."
          : `Wypłata od ${formatPln(terms.minPayoutGrosze)}. Rozliczamy raz w miesiącu.`}
      </p>

      {d.campaigns.length ? (
        <>
          <h2>Kampanie</h2>
          <div className="tw"><table>
            <thead><tr><th>Kampania</th><th>Kliknięcia</th><th>Polecone konta</th></tr></thead>
            <tbody>{d.campaigns.map((c) => <tr key={c.campaign}><td>{c.campaign}</td><td>{c.clicks}</td><td>{c.referrals}</td></tr>)}</tbody>
          </table></div>
        </>
      ) : null}

      <h2>Prowizje</h2>
      {d.commissions.length === 0 ? (
        <p className="muted">Jeszcze nie ma prowizji. Pojawią się po pierwszej płatności poleconego klienta.</p>
      ) : (
        <div className="tw"><table>
          <thead><tr><th>Data</th><th>Klient</th><th>Rodzaj</th><th>Podstawa netto</th><th>Stawka</th><th>Prowizja</th><th>Status</th></tr></thead>
          <tbody>{d.commissions.map((c) => (
            <tr key={c.id}>
              <td>{c.createdAt.toLocaleDateString("pl-PL")}</td>
              <td>{c.accountLabel}</td>
              <td>{KIND[c.kind] ?? c.kind}</td>
              <td>{formatPln(c.baseNetGrosze)}</td>
              <td>{c.rateBps / 100}%</td>
              <td>{formatPln(c.amountGrosze)}</td>
              <td>{c.status === "pending" && c.amountGrosze < 0 ? "odjęta od salda" : c.status === "pending" && c.availableAt <= now ? "do wypłaty" : STATUS[c.status]}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}

      <h2>Dane do wypłaty</h2>
      <Notice error={one(sp.error)} ok={one(sp.zapisano) ? "Dane zapisane." : null} />
      <form action={savePayoutAction} className="stack">
        <label>Imię i nazwisko lub nazwa firmy<input id="payoutName" name="payoutName" type="text" defaultValue={aff.payoutName ?? ""} required /></label>
        <label>Numer rachunku<input id="payoutIban" name="payoutIban" type="text" defaultValue={aff.payoutIban ?? ""} required inputMode="numeric" /></label>
        <label className="check">
          <input id="payoutIsCompany" name="payoutIsCompany" type="checkbox" defaultChecked={aff.payoutIsCompany ?? false} />
          <span className="small">Rozliczam się jako firma (wystawię fakturę)</span>
        </label>
        <label>NIP (dla firm)<input id="payoutNip" name="payoutNip" type="text" defaultValue={aff.payoutNip ?? ""} inputMode="numeric" /></label>
        <button type="submit">Zapisz dane</button>
      </form>
    </>
  );
}
