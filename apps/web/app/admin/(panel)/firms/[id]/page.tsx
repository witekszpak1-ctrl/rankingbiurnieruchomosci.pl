import Link from "next/link";
import { notFound } from "next/navigation";

import { listingAction } from "../../../actions";
import { Flash, StatusBadge, when } from "@/components/admin";
import { getFirm } from "@/lib/admin-data";
import { formatPrice } from "@/lib/format";
import { evaluateGate } from "@/lib/gate";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function showValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

export default async function FirmDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const firm = await getFirm(id);
  if (!firm) notFound();
  const gate = evaluateGate(firm.gate);
  const { listing, entity } = firm;
  const canPublish = !["rejected", "removed"].includes(listing.status);

  return (
    <>
      <p className="crumbs">
        <Link href="/admin/firms">Firmy</Link> / {firm.brandName}
      </p>
      <h1>{firm.brandName}</h1>
      <Flash params={sp} />

      <h2>Status i publikacja</h2>
      <p>
        Wpis: <StatusBadge status={listing.status} /> · miasto: {firm.city.name} · adres publiczny:{" "}
        {listing.status === "published" && listing.slug ? (
          <Link href={`/${firm.city.slug}/${listing.slug}`}>
            /{firm.city.slug}/{listing.slug}
          </Link>
        ) : (
          "jeszcze nie opublikowany"
        )}
      </p>
      <div className={`alert ${gate.ok ? "ok" : "warn"}`}>
        <strong>Bramka publikacji: {gate.ok ? "spełniona" : "niespełniona"}</strong>
        {gate.reasons.length > 0 && (
          <ul className="plain">
            {gate.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </div>
      {canPublish && (
        <>
          <form action={listingAction} className="form-row">
            <input type="hidden" name="id" value={listing.id} />
            <input type="hidden" name="action" value="publish" />
            <button className="primary" type="submit">
              {listing.status === "published" ? "Opublikuj ponownie" : "Opublikuj"}
            </button>
            {!gate.ok && (
              <label style={{ margin: 0 }}>
                <input type="checkbox" name="force" /> Wymuś mimo niespełnionej bramki
              </label>
            )}
          </form>
          <div className="form-row">
            {listing.status === "published" && (
              <form action={listingAction}>
                <input type="hidden" name="id" value={listing.id} />
                <input type="hidden" name="action" value="unpublish" />
                <button type="submit">Wycofaj z publikacji</button>
              </form>
            )}
            <form action={listingAction}>
              <input type="hidden" name="id" value={listing.id} />
              <input type="hidden" name="action" value="reject" />
              <button className="danger" type="submit">
                Odrzuć wpis
              </button>
            </form>
          </div>
        </>
      )}

      <h2>Podmiot z rejestru</h2>
      <div className="tablewrap">
        <table>
          <tbody>
            <tr><th>Nazwa w rejestrze</th><td>{entity.name}</td></tr>
            <tr><th>NIP</th><td className="mono">{entity.nip}</td></tr>
            <tr><th>REGON / KRS</th><td className="mono">{entity.regon ?? "-"} / {entity.krs ?? "-"}</td></tr>
            <tr><th>Forma, rodzaj</th><td>{entity.legalForm ?? "-"} ({entity.entityKind ?? "-"})</td></tr>
            <tr><th>Status VAT</th><td>{entity.vatStatus ?? "-"}</td></tr>
            <tr><th>Wpis do rejestru</th><td>{entity.startDate ? when(entity.startDate).split(",")[0] : "-"} (źródło: {entity.registrySource ?? "-"})</td></tr>
            <tr><th>PKD</th><td className="mono">{entity.pkdCodes.join(", ") || "-"}</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Domeny</h2>
      {firm.domains.map((d) => (
        <div key={d.id} className="tablewrap" style={{ padding: "8px 12px" }}>
          <strong className="mono">{d.host}</strong> <StatusBadge status={d.verificationStatus} /> · klasyfikacja:{" "}
          {d.classification} · wynik: {d.verificationScore ?? "-"}
          <ul className="plain">
            {[...d.verificationReasons, ...d.classificationReasons].map((r, i) => (
              <li key={`${r}-${i}`}>{r}</li>
            ))}
          </ul>
        </div>
      ))}

      <h2>Opis</h2>
      {firm.description ? (
        <>
          <p>
            <StatusBadge status={firm.description.status} /> wersja {firm.description.version}, autor:{" "}
            {firm.description.author}
          </p>
          <div className="answer">{firm.description.body}</div>
          <details>
            <summary>Raport walidatora</summary>
            <pre className="mono">{JSON.stringify(firm.description.report, null, 2)}</pre>
          </details>
        </>
      ) : (
        <p className="note">Brak opisu. Czeka na przetworzenie przez Claude Code.</p>
      )}

      <h2>Ceny ({firm.prices.length})</h2>
      {firm.prices.length > 0 && (
        <div className="tablewrap">
          <table>
            <thead>
              <tr><th>Usługa</th><th>Cena</th><th>Cytat</th></tr>
            </thead>
            <tbody>
              {firm.prices.map((p) => (
                <tr key={p.id}>
                  <td>{p.service}</td>
                  <td>{formatPrice({ unit: p.unit as never, amountMin: p.amountMin, amountMax: p.amountMax, taxMode: p.taxMode as never })}</td>
                  <td className="quote">{p.quote} {p.sourceUrl && <a href={p.sourceUrl} rel="noopener nofollow" target="_blank">źródło</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Fakty ({firm.facts.length})</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr><th>Typ</th><th>Wartość</th><th>Metoda</th><th>Źródło</th></tr>
          </thead>
          <tbody>
            {firm.facts.map((f) => (
              <tr key={f.id}>
                <td className="mono">{f.type}</td>
                <td>{showValue(f.value)}<div className="quote">{f.quote}</div></td>
                <td>{f.method}</td>
                <td className="quote">{f.sourceUrl ?? "-"}<div>{when(f.observedAt)}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
