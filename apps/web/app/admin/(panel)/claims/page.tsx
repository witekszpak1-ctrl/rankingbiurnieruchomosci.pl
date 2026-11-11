import Link from "next/link";

import { claimAction } from "../../actions";
import { Flash, when } from "@/components/admin";
import { WANT_LABEL, listClaims } from "@/lib/claims";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ClaimsPage({ searchParams }: Props) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "new";
  const claims = await listClaims(status === "all" ? "" : status);
  const tabs: [string, string][] = [
    ["new", "Nowe"],
    ["done", "Załatwione"],
    ["rejected", "Odrzucone"],
    ["all", "Wszystkie"],
  ];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Zgłoszenia właścicieli</h1>
          <p className="page-sub">Osoby, które kliknęły „Jestem właścicielem tej firmy” na stronie biura.</p>
        </div>
      </div>
      <Flash params={params} />
      <div className="tabs">
        {tabs.map(([key, label]) => (
          <Link key={key} href={`/admin/claims?status=${key}`} className={`tab${status === key ? " active" : ""}`}>
            {label}
          </Link>
        ))}
      </div>
      {claims.length === 0 ? (
        <div className="panel">
          <p className="note">Brak zgłoszeń.</p>
        </div>
      ) : (
        <div className="leads">
          {claims.map((c) => {
            const nipMatch = c.nip && c.registryNip ? c.nip === c.registryNip : null;
            return (
              <article key={c.id} className={`lead-card${c.status === "new" ? " new" : ""}`}>
                <header>
                  <div>
                    <b>{c.name}</b>
                    {c.role ? <span className="note"> · {c.role}</span> : null}{" "}
                    <span className="chip">{WANT_LABEL[c.wants] ?? c.wants}</span>
                    <div className="note">
                      firma:{" "}
                      {c.listingId ? <Link href={`/admin/firms/${c.listingId}`}>{c.brandName}</Link> : c.brandName ?? "usunięta"}
                      {c.cityName ? ` · ${c.cityName}` : ""} · {when(c.createdAt)}
                    </div>
                  </div>
                  <div className="row-actions">
                    {c.status === "new" ? (
                      <>
                        <form action={claimAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="action" value="done" />
                          <button className="primary" type="submit">
                            Załatwione
                          </button>
                        </form>
                        <form action={claimAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="action" value="rejected" />
                          <button type="submit">Odrzuć</button>
                        </form>
                      </>
                    ) : (
                      <form action={claimAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="action" value="new" />
                        <button type="submit">Przywróć do nowych</button>
                      </form>
                    )}
                  </div>
                </header>
                {c.message && <p className="lead-msg">{c.message}</p>}
                <div className="lead-contact">
                  <a href={`mailto:${c.email}`}>{c.email}</a>
                  {c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>{c.phone}</a>}
                  {c.nip && (
                    <span className={`badge ${nipMatch === true ? "ok" : nipMatch === false ? "bad" : ""}`}>
                      NIP {c.nip}
                      {nipMatch === true ? " zgodny z rejestrem" : nipMatch === false ? " inny niż w rejestrze" : ""}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
