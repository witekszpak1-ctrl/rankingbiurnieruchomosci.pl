import { AdminNav } from "@/components/AdminNav";
import { Notice, one, type SP } from "@/components/Notice";
import { canRequestPayout, formatPln } from "@/lib/affiliate";
import { adminAffiliates, currentTerms } from "@/lib/affiliate-repo";
import { requireAdmin } from "@/lib/auth";

import { settlePayoutAction } from "../../actions";

export const metadata = { title: "Partnerzy: wypłaty" };
export const dynamic = "force-dynamic";

export default async function AdminAffiliates({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  await requireAdmin("/admin/partnerzy");
  const [rows, terms] = await Promise.all([adminAffiliates(), currentTerms()]);
  const done = one(sp.wyplacono);
  return (
    <>
      <h1>Partnerzy i wypłaty</h1>
      <AdminNav current="/admin/partnerzy" />
      <p className="muted">
        Raz w miesiącu: zrób przelew na wskazany rachunek, wpisz tytuł przelewu i kliknij „Rozlicz”. Prowizje do wypłaty dostaną
        status „wypłacona”. Minimum: {formatPln(terms.minPayoutGrosze)}.
      </p>
      <Notice error={one(sp.error)} ok={done ? `Rozliczono ${formatPln(Number(done))}.` : null} />
      <div className="tw"><table>
        <thead><tr><th>Kod</th><th>E-mail</th><th>Polecone</th><th>W okresie zwrotów</th><th>Do wypłaty</th><th>Wypłacone</th><th>Rachunek</th><th></th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id}>
            <td>{r.code} {r.status !== "active" ? <span className="pill">{r.status}</span> : null}</td>
            <td>{r.email}</td>
            <td>{r.referrals}</td>
            <td>{formatPln(r.balance.pendingGrosze)}</td>
            <td><b>{formatPln(r.balance.availableGrosze)}</b></td>
            <td>{formatPln(r.balance.paidGrosze)}</td>
            <td className="small">{r.payoutName ?? "brak danych"}<br />{r.payoutIban ?? ""}{r.payoutIsCompany ? ` (firma, NIP ${r.payoutNip})` : r.payoutName ? " (osoba prywatna)" : ""}</td>
            <td>
              {canRequestPayout(r.balance, terms) && r.payoutIban ? (
                <form action={settlePayoutAction} style={{ display: "flex", gap: 6 }}>
                  <input type="hidden" name="affiliateId" value={r.id} />
                  <input id={`ref-${r.id}`} name="reference" type="text" placeholder="tytuł przelewu" required />
                  <button type="submit">Rozlicz</button>
                </form>
              ) : null}
            </td>
          </tr>
        ))}</tbody>
      </table></div>
    </>
  );
}
