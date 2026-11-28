import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminNav } from "@/components/AdminNav";
import { loadMeasurement } from "@/lib/admin-repo";
import { PLATFORM_LABEL, STATUS_LABEL, UUID_RE, formatDateTime } from "@/lib/admin-stats";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Pomiar" };
export const dynamic = "force-dynamic";

export default async function AdminMeasurement({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin(`/admin/pomiary/${UUID_RE.test(id) ? id : ""}`);
  if (!UUID_RE.test(id)) notFound();
  const m = await loadMeasurement(id);
  if (!m) notFound();
  return (
    <>
      <h1>Pomiar</h1>
      <AdminNav current="/admin/pomiary" />
      <p><Link href="/admin/pomiary">Wróć do listy pomiarów</Link></p>
      <div className="card">
        <p><b>Pytanie:</b> {m.prompt}</p>
        <p className="small muted">
          Platforma: {PLATFORM_LABEL[m.platform] ?? m.platform}
          {m.model ? ` (${m.model})` : ""} | dostawca: {m.provider} | miasto: {m.city ?? "-"} | branża: {m.industry ?? "-"} |
          status: {STATUS_LABEL[m.status] ?? m.status} | pomiar: {formatDateTime(m.measuredAt ?? m.requestedAt)}
        </p>
        {m.error ? <p className="error">{m.error}</p> : null}
        <b>Fragment odpowiedzi</b>
        {m.excerpt ? <blockquote className="answer">{m.excerpt}</blockquote> : <p className="muted">Brak zapisanego fragmentu.</p>}
      </div>

      <h2 className="sec">Wzmianki o firmach ({m.mentions.length})</h2>
      <div className="tw"><table>
        <thead><tr><th>Pozycja</th><th>Nazwa w odpowiedzi</th><th>Domena</th><th>Firma w katalogu</th><th>Polecana</th></tr></thead>
        <tbody>
          {m.mentions.length ? m.mentions.map((x) => (
            <tr key={x.position + x.name}>
              <td>{x.position}</td>
              <td>{x.name}</td>
              <td>{x.domain ?? "-"}</td>
              <td>{x.brandName ?? <span className="pill warn">kandydat</span>}</td>
              <td>{x.recommended ? "tak" : "nie"}</td>
            </tr>
          )) : <tr><td colSpan={5} className="muted">Brak wzmianek.</td></tr>}
        </tbody>
      </table></div>

      <h2 className="sec">Cytowane źródła ({m.citations.length})</h2>
      <div className="tw"><table>
        <thead><tr><th>Pozycja</th><th>Adres</th><th>Domena</th><th>Nasz portal</th></tr></thead>
        <tbody>
          {m.citations.length ? m.citations.map((c) => (
            <tr key={c.position + c.url} className={c.isOwnPortal ? "own" : undefined}>
              <td>{c.position}</td>
              <td style={{ wordBreak: "break-all" }}>{c.title ? <>{c.title}<br /></> : null}<span className="small muted">{c.url}</span></td>
              <td>{c.domain}</td>
              <td>{c.isOwnPortal ? <span className="pill own">tak</span> : "nie"}</td>
            </tr>
          )) : <tr><td colSpan={4} className="muted">Brak cytowanych źródeł.</td></tr>}
        </tbody>
      </table></div>
    </>
  );
}
