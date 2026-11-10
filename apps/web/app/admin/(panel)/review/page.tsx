import Link from "next/link";

import { reviewAction } from "../../actions";
import { Flash, StatusBadge } from "@/components/admin";
import { listReviewQueue } from "@/lib/admin-data";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ReviewPage({ searchParams }: Props) {
  const params = await searchParams;
  const rows = await listReviewQueue();
  return (
    <>
      <h1>Kolejka weryfikacji</h1>
      <Flash params={params} />
      <p className="note">
        Domeny, których system nie potwierdził automatycznie. Zatwierdzenie ustawia domenę i wpis jako zweryfikowane,
        ale nie publikuje wpisu (publikacja jest osobnym krokiem na karcie firmy).
      </p>
      {rows.length === 0 && <p>Kolejka jest pusta.</p>}
      {rows.map((row) => (
        <div key={row.id} className="tablewrap" style={{ padding: "12px 16px" }}>
          <p style={{ margin: 0 }}>
            <strong className="mono">{row.host}</strong> <StatusBadge status={row.verificationStatus} /> wynik{" "}
            {row.verificationScore ?? "-"} · klasyfikacja: {row.classification}
          </p>
          <p className="note" style={{ margin: "4px 0" }}>
            {row.brandName ? (
              <>
                Marka: {row.listingId ? <Link href={`/admin/firms/${row.listingId}`}>{row.brandName}</Link> : row.brandName}
                {row.city ? ` (${row.city})` : ""}
                {row.entityName ? ` · rejestr: ${row.entityName}` : ""}
                {row.nip ? ` · NIP ${row.nip}` : ""}
              </>
            ) : (
              "Brak dopasowanego podmiotu z rejestru."
            )}
          </p>
          <ul className="plain">
            {[...row.verificationReasons, ...row.classificationReasons].map((r, i) => (
              <li key={`${r}-${i}`}>{r}</li>
            ))}
          </ul>
          <div className="form-row" style={{ margin: 0 }}>
            {row.canonicalUrl && (
              <a className="btn" href={row.canonicalUrl} target="_blank" rel="noopener nofollow">
                Otwórz stronę
              </a>
            )}
            <form action={reviewAction}>
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="decision" value="approve" />
              <button className="primary" type="submit">
                Zatwierdź
              </button>
            </form>
            <form action={reviewAction}>
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="decision" value="reject" />
              <button className="danger" type="submit">
                Odrzuć
              </button>
            </form>
          </div>
        </div>
      ))}
    </>
  );
}
