import Link from "next/link";

import { leadAction } from "../../actions";
import { Flash, when } from "@/components/admin";
import { TOPIC_LABEL, listLeads } from "@/lib/leads";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LeadsPage({ searchParams }: Props) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "new";
  const leads = await listLeads(status === "all" ? "" : status);
  const tabs: [string, string][] = [
    ["new", "Nowe"],
    ["done", "Załatwione"],
    ["all", "Wszystkie"],
  ];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Zapytania klientów</h1>
          <p className="page-sub">Wiadomości z formularza na stronach firm w katalogu.</p>
        </div>
      </div>
      <Flash params={params} />
      <div className="tabs">
        {tabs.map(([key, label]) => (
          <Link key={key} href={`/admin/leads?status=${key}`} className={`tab${status === key ? " active" : ""}`}>
            {label}
          </Link>
        ))}
      </div>
      {leads.length === 0 ? (
        <div className="panel">
          <p className="note">
            {status === "new" ? "Brak nowych zapytań. Pojawią się tu, gdy ktoś napisze przez formularz na stronie firmy." : "Brak zapytań."}
          </p>
        </div>
      ) : (
        <div className="leads">
          {leads.map((lead) => (
            <article key={lead.id} className={`lead-card${lead.status === "new" ? " new" : ""}`}>
              <header>
                <div>
                  <b>{lead.name}</b> <span className="chip">{TOPIC_LABEL[lead.topic] ?? lead.topic}</span>
                  <div className="note">
                    do:{" "}
                    {lead.listingId ? (
                      <Link href={`/admin/firms/${lead.listingId}`}>{lead.brandName}</Link>
                    ) : (
                      lead.brandName ?? "firma usunięta"
                    )}
                    {lead.cityName ? ` · ${lead.cityName}` : ""} · {when(lead.createdAt)}
                  </div>
                </div>
                <form action={leadAction}>
                  <input type="hidden" name="id" value={lead.id} />
                  <input type="hidden" name="action" value={lead.status === "new" ? "done" : "new"} />
                  <button className={lead.status === "new" ? "primary" : ""} type="submit">
                    {lead.status === "new" ? "Oznacz jako załatwione" : "Przywróć do nowych"}
                  </button>
                </form>
              </header>
              <p className="lead-msg">{lead.message}</p>
              <div className="lead-contact">
                <a href={`mailto:${lead.email}`}>{lead.email}</a>
                {lead.phone && <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}>{lead.phone}</a>}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
