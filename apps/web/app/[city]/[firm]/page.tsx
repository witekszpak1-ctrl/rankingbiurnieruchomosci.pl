import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FirmImage } from "@/components/FirmImage";
import { LeadForm } from "@/components/LeadForm";
import { ShowPhone } from "@/components/ShowPhone";
import { Stars } from "@/components/Stars";
import { JsonLd, PublicShell } from "@/components/SiteChrome";
import { getPublishedListing } from "@/lib/catalog";
import { absoluteUrl, formatDate, formatOfferPrice, formatPhone, formatPrice } from "@/lib/format";
import { scoreListing } from "@/lib/ranking";

export const revalidate = 300;

type Props = {
  params: Promise<{ city: string; firm: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, firm } = await params;
  const listing = await getPublishedListing(city, firm);
  if (!listing) return { title: "Nie znaleziono", robots: { index: false } };
  return {
    title: `${listing.name} - biuro nieruchomości ${listing.cityName}`,
    description: listing.description ?? `Biuro nieruchomości ${listing.name} z miasta ${listing.cityName}.`,
    alternates: { canonical: `/${city}/${firm}` },
    openGraph: listing.coverUrl || listing.logoUrl ? { images: [(listing.coverUrl ?? listing.logoUrl) as string] } : undefined,
  };
}

function newest(dates: Date[]): Date {
  return new Date(Math.max(...dates.map((d) => new Date(d).getTime())));
}

function yearsSince(date: Date | null): number | null {
  if (!date) return null;
  const years = Math.floor((Date.now() - new Date(date).getTime()) / (365.25 * 24 * 3600 * 1000));
  return years >= 1 ? years : null;
}

function yearsLabel(n: number): string {
  if (n === 1) return "1 rok w rejestrze";
  const last = n % 10;
  const lastTwo = n % 100;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${n} lata w rejestrze`;
  return `${n} lat w rejestrze`;
}

const SOCIAL: Record<string, { label: string; path: string }> = {
  facebook: { label: "Facebook", path: "M14 8h3V4h-3a4 4 0 0 0-4 4v2H8v4h2v6h4v-6h3l1-4h-4V8z" },
  instagram: {
    label: "Instagram",
    path: "M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm5 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm5.5-1.5h.01",
  },
  linkedin: { label: "LinkedIn", path: "M4 9h4v11H4zM6 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm4 6h4v2c.6-1.2 2-2.2 4-2.2 3 0 4 2 4 5V20h-4v-5c0-1.5-.5-2.5-2-2.5S14 13.5 14 15v5h-4z" },
  youtube: { label: "YouTube", path: "M3 8c0-2 1-3 3-3h12c2 0 3 1 3 3v8c0 2-1 3-3 3H6c-2 0-3-1-3-3zm7 1v6l5-3z" },
  tiktok: { label: "TikTok", path: "M14 3v11a3 3 0 1 1-3-3V8a6 6 0 1 0 6 6V8c1 1 2.5 1.5 4 1.5v-3C19 6.5 17 5 16.5 3z" },
  x: { label: "X", path: "M4 4l16 16M20 4L4 20" },
};

export default async function FirmPage({ params, searchParams }: Props) {
  const { city, firm } = await params;
  const sp = (await searchParams) ?? {};
  const listing = await getPublishedListing(city, firm);
  if (!listing) notFound();
  const { breakdown, score } = scoreListing({
    startDate: listing.startDate,
    hasPublicPrices: listing.hasPublicPrices,
    verificationScore: listing.verificationScore,
    servicesCount: listing.servicesCount,
    offersCount: listing.offersCount,
    googleRating: listing.googleRating,
    googleCount: listing.googleCount,
  });
  const years = yearsSince(listing.startDate);
  const path = `/${listing.citySlug}/${listing.slug}`;

  return (
    <PublicShell wide>
      <div className="wrap profile">
        <div className="profile-cover">
          {listing.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.coverUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="cover-pattern" aria-hidden="true" />
          )}
        </div>
        <div className="profile-grid">
          <div className="profile-main">
            <div className="profile-avatar">
              <FirmImage src={listing.logoUrl} kind="logo" name={listing.name} size="lg" />
            </div>
            <nav className="crumbs" aria-label="Okruszki">
              <Link href="/">Strona główna</Link>
              <span>›</span>
              <Link href={`/${listing.citySlug}`}>Biura nieruchomości {listing.cityName}</Link>
              <span>›</span>
              <span>{listing.name}</span>
            </nav>
            <h1 className="profile-name">{listing.name}</h1>
            {listing.googleRating && listing.googleCount ? (
              <div className="profile-rating">
                <Stars value={listing.googleRating} />
                <b>{listing.googleRating.toFixed(1)}</b>
                <a href="#opinie">({listing.googleCount} opinii w Google)</a>
              </div>
            ) : null}
            <div className="profile-score">
              <span className="score-pill">{score}/100</span>
              <span>wynik w rankingu biur w mieście {listing.cityName}</span>
            </div>
            <ul className="chips">
              {years && <li>{yearsLabel(years)}</li>}
              <li>{listing.cityName}</li>
              {listing.offersCount > 0 && <li>{listing.offersCount} aktualnych ofert</li>}
              {listing.hasPublicPrices && <li className="ok">jawny cennik</li>}
              {listing.websiteUrl && (
                <li>
                  <a href={listing.websiteUrl} rel="noopener nofollow" target="_blank">
                    {listing.host}
                  </a>
                </li>
              )}
            </ul>
            <div className="profile-actions">
              {listing.phone && <ShowPhone phone={listing.phone} label={formatPhone(listing.phone)} />}
              <a className="btn-outline" href="#zapytanie">
                Napisz do biura
              </a>
            </div>

            {listing.description && (
              <section className="profile-section">
                <h2>O biurze</h2>
                <p className="profile-about">{listing.description}</p>
                <p className="note">Opis przygotowaliśmy na podstawie strony biura i rejestrów publicznych.</p>
              </section>
            )}

            {listing.google && listing.google.reviews.length > 0 && (
              <section className="profile-section" id="opinie">
                <div className="reviews-head">
                  <h2>Opinie klientów</h2>
                  {listing.googleRating && (
                    <span className="reviews-summary">
                      <Stars value={listing.googleRating} size={16} /> {listing.googleRating.toFixed(1)} · {listing.googleCount}{" "}
                      opinii
                    </span>
                  )}
                </div>
                <ul className="reviews">
                  {listing.google.reviews.map((r, i) => (
                    <li key={`${r.author}-${i}`}>
                      <span className="review-avatar" aria-hidden="true">
                        {r.author.slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <div className="review-meta">
                          <b>{r.author}</b>
                          {r.relative_time && <span>{r.relative_time}</span>}
                          <span className="review-source">Google</span>
                        </div>
                        <Stars value={r.rating} size={16} />
                        <p>{r.text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="note">
                  Opinie pochodzą z Google i są wyświetlane bez zmian.{" "}
                  {listing.google.mapsUrl && (
                    <a href={listing.google.mapsUrl} target="_blank" rel="noopener nofollow">
                      Zobacz wszystkie opinie w Google Maps
                    </a>
                  )}
                </p>
              </section>
            )}

            {listing.services.length > 0 && (
              <section className="profile-section">
                <h2>Usługi</h2>
                <ul className="service-chips">
                  {listing.services.map((service) => (
                    <li key={service}>{service}</li>
                  ))}
                </ul>
              </section>
            )}

            {listing.offers.length > 0 && (
              <section className="profile-section">
                <h2>Aktualne oferty</h2>
                <ul className="offer-rows">
                  {listing.offers.map((offer) => {
                    const price = formatOfferPrice(offer.priceAmount, offer.priceCurrency, offer.pricePeriod);
                    return (
                      <li key={offer.url}>
                        <span className="offer-thumb" aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <path d="M3 11 12 4l9 7" />
                            <path d="M5 10v10h14V10" />
                            <path d="M10 20v-5h4v5" />
                          </svg>
                        </span>
                        <span className="offer-info">
                          <b>{offer.title}</b>
                          <span>
                            {listing.cityName} · oferta biura {listing.name}
                          </span>
                        </span>
                        <span className={price ? "offer-price" : "offer-price none"}>{price ?? "cena na stronie biura"}</span>
                        <a className="offer-go" href={offer.url} rel="noopener nofollow" target="_blank">
                          Zobacz ofertę
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M7 17 17 7M9 7h8v8" />
                          </svg>
                        </a>
                      </li>
                    );
                  })}
                </ul>
                <p className="note">
                  Najnowsze oferty ze strony biura
                  {listing.offersSourceUrl && (
                    <>
                      {" "}
                      (
                      <a href={listing.offersSourceUrl} rel="noopener nofollow" target="_blank">
                        wszystkie oferty
                      </a>
                      )
                    </>
                  )}
                  , sprawdzone {formatDate(newest(listing.offers.map((o) => o.lastSeenAt)))}. Cenę i dostępność potwierdź
                  w biurze.
                </p>
              </section>
            )}

            <section className="profile-section">
              <h2>Prowizje i ceny usług</h2>
              {listing.prices.length > 0 ? (
                <>
                  <div className="price-boxes">
                    {listing.prices.map((price) => (
                      <div key={`${price.service}-${price.sourceUrl}`} className="price-box">
                        <span>{price.service}</span>
                        <b>{formatPrice(price)}</b>
                      </div>
                    ))}
                  </div>
                  <p className="note">
                    Ceny deklarowane przez biuro na jego stronie, sprawdzone{" "}
                    {formatDate(newest(listing.prices.map((p) => p.observedAt)))}. Mogły się zmienić.
                  </p>
                </>
              ) : (
                <p>Biuro nie publikuje cen na swojej stronie i ustala je indywidualnie.</p>
              )}
            </section>

            <section className="profile-section">
              <h2>Dane kontaktowe</h2>
              <div className="info-grid">
                {listing.address && (
                  <div>
                    <span>Adres</span>
                    <b>{listing.address}</b>
                  </div>
                )}
                {listing.phone && (
                  <div>
                    <span>Telefon</span>
                    <b>
                      <a href={`tel:${listing.phone}`}>{formatPhone(listing.phone)}</a>
                    </b>
                  </div>
                )}
                {listing.websiteUrl && (
                  <div>
                    <span>Strona internetowa</span>
                    <b>
                      <a href={listing.websiteUrl} rel="noopener nofollow" target="_blank">
                        {listing.host}
                      </a>
                    </b>
                  </div>
                )}
                {listing.legalForm && (
                  <div>
                    <span>Forma prawna</span>
                    <b>{listing.legalForm.toLowerCase()}</b>
                  </div>
                )}
              </div>
              {listing.socials.length > 0 && (
                <>
                  <h3 className="mini-head">Biuro w mediach społecznościowych</h3>
                  <ul className="social-row">
                    {listing.socials.map((s) => {
                      const meta = SOCIAL[s.network];
                      return (
                        <li key={s.url}>
                          <a href={s.url} target="_blank" rel="noopener nofollow" aria-label={meta?.label ?? s.network}>
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d={meta?.path ?? "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"} />
                            </svg>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </section>

            <section className="profile-section">
              <h2>Wynik w rankingu: {score}/100</h2>
              <div className="score-rows">
                {breakdown.map((item) => (
                  <div key={item.key} className="score-row">
                    <span>{item.label}</span>
                    <span className="score-track" aria-hidden="true">
                      <span style={{ width: `${Math.round(item.value * 100)}%` }} />
                    </span>
                    <b>{Math.round(item.value * 100)}%</b>
                  </div>
                ))}
              </div>
              <p className="note">
                Jak liczymy wynik: <Link href="/metodologia">metodologia</Link>. Dane aktualne na dzień{" "}
                {formatDate(listing.updatedAt)}. Widzisz błąd? <Link href="/dla-firm">Zgłoś korektę</Link>.
              </p>
            </section>

            <section className="owner-band">
              <div>
                <b>To Twoja firma?</b>
                <span>Uzupełnij profil, popraw dane albo poproś o usunięcie wpisu.</span>
              </div>
              <Link className="btn-outline" href={`/wlasciciel/${listing.listingId}`}>
                Jestem właścicielem tej firmy
              </Link>
            </section>
          </div>

          <aside className="profile-aside">
            <LeadForm
              listingId={listing.listingId}
              firmName={listing.name}
              path={path}
              sent={sp.sent === "1"}
              error={typeof sp.error === "string" ? sp.error : null}
              imageSlot={<FirmImage src={listing.logoUrl} kind="logo" name={listing.name} size="sm" />}
            />
          </aside>
        </div>
      </div>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "RealEstateAgent",
          name: listing.name,
          url: listing.websiteUrl ?? absoluteUrl(path),
          image: listing.coverUrl ?? listing.logoUrl ?? undefined,
          logo: listing.logoUrl ?? undefined,
          telephone: listing.phone ?? undefined,
          description: listing.description ?? undefined,
          address: {
            "@type": "PostalAddress",
            streetAddress: listing.address ?? undefined,
            addressLocality: listing.cityName,
            addressCountry: "PL",
          },
          areaServed: listing.cityName,
          sameAs: listing.socials.map((s) => s.url),
        }}
      />
    </PublicShell>
  );
}
