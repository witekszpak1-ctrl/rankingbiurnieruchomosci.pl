import Link from "next/link";

import { AppShell } from "@/components/shell/AppShell";
import { Notice, one, type SP } from "@/components/Notice";
import { Card, DataTable, EmptyState, PageHeader, Pill } from "@/components/ui/ui";
import { formatDate } from "@/lib/admin-stats";
import { requireAdmin } from "@/lib/auth";
import { formatInt } from "@/lib/chart";
import { PORTAL_STATUS_LABEL, portalTone, vercelProjectUrl } from "@/lib/master";
import { listPortals, MIGRATION_HINT, safely } from "@/lib/master-repo";

import { updatePortalAction } from "../actions";

export const metadata = { title: "Wszystkie portale" };
export const dynamic = "force-dynamic";

export default async function AdminPortals({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const me = await requireAdmin("/admin/portale");
  const res = await safely(listPortals);
  const savedSlug = one(sp.ok);
  const portals = res.ok ? res.value : [];
  return (
    <AppShell user={me} current="/admin/portale">
      <PageHeader eyebrow="Portale" title="Wszystkie portale" sub="Rejestr portali z jednej bazy: statystyki z katalogu, linki do projektów Vercel i edycja domeny, statusu i notatek." />
      <Notice error={one(sp.error) ?? (res.ok ? null : MIGRATION_HINT)} ok={savedSlug ? `Zapisano portal: ${savedSlug}.` : null} />

      <Card flush className="mt-16" title={`Portale (${portals.length})`}>
        {res.ok ? (
          <DataTable
            columns={[
              { header: "Status", cell: (p: (typeof portals)[number]) => <Pill tone={portalTone(p.status)} dot>{PORTAL_STATUS_LABEL[p.status]}</Pill> },
              { header: "Portal", cell: (p) => <Link href={`/admin/portale/${p.slug}`}><b>{p.name}</b></Link> },
              { header: "Adres", cell: (p) => (p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer">{p.url.replace(/^https:\/\//, "")}</a> : <span className="muted">brak</span>) },
              { header: "Domena", cell: (p) => p.domain ?? <span className="muted">brak domeny</span> },
              { header: "Opublikowane firmy", num: true, cell: (p) => (p.hasStats ? formatInt(p.published) : "-") },
              { header: "Miasta", num: true, cell: (p) => (p.hasStats ? formatInt(p.publishedCities) : "-") },
              { header: "Domeny znalezione", num: true, cell: (p) => (p.hasStats ? formatInt(p.domainsTotal) : "-") },
              { header: "Ostatnia aktualizacja danych", cell: (p) => formatDate(p.lastDataAt) },
              {
                header: "Linki",
                cell: (p) => {
                  const v = vercelProjectUrl(p.vercelProject);
                  return (
                    <span className="inline-links">
                      {v ? <a href={v} target="_blank" rel="noopener noreferrer">Vercel</a> : <span className="muted">Vercel: brak</span>}
                      {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer">Portal</a> : null}
                    </span>
                  );
                },
              },
            ]}
            rows={portals}
            rowKey={(p) => p.slug}
            empty="Brak portali w rejestrze."
          />
        ) : (
          <EmptyState icon="alert" title="Rejestr portali niedostępny">{MIGRATION_HINT}</EmptyState>
        )}
      </Card>

      {res.ok ? (
        <Card className="mt-16" title="Edycja rejestru" sub="Domena, status i notatki. Pozostałe pola (adres, projekt Vercel) ustawia migracja.">
          <div className="edit-list">
            {portals.map((p) => (
              <details key={p.slug} className="edit-item" open={savedSlug === p.slug}>
                <summary>
                  <Pill tone={portalTone(p.status)} dot>{PORTAL_STATUS_LABEL[p.status]}</Pill> <b>{p.name}</b>
                </summary>
                <form action={updatePortalAction} className="stack edit-form">
                  <input type="hidden" name="slug" value={p.slug} />
                  <label>Domena (np. przyklad.pl, puste = brak)
                    <input name="domain" type="text" maxLength={253} defaultValue={p.domain ?? ""} autoComplete="off" />
                  </label>
                  <label>Status
                    <select name="status" defaultValue={p.status}>
                      <option value="live">działa</option>
                      <option value="private">prywatny</option>
                      <option value="planned">planowany</option>
                    </select>
                  </label>
                  <label>Notatki
                    <textarea name="notes" rows={2} maxLength={1000} defaultValue={p.notes ?? ""} />
                  </label>
                  <div><button type="submit">Zapisz</button></div>
                </form>
              </details>
            ))}
          </div>
        </Card>
      ) : null}
    </AppShell>
  );
}
