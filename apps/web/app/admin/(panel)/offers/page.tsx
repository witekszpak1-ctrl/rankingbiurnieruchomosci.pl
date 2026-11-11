import Link from "next/link";

import { when } from "@/components/admin";
import { listAdminOffers, listOfferFirms, type AdminOffer } from "@/lib/admin-offers";
import { formatOfferPrice } from "@/lib/format";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "-");

export default async function OffersPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = one(params.q).trim().toLowerCase();
  const show = one(params.show);
  const [allFirms, offers] = await Promise.all([listOfferFirms(), listAdminOffers()]);

  const byDomain = new Map<string, AdminOffer[]>();
  for (const offer of offers) {
    const list = byDomain.get(offer.domainId) ?? [];
    list.push(offer);
    byDomain.set(offer.domainId, list);
  }

  const firms = allFirms.filter((f) => {
    if (q && !`${f.brandName} ${f.host} ${f.cityName ?? ""}`.toLowerCase().includes(q)) return false;
    if (show === "with") return f.active > 0;
    if (show === "without") return f.active === 0;
    return true;
  });

  const totalActive = allFirms.reduce((a, f) => a + f.active, 0);
  const totalPriced = allFirms.reduce((a, f) => a + f.priced, 0);
  const withOffers = allFirms.filter((f) => f.active > 0).length;
  const lastCheck = allFirms.map((f) => f.checkedAt).filter(Boolean).sort().at(-1) ?? null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Oferty</h1>
          <p className="page-sub">Oferty nieruchomości pobierane codziennie ze stron opublikowanych biur.</p>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <b>{totalActive}</b>
          <span>aktywnych ofert</span>
        </div>
        <div className="stat">
          <b>{withOffers}</b>
          <span>firm z ofertami</span>
        </div>
        <div className="stat">
          <b>{allFirms.length - withOffers}</b>
          <span>firm bez ofert</span>
        </div>
        <div className="stat">
          <b>{pct(totalPriced, totalActive)}</b>
          <span>ofert z ceną</span>
        </div>
        <div className="stat">
          <b>{when(lastCheck)}</b>
          <span>ostatnie sprawdzenie</span>
        </div>
      </div>

      <form method="get" className="form-row">
        <div>
          <label htmlFor="q">Firma, domena lub miasto</label>
          <input id="q" name="q" defaultValue={one(params.q)} />
        </div>
        <div>
          <label htmlFor="show">Pokaż</label>
          <select id="show" name="show" defaultValue={show}>
            <option value="">wszystkie firmy</option>
            <option value="with">tylko z ofertami</option>
            <option value="without">tylko bez ofert</option>
          </select>
        </div>
        <button type="submit">Filtruj</button>
      </form>

      <p className="note">{firms.length} firm. Kliknij firmę, żeby zobaczyć wszystkie jej oferty.</p>

      <div className="offer-firms">
        {firms.map((firm) => {
          const list = byDomain.get(firm.domainId) ?? [];
          const active = list.filter((o) => o.isActive);
          const inactive = list.length - active.length;
          return (
            <details key={firm.domainId} className="offer-firm">
              <summary>
                <span className="of-name">
                  <b>{firm.brandName}</b>
                  <span className="mono">{firm.host}</span>
                </span>
                <span className="of-city">{firm.cityName ?? "-"}</span>
                <span className="of-num">
                  <b>{firm.active}</b>
                  <span>ofert</span>
                </span>
                <span className="of-num">
                  <b>{firm.priced}</b>
                  <span>z ceną</span>
                </span>
                <span className="of-when">{firm.checkedAt ? when(firm.checkedAt) : "nie sprawdzano"}</span>
                <span className={`badge ${firm.active ? "ok" : firm.checkedAt ? "warn" : ""}`}>
                  {firm.active ? "są oferty" : firm.checkedAt ? "brak ofert" : "czeka"}
                </span>
              </summary>
              <div className="of-body">
                <div className="actions">
                  {firm.offersUrl && (
                    <a className="btn" href={firm.offersUrl} target="_blank" rel="noopener nofollow">
                      Strona ofert biura
                    </a>
                  )}
                  {firm.citySlug && firm.slug && (
                    <a className="btn" href={`/${firm.citySlug}/${firm.slug}`} target="_blank">
                      Profil w katalogu
                    </a>
                  )}
                  {firm.listingId && (
                    <Link className="btn" href={`/admin/firms/${firm.listingId}`}>
                      Karta firmy w panelu
                    </Link>
                  )}
                </div>
                {list.length === 0 ? (
                  <p className="note">
                    {firm.checkedAt
                      ? "Na stronie biura nie znaleziono listy ofert. Szczegóły są w logu przebiegu offers na GitHub Actions."
                      : "Oferty zostaną pobrane w najbliższym przebiegu (codziennie rano)."}
                  </p>
                ) : (
                  <div className="tablewrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Oferta</th>
                          <th className="num">Cena</th>
                          <th>Status</th>
                          <th>Pierwszy raz</th>
                          <th>Ostatnio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((offer) => (
                          <tr key={offer.url}>
                            <td>
                              <a href={offer.url} target="_blank" rel="noopener nofollow">
                                {offer.title}
                              </a>
                            </td>
                            <td className="num">
                              {formatOfferPrice(offer.priceAmount, offer.priceCurrency, offer.pricePeriod) ?? (
                                <span className="note">-</span>
                              )}
                            </td>
                            <td>
                              <span className={`badge ${offer.isActive ? "ok" : ""}`}>
                                {offer.isActive ? "aktywna" : "zniknęła"}
                              </span>
                            </td>
                            <td>{when(offer.firstSeenAt)}</td>
                            <td>{when(offer.lastSeenAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {inactive > 0 && <p className="note">{inactive} ofert zniknęło ze strony biura (sprzedane lub zdjęte).</p>}
              </div>
            </details>
          );
        })}
      </div>
    </>
  );
}
