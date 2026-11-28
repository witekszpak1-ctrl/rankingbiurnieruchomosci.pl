import Link from "next/link";

import { AdminNav } from "@/components/AdminNav";
import { formatShare, formatDateTime, PLATFORM_LABEL } from "@/lib/admin-stats";
import { loadOverview } from "@/lib/admin-repo";
import { formatPln } from "@/lib/affiliate";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Panel administratora" };
export const dynamic = "force-dynamic";

function Card({ value, label, href }: { value: string | number; label: string; href?: string }) {
  const inner = (
    <div className="card stat">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>{inner}</Link> : inner;
}

export default async function AdminOverview() {
  await requireAdmin("/admin");
  const o = await loadOverview();
  const mentionTotal = o.mentions.matched + o.mentions.unmatched;
  return (
    <>
      <h1>Panel administratora</h1>
      <AdminNav current="/admin" />

      <h2 className="sec">Konta i sprzedaż</h2>
      <div className="cards">
        <Card value={o.users.total} label={`użytkownicy (administratorzy: ${o.users.admins}, wyłączeni: ${o.users.disabled})`} href="/admin/uzytkownicy" />
        <Card value={o.accountsByPlan.reduce((s, p) => s + p.count, 0)} label="konta firm" href="/admin/uzytkownicy" />
        <Card value={o.waitlist} label="lista oczekujących" href="/admin/lista" />
      </div>
      <div className="tw"><table>
        <thead><tr><th>Pakiet</th><th>Konta</th></tr></thead>
        <tbody>
          {o.accountsByPlan.length ? o.accountsByPlan.map((p) => <tr key={p.plan}><td>{p.plan}</td><td>{p.count}</td></tr>) : <tr><td colSpan={2} className="muted">Brak kont.</td></tr>}
        </tbody>
      </table></div>

      <h2 className="sec">Program partnerski</h2>
      <div className="cards">
        <Card value={`${o.affiliates.active} / ${o.affiliates.total}`} label="partnerzy aktywni / wszyscy" href="/admin/partnerzy" />
        <Card value={o.clicks30d} label="kliknięcia linków (30 dni)" />
        <Card value={o.referrals} label="polecone konta" />
        <Card value={formatPln(o.commissions.pendingGrosze)} label="prowizje w okresie zwrotów" />
        <Card value={formatPln(o.commissions.availableGrosze)} label="prowizje do wypłaty" href="/admin/partnerzy" />
        <Card value={formatPln(o.commissions.paidGrosze)} label="prowizje wypłacone" />
      </div>

      <h2 className="sec">Pomiary widoczności w AI</h2>
      <div className="cards">
        <Card value={o.prompts} label="pytania w bibliotece" />
        <Card value={o.citiesMeasured} label="miasta z gotowym pomiarem" href="/admin/pomiary" />
        <Card value={formatDateTime(o.lastMeasuredAt)} label="ostatni pomiar" />
      </div>
      <div className="tw"><table>
        <thead><tr><th>Platforma</th><th>Gotowe</th><th>Błędy</th><th>W kolejce / w toku</th><th>Ostatni pomiar</th></tr></thead>
        <tbody>
          {o.measurementsByPlatform.length ? o.measurementsByPlatform.map((p) => (
            <tr key={p.platform}>
              <td>{PLATFORM_LABEL[p.platform] ?? p.platform}</td>
              <td><Link href={`/admin/pomiary?platforma=${p.platform}&status=done`}>{p.done}</Link></td>
              <td>{p.failed ? <Link href={`/admin/pomiary?platforma=${p.platform}&status=failed`}>{p.failed}</Link> : 0}</td>
              <td>{p.other}</td>
              <td>{formatDateTime(p.last)}</td>
            </tr>
          )) : <tr><td colSpan={5} className="muted">Brak pomiarów.</td></tr>}
        </tbody>
      </table></div>

      <h2 className="sec">Firmy i źródła w odpowiedziach</h2>
      <div className="cards">
        <Card value={o.mentions.matched} label="wzmianki dopasowane do katalogu" href="/admin/firmy?typ=matched" />
        <Card value={o.mentions.unmatched} label="wzmianki bez dopasowania (kandydaci)" href="/admin/firmy?typ=unmatched" />
        <Card value={o.citations.ownPortal} label="cytowania naszego portalu" href="/admin/zrodla" />
        <Card value={o.citations.total} label="cytowania razem" href="/admin/zrodla" />
      </div>
      <p className="muted small">
        Dopasowanie wzmianek do katalogu: {formatShare(o.mentions.matched, mentionTotal)}.
        Odpowiedzi cytujące nasz portal: {formatShare(o.citations.answersCitingOwn, o.citations.answersWithCitations)} odpowiedzi ze źródłami.
      </p>
    </>
  );
}
