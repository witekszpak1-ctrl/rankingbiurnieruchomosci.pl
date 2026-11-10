import Link from "next/link";

import { requestAction } from "../../actions";
import { Flash, when } from "@/components/admin";
import {
  KIND_LABEL,
  REQUEST_STATUSES,
  STATUS_LABEL,
  listRequests,
  type RequestStatus,
} from "@/lib/requests";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TONE: Record<RequestStatus, string> = { new: "warn", in_progress: "warn", done: "ok", rejected: "bad" };

export default async function RequestsPage({ searchParams }: Props) {
  const params = await searchParams;
  const status = typeof params.status === "string" && (REQUEST_STATUSES as readonly string[]).includes(params.status) ? params.status : "";
  const rows = await listRequests(status);
  return (
    <>
      <h1>Zgłoszenia</h1>
      <Flash params={params} />
      <p className="note">
        Zgłoszenia z formularza na stronie dla firm (korekta danych, usunięcie wpisu, inne sprawy). Najpierw nowe, potem
        najświeższe. Odpowiedz z własnej poczty na adres zgłaszającego, a tutaj zmień status i dopisz notatkę.
      </p>
      <p>
        <Link className="btn" href="/admin/requests">
          Wszystkie
        </Link>{" "}
        {REQUEST_STATUSES.map((s) => (
          <span key={s}>
            <Link className="btn" href={`/admin/requests?status=${s}`}>
              {STATUS_LABEL[s]}
            </Link>{" "}
          </span>
        ))}
      </p>
      {rows.length === 0 && <p>Brak zgłoszeń.</p>}
      {rows.map((row) => (
        <div key={row.id} className="tablewrap" style={{ padding: "12px 16px" }}>
          <p style={{ margin: 0 }}>
            <strong>{KIND_LABEL[row.kind]}</strong> <span className={`badge ${TONE[row.status]}`}>{STATUS_LABEL[row.status]}</span>{" "}
            <span className="note">{when(row.createdAt)}</span>
          </p>
          <p className="note" style={{ margin: "4px 0" }}>
            <a href={`mailto:${row.email}`}>{row.email}</a>
            {row.nip ? ` · NIP ${row.nip}` : ""}
            {row.handledBy ? ` · obsłużył: ${row.handledBy} (${when(row.handledAt)})` : ""}
          </p>
          <p style={{ whiteSpace: "pre-wrap", margin: "8px 0" }}>{row.message}</p>
          <form action={requestAction} className="form-row" style={{ margin: 0 }}>
            <input type="hidden" name="id" value={row.id} />
            <div>
              <label htmlFor={`status-${row.id}`}>Status</label>
              <select id={`status-${row.id}`} name="status" defaultValue={row.status}>
                {REQUEST_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`note-${row.id}`}>Notatka (do 1000 znaków)</label>
              <input id={`note-${row.id}`} name="note" defaultValue={row.adminNote ?? ""} maxLength={1000} style={{ width: 320 }} />
            </div>
            <button className="primary" type="submit">
              Zapisz
            </button>
          </form>
        </div>
      ))}
    </>
  );
}
