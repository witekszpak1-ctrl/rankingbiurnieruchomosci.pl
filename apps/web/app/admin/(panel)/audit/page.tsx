import { listAuditLog } from "@/lib/admin-data";
import { when } from "@/components/admin";

export default async function AuditPage() {
  const rows = await listAuditLog(100);
  return (
    <>
      <h1>Audyt zmian</h1>
      <p className="note">Ostatnie 100 zmian wykonanych w panelu.</p>
      {rows.length === 0 ? (
        <p>Brak wpisów.</p>
      ) : (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Kiedy</th>
                <th>Kto</th>
                <th>Akcja</th>
                <th>Obiekt</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{when(r.at)}</td>
                  <td>{r.actor}</td>
                  <td className="mono">{r.action}</td>
                  <td className="mono">
                    {r.entityType} {r.entityId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
