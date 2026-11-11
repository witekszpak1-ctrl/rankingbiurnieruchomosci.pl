import Link from "next/link";
import { notFound } from "next/navigation";

import { listingAction } from "../../../actions";
import { Flash, StatusBadge, when } from "@/components/admin";
import { FirmImage } from "@/components/FirmImage";
import { getFirm } from "@/lib/admin-data";
import { addressText, formatPhone, formatPrice } from "@/lib/format";
import { evaluateGate } from "@/lib/gate";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NETWORK: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X (Twitter)",
};

/** Powody weryfikacji strony w zwykłym języku. Techniczne szczegóły bez znaczenia dla właściciela są pomijane. */
function plainCheck(reason: string): string | null {
  const similarity = /^podobieństwo nazwy ([\d.]+)$/.exec(reason);
  if (similarity) return `nazwa na stronie zgadza się z rejestrem w ${Math.round(Number(similarity[1]) * 100)}%`;
  const map: Record<string, string | null> = {
    "NIP ze strony zgodny z rejestrem": "numer NIP podany na stronie zgadza się z rejestrem",
    "NIP na co najmniej dwóch podstronach": "NIP jest podany na kilku podstronach",
    "na stronie jest inny NIP niż w rejestrze": "uwaga: na stronie jest inny NIP niż w rejestrze",
    "podmiot aktywny w rejestrze": "firma jest aktywna w rejestrze",
    "nazwa z rejestru występuje w tekście strony": "nazwa z rejestru pojawia się na stronie",
    "kod pocztowy zgodny z rejestrem": "kod pocztowy na stronie zgadza się z rejestrem",
    "miasto zgodne z rejestrem": "miasto na stronie zgadza się z rejestrem",
    "PKD zgodny z branżą": "w rejestrze firma ma kod działalności dla pośrednictwa w nieruchomościach",
    "PKD rejestru nie obejmuje branży": "w rejestrze firma ma inny główny kod działalności (to nie przeszkadza)",
    "dokładnie jeden NIP": "na stronie jest jeden numer NIP (to strona jednej firmy, nie katalog)",
    "dane kontaktowe": "strona podaje dane kontaktowe",
    "adres z kodem pocztowym": "strona podaje adres z kodem pocztowym",
  };
  return reason in map ? map[reason] : null;
}

function plainGate(reason: string): string {
  if (reason.startsWith("Domena")) return "strona firmy nie została jeszcze potwierdzona w rejestrach";
  if (reason.startsWith("Brak zwalidowanego opisu")) return "opis jeszcze nie jest gotowy";
  if (reason.startsWith("Za mało faktów")) return "za mało informacji o firmie (system zbierze więcej przy kolejnym odczycie strony)";
  return reason;
}

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
  const isLive = listing.status === "published";
  const isOut = ["rejected", "removed"].includes(listing.status);
  const site = firm.domains.find((d) => d.verificationStatus === "verified") ?? firm.domains[0];
  const siteUrl = site ? site.canonicalUrl ?? `https://${site.host}/` : null;
  const phones = firm.contacts.filter((c) => c.kind === "phone");
  const emails = firm.contacts.filter((c) => c.kind === "email");
  const addresses = [
    ...new Set(
      firm.facts
        .filter((f) => f.type === "address")
        .map((f) => addressText(f.value))
        .filter((a): a is string => !!a),
    ),
  ];
  const addressHints = [
    ...new Set(firm.facts.filter((f) => f.type === "address_hint").map((f) => addressText(f.value)).filter(Boolean)),
  ] as string[];
  const checks = site
    ? [...new Set([...site.verificationReasons, ...site.classificationReasons].map(plainCheck).filter((c): c is string => !!c))]
    : [];

  return (
    <>
      <p className="crumbs">
        <Link href="/admin/firms">Firmy</Link> / {firm.brandName}
      </p>
      <div className="page-head">
        <div className="firm-head">
          <FirmImage src={firm.imageUrl} kind="logo" name={firm.brandName} size="md" />
          <div>
          <h1>{firm.brandName}</h1>
          <p className="page-sub">
            <StatusBadge status={listing.status} /> · {firm.city.name}
          </p>
          </div>
        </div>
        <div className="actions">
          {siteUrl && (
            <a className="btn" href={siteUrl} target="_blank" rel="noopener nofollow">
              Strona firmy
            </a>
          )}
          {isLive && listing.slug && (
            <a className="btn primary" href={`/${firm.city.slug}/${listing.slug}`} target="_blank">
              Zobacz w katalogu
            </a>
          )}
        </div>
      </div>
      <Flash params={sp} />

      <h2>Kontakt</h2>
      <div className="contact-grid">
        <div className="panel">
          <h3>Telefon</h3>
          {phones.length ? (
            phones.map((c) => (
              <p key={c.value}>
                <a href={`tel:${c.value}`}>{formatPhone(c.value)}</a>
              </p>
            ))
          ) : (
            <p className="note">brak na stronie firmy</p>
          )}
        </div>
        <div className="panel">
          <h3>E-mail</h3>
          {emails.length ? (
            emails.map((c) => (
              <p key={c.value}>
                <a href={`mailto:${c.value}`}>{c.value}</a>
              </p>
            ))
          ) : (
            <p className="note">brak na stronie firmy</p>
          )}
          <p className="note">Tylko w panelu, na stronie katalogu nie jest pokazywany.</p>
        </div>
        <div className="panel">
          <h3>Adres</h3>
          {addresses.length ? (
            addresses.map((a) => <p key={a}>{a}</p>)
          ) : addressHints.length ? (
            addressHints.slice(0, 2).map((a) => <p key={a}>{a}</p>)
          ) : (
            <p className="note">brak na stronie firmy</p>
          )}
          {entity && (
            <p className="note">
              W rejestrze: {entity.name}
            </p>
          )}
        </div>
        <div className="panel">
          <h3>Social media</h3>
          {firm.socials.length ? (
            firm.socials.map((s) => (
              <p key={s.url}>
                <a href={s.url} target="_blank" rel="noopener nofollow">
                  {NETWORK[s.network] ?? s.network}
                </a>
              </p>
            ))
          ) : (
            <p className="note">brak linków na stronie firmy</p>
          )}
        </div>
      </div>
      <p className="note">Telefon, e-mail i social media są pobierane automatycznie ze strony firmy raz dziennie.</p>

      <h2>Opis</h2>
      {firm.description ? (
        <>
          <div className="answer">{firm.description.body}</div>
          <p className="note">Napisany automatycznie na podstawie strony firmy i rejestrów (wersja {firm.description.version}).</p>
        </>
      ) : (
        <p className="note">Opis jest w przygotowaniu. Pojawi się automatycznie w ciągu doby.</p>
      )}

      <h2>Oferty i ceny</h2>
      <div className="kpis">
        <Link className="kpi" href={`/admin/offers?q=${encodeURIComponent(site?.host ?? firm.brandName)}`}>
          <b>{firm.offers.active}</b>
          <span>aktualnych ofert nieruchomości</span>
        </Link>
        <div className="kpi">
          <b>{firm.offers.priced}</b>
          <span>ofert z ceną</span>
        </div>
        <div className="kpi">
          <b>{firm.prices.length}</b>
          <span>cen usług biura (prowizje)</span>
        </div>
      </div>
      {firm.prices.length > 0 && (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Usługa</th>
                <th>Cena</th>
                <th>Jak to jest napisane na stronie</th>
              </tr>
            </thead>
            <tbody>
              {firm.prices.map((p) => (
                <tr key={p.id}>
                  <td>{p.service}</td>
                  <td>
                    {formatPrice({ unit: p.unit as never, amountMin: p.amountMin, amountMax: p.amountMax, taxMode: p.taxMode as never })}
                  </td>
                  <td className="quote">
                    {p.quote}{" "}
                    {p.sourceUrl && (
                      <a href={p.sourceUrl} rel="noopener nofollow" target="_blank">
                        źródło
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Dane z rejestru</h2>
      {entity ? (
        <div className="tablewrap">
          <table>
            <tbody>
              <tr><th>Nazwa w rejestrze</th><td>{entity.name}</td></tr>
              <tr><th>NIP</th><td>{entity.nip}</td></tr>
              <tr><th>REGON</th><td>{entity.regon ?? "-"}</td></tr>
              <tr><th>KRS</th><td>{entity.krs ?? "-"}</td></tr>
              <tr><th>Forma prawna</th><td>{entity.legalForm ?? "-"}</td></tr>
              <tr><th>Status VAT</th><td>{entity.vatStatus ?? "-"}</td></tr>
              <tr><th>W rejestrze od</th><td>{entity.startDate ? when(entity.startDate).split(",")[0] : "-"}</td></tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p className="note">Brak danych z rejestru.</p>
      )}

      <h2>Skąd wiemy, że to ta firma</h2>
      {site ? (
        <div className="panel">
          <p>
            Strona <a href={siteUrl ?? "#"} target="_blank" rel="noopener nofollow">{site.host}</a>{" "}
            {site.verificationStatus === "verified"
              ? "została automatycznie potwierdzona jako strona tej firmy."
              : "nie została jeszcze potwierdzona."}
          </p>
          {checks.length > 0 && (
            <ul className="checks">
              {checks.map((c) => (
                <li key={c} className={c.startsWith("uwaga") ? "warn" : ""}>
                  {c}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="note">Brak strony internetowej.</p>
      )}

      <h2>Widoczność w katalogu</h2>
      <div className="panel">
        {isLive && (
          <>
            <p>Firma jest widoczna w katalogu.</p>
            <div className="actions">
              <form action={listingAction}>
                <input type="hidden" name="id" value={listing.id} />
                <input type="hidden" name="action" value="unpublish" />
                <button type="submit">Ukryj z katalogu</button>
              </form>
              <form action={listingAction}>
                <input type="hidden" name="id" value={listing.id} />
                <input type="hidden" name="action" value="reject" />
                <button className="danger" type="submit">
                  Usuń na stałe
                </button>
              </form>
            </div>
          </>
        )}
        {!isLive && !isOut && (
          <>
            <p>
              Firmy jeszcze nie ma w katalogu.{" "}
              {gate.ok ? "Wszystko jest gotowe, system doda ją sam przy najbliższym przebiegu." : "Brakuje:"}
            </p>
            {!gate.ok && (
              <ul className="checks">
                {gate.reasons.map((r) => (
                  <li key={r} className="warn">
                    {plainGate(r)}
                  </li>
                ))}
              </ul>
            )}
            <form action={listingAction} className="actions">
              <input type="hidden" name="id" value={listing.id} />
              <input type="hidden" name="action" value="publish" />
              {!gate.ok && <input type="hidden" name="force" value="on" />}
              <button className="primary" type="submit">
                {gate.ok ? "Dodaj do katalogu teraz" : "Dodaj do katalogu mimo braków"}
              </button>
            </form>
          </>
        )}
        {isOut && (
          <>
            <p>Firma została usunięta z katalogu.</p>
            <form action={listingAction} className="actions">
              <input type="hidden" name="id" value={listing.id} />
              <input type="hidden" name="action" value="publish" />
              <input type="hidden" name="force" value="on" />
              <button type="submit">Przywróć do katalogu</button>
            </form>
          </>
        )}
      </div>

      <details>
        <summary>Szczegóły techniczne (zebrane informacje, sprawdzenie opisu)</summary>
        <div className="tablewrap">
          <table>
            <thead>
              <tr><th>Rodzaj</th><th>Wartość</th><th>Źródło</th></tr>
            </thead>
            <tbody>
              {firm.facts.map((f) => (
                <tr key={f.id}>
                  <td className="mono">{f.type}</td>
                  <td>{showValue(f.value)}</td>
                  <td className="quote">{f.sourceUrl ?? "-"}<div>{when(f.observedAt)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {firm.description && <pre className="mono">{JSON.stringify(firm.description.report, null, 2)}</pre>}
      </details>
    </>
  );
}
