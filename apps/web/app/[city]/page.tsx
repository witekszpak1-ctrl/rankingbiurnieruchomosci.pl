import type { Metadata } from "next";
import Link from "next/link";

import { CompareBar, CompareToggle } from "@/components/Compare";
import { FirmImage } from "@/components/FirmImage";
import { TopThree } from "@/components/TopThree";
import { notFound } from "next/navigation";

import { JsonLd, PublicShell } from "@/components/SiteChrome";
import { unstable_cache } from "next/cache";
import { cityCommissionStats, commissionReport, cityPriceExamples, cityServices, getCity, listCities, listCityListings, type ListingCard } from "@/lib/catalog";
import { inCity } from "@/lib/cities";
import { brandServiceGroups, choosingGuide, cityFaq, cityH1, cityIntro, commissionSection, topThree, type CityData } from "@/lib/city-content";
import { absoluteUrl, formatDate, formatYear } from "@/lib/format";
import { nBiur, nBiurGen, plural } from "@/lib/plural";
import { cityMeta } from "@/lib/meta-texts";
import { breadcrumbLd, pageMetadata, websiteRef } from "@/lib/seo";
import { FILTERS, GOALS, PER_PAGE, parseView, viewHref, type Filter, type Goal, type SearchParams } from "@/lib/city-view";
import { CITY_RANKING_MIN, PRICE_STAT_MIN, rankListings, type RankingInput } from "@/lib/ranking";

export const revalidate = 300;

/** Dane krajowe do porównania w sekcji prowizji: jedno zapytanie na godzinę, nie przy każdej stronie miasta. */
const nationalCommission = unstable_cache(
  async () => {
    const r = await commissionReport();
    return { median: r.median, n: r.n, withPricesPct: r.firms > 0 ? Math.round((100 * r.withPrices) / r.firms) : null };
  },
  ["national-commission-v1"],
  { revalidate: 3600 },
);

type Props = { params: Promise<{ city: string }>; searchParams: Promise<SearchParams> };

const toInput = (l: ListingCard): RankingInput => ({
  startDate: l.startDate,
  hasPublicPrices: l.hasPublicPrices,
  verificationScore: l.verificationScore,
  registryConfirmed: l.registryConfirmed,
  servicesCount: l.servicesCount,
  offersCount: l.offersCount,
  googleRating: l.googleRating,
  googleCount: l.googleCount,
});

async function load(slug: string) {
  const city = await getCity(slug);
  if (!city) return null;
  const listings = await listCityListings(slug);
  if (listings.length === 0) return null;
  const [stats, prices, services, cities, report] = await Promise.all([
    cityCommissionStats(slug),
    cityPriceExamples(slug),
    cityServices(slug),
    listCities().catch(() => []),
    nationalCommission().catch(() => null),
  ]);
  const national = report ?? undefined;
  const ranked = listings.length >= CITY_RANKING_MIN ? rankListings(listings, toInput) : null;
  const updatedAt = new Date(Math.max(0, ...listings.map((l) => (l.publishedAt ? new Date(l.publishedAt).getTime() : 0))));
  return { city, listings, stats, ranked, updatedAt, prices, services, cities, national };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { city: slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Nie znaleziono", robots: { index: false } };
  const view = parseView(await searchParams);
  const year = new Date().getFullYear();
  const withPrices = data.listings.filter((l) => l.hasPublicPrices).length;
  const meta = cityMeta(data.city.name, year, data.listings.length, Boolean(data.ranked), withPrices);
  const filtered = Boolean(view.goal) || view.filters.length > 0;
  if (filtered) {
    // Widoki z filtrami: canonical na stronę miasta bez parametrów i bez indeksowania.
    return pageMetadata({ ...meta, path: `/${data.city.slug}`, noindex: true });
  }
  if (view.page > 1) {
    // Kolejne strony listy: własny canonical, dopuszczone do indeksowania (gdy miasto ma ranking).
    return pageMetadata({
      ...meta,
      title: `${meta.title} (strona ${view.page})`,
      path: viewHref(data.city.slug, view),
      noindex: !data.ranked,
    });
  }
  // Miasto poniżej progu rankingu to krótka lista: widoczna dla ludzi, ale bez indeksowania (cienka treść).
  return pageMetadata({ ...meta, path: `/${data.city.slug}`, noindex: !data.ranked });
}

export default async function CityPage({ params, searchParams }: Props) {
  const { city: slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const view = parseView(await searchParams);
  const { city, listings, stats, ranked, updatedAt, prices, services, cities, national } = data;
  const withPrices = listings.filter((l) => l.hasPublicPrices).length;
  const rows = ranked ?? listings.map((l, i) => ({ ...l, position: i + 1, score: 0, breakdown: [] }));
  // Filtry: pozycje zostają z pełnego rankingu miasta, lista pokazuje tylko pasujące biura.
  const groups = brandServiceGroups(services);
  const goalGroup = view.goal ? GOALS[view.goal].group : null;
  const matching = rows.filter(
    (r) =>
      (!goalGroup || groups.get(r.brandId)?.has(goalGroup)) &&
      view.filters.every((f) => (f === "cennik" ? r.hasPublicPrices : groups.get(r.brandId)?.has(FILTERS[f].group ?? ""))),
  );
  const pages = Math.max(1, Math.ceil(matching.length / PER_PAGE));
  if (view.page > pages) notFound();
  const pageRows = matching.slice((view.page - 1) * PER_PAGE, view.page * PER_PAGE);
  const filtered = Boolean(view.goal) || view.filters.length > 0;
  const firstView = view.page === 1 && !filtered;
  const year = new Date().getFullYear();
  const where = inCity(city.name);
  const content: CityData = {
    cityName: city.name,
    firms: rows.map((r) => ({
      name: r.name,
      slug: r.slug,
      score: r.score,
      position: r.position,
      registryConfirmed: r.registryConfirmed,
      hasPublicPrices: r.hasPublicPrices,
      offersCount: r.offersCount,
    })),
    ranked: Boolean(ranked),
    updatedAt,
    median: stats.median,
    medianN: stats.n,
    medianObservedAt: stats.observedAt,
    prices,
    services,
    national,
  };
  const medianText =
    stats.n >= PRICE_STAT_MIN && stats.median != null
      ? ` Mediana jawnej prowizji od sprzedaży wynosi ${stats.median.toLocaleString("pl-PL")}% (na podstawie ${nBiurGen(stats.n)}, ceny deklarowane przez firmy, wg ich stron z dnia ${formatDate(stats.observedAt)}).`
      : "";
  const confirmed = listings.filter((l) => l.registryConfirmed).length;
  const confirmedText =
    confirmed === listings.length ? "Wszystkie są potwierdzone w rejestrach publicznych." : `${confirmed} z nich ${plural(confirmed, "jest potwierdzone", "są potwierdzone", "jest potwierdzonych")} w rejestrach publicznych.`;
  const summary = `Katalog zawiera ${nBiur(listings.length)} nieruchomości ${where}. ${confirmedText} ${withPrices} z nich ${plural(withPrices, "publikuje", "publikują", "publikuje")} na swojej stronie ceny usług.${medianText}`;
  const top = topThree(content);
  const commission = commissionSection(content);
  const guide = choosingGuide(content);
  const faq = cityFaq(content);
  const otherCities = cities.filter((c) => c.slug !== city.slug).slice(0, 8);

  return (
    <PublicShell>
      <p className="crumbs">
        <Link href="/">Strona główna</Link> / {city.name}
      </p>
      <h1>{cityH1(city.name, Boolean(ranked), year)}</h1>
      <p className="lead-text">{cityIntro(content)}</p>

      <div className="answer">
        <strong>W skrócie</strong>
        <p>{summary}</p>
      </div>

      {city.editorial &&
        city.editorial
          .split(/\n\s*\n/)
          .map((para, i) => <p key={i}>{para.trim()}</p>)}

      <ul className="city-stats" aria-label={`Biura nieruchomości ${where} w liczbach`}>
        <li>
          <b>{listings.length}</b>
          <span>{plural(listings.length, "biuro", "biura", "biur")} w katalogu</span>
        </li>
        <li>
          <b>{confirmed}</b>
          <span>{plural(confirmed, "potwierdzone", "potwierdzone", "potwierdzonych")} w rejestrze</span>
        </li>
        <li>
          <b>{withPrices}</b>
          <span>z jawnym cennikiem</span>
        </li>
        {stats.n >= PRICE_STAT_MIN && stats.median != null && (
          <li>
            <b>{stats.median.toLocaleString("pl-PL")}%</b>
            <span>mediana prowizji od sprzedaży ({nBiurGen(stats.n)})</span>
          </li>
        )}
      </ul>

      {firstView && top.length > 0 && (
        <>
          <h2>Najlepsze biura nieruchomości {where}</h2>
          <TopThree
            firms={top.map((f) => ({
              key: f.slug ?? f.name,
              href: f.slug ? `/${city.slug}/${f.slug}` : null,
              name: f.name,
              score: f.score,
              position: f.position,
              logoUrl: rows.find((r) => r.slug === f.slug)?.logoUrl ?? null,
            }))}
          />
          <p className="note">
            Najwyższe wyniki w rankingu {where} mają{" "}
            {top.map((f, i) => (
              <span key={f.slug ?? f.name}>
                {i > 0 && (i === top.length - 1 ? " i " : ", ")}
                {f.slug ? <Link href={`/${city.slug}/${f.slug}`}>{f.name}</Link> : f.name} ({f.score}/100)
              </span>
            ))}
            . To wynik według <Link href="/metodologia">jawnej metodologii katalogu</Link>, opartej m.in. na
            potwierdzeniu w rejestrze, stażu, jawności cennika, zakresie usług i aktualnych ofertach, a nie ocena jakości
            obsługi.
          </p>
        </>
      )}

      <h2 id="lista">{ranked ? `Porównanie biur nieruchomości ${where}` : `Lista biur nieruchomości ${where} (alfabetycznie)`}</h2>
      <nav aria-label="Czego szukasz">
        <ul className="chips">
          <li>
            <a href={viewHref(city.slug, { page: 1, goal: null, filters: view.filters }) + "#lista"} aria-current={view.goal === null}>
              Wszystkie biura
            </a>
          </li>
          {(Object.keys(GOALS) as Goal[]).map((g) => (
            <li key={g}>
              <a href={viewHref(city.slug, { page: 1, goal: g, filters: view.filters }) + "#lista"} aria-current={view.goal === g}>
                {GOALS[g].label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <nav aria-label="Filtry">
        <ul className="chips">
          {(Object.keys(FILTERS) as Filter[]).map((f) => {
            const on = view.filters.includes(f);
            const next = on ? view.filters.filter((x) => x !== f) : [...view.filters, f];
            return (
              <li key={f}>
                <a href={viewHref(city.slug, { page: 1, goal: view.goal, filters: next }) + "#lista"} aria-current={on}>
                  {on ? "✓ " : ""}
                  {FILTERS[f].label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
      {filtered && (
        <p className="note">
          Pasujące biura: {matching.length} z {nBiurGen(listings.length)}. Filtry działają na usługach i cenach, które
          biura podają na swoich stronach.
        </p>
      )}
      {!ranked && (
        <p className="note">
          Ranking publikujemy od {CITY_RANKING_MIN} biur w mieście, żeby pozycje miały sens. Do tego czasu pokazujemy listę.
        </p>
      )}
      {pageRows.length === 0 ? (
        <p>
          Żadne biuro {where} nie spełnia tych warunków.{" "}
          <a href={viewHref(city.slug, { page: 1, goal: null, filters: [] }) + "#lista"}>Pokaż wszystkie biura</a>.
        </p>
      ) : (
        <div className="tablewrap">
          <table className="city-table">
            <thead>
              <tr>
                {ranked && <th className="num">#</th>}
                <th>Biuro</th>
                {ranked && <th>Wynik</th>}
                <th>Cennik</th>
                <th>W rejestrze od</th>
                <th className="num">Usługi</th>
                <th>
                  <span className="sr-only">Porównaj</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={row.listingId}>
                  {ranked && <td className="num">{row.position}.</td>}
                  <td className="firm">
                    <Link href={`/${city.slug}/${row.slug}`} className="firm-cell">
                      <FirmImage src={row.logoUrl} kind="logo" name={row.name} alt={`Logo ${row.name}`} size="sm" />
                      <span>{row.name}</span>
                    </Link>
                  </td>
                  {ranked && (
                    <td data-label="Wynik">
                      <span className="bar-track" aria-hidden="true">
                        <span className="bar" style={{ width: `${row.score}%` }} />
                      </span>
                      {row.score}/100
                    </td>
                  )}
                  <td data-label="Cennik">
                    {row.hasPublicPrices ? <span className="badge ok">jawny</span> : <span className="badge">brak</span>}
                  </td>
                  <td data-label="W rejestrze od">
                    {row.registryConfirmed ? formatYear(row.startDate) : <span className="note">bez potwierdzenia</span>}
                  </td>
                  <td className="num" data-label="Usługi">
                    {row.servicesCount}
                  </td>
                  <td>
                    <CompareToggle id={row.listingId} name={row.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav className="pager" aria-label="Strony listy biur">
          {view.page > 1 && (
            <Link href={viewHref(city.slug, { ...view, page: view.page - 1 })} rel="prev">
              Poprzednia
            </Link>
          )}
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) =>
            n === view.page ? (
              <span key={n} aria-current="page">
                {n}
              </span>
            ) : (
              <Link key={n} href={viewHref(city.slug, { ...view, page: n })}>
                {n}
              </Link>
            ),
          )}
          {view.page < pages && (
            <Link href={viewHref(city.slug, { ...view, page: view.page + 1 })} rel="next">
              Następna
            </Link>
          )}
        </nav>
      )}
      <CompareBar />
      <p className="note">
        Wynik liczymy według <Link href="/metodologia">publicznej metodologii</Link>. Płatność nie wpływa na pozycję.
        Dane aktualne na dzień {formatDate(updatedAt)}.
      </p>

      {firstView && (
        <>
      <h2>Ile wynosi prowizja biura nieruchomości {where}?</h2>
      <p>{commission.summary}</p>
      {commission.examples.length > 0 && (
        <ul className="plain">
          {commission.examples.map((e) => (
            <li key={e.firmSlug}>
              <Link href={`/${city.slug}/${e.firmSlug}`}>{e.firmName}</Link>: {e.service}, {e.value}
            </li>
          ))}
        </ul>
      )}
      <p className="note">{commission.note}</p>
      <p>
        Porównanie z innymi miastami: raport{" "}
        <Link href="/raporty/prowizje-biur-nieruchomosci-2026">Prowizje biur nieruchomości 2026</Link>. Jak czytać stawki:{" "}
        <Link href="/poradnik/ile-bierze-biuro-nieruchomosci">ile bierze biuro nieruchomości</Link>.
      </p>

      <h2>Jak wybrać biuro nieruchomości {where}?</h2>
      {guide.map((para, i) => (
        <p key={i}>{para}</p>
      ))}
      <p>
        Lista kontrolna przed podpisaniem umowy:{" "}
        <Link href="/poradnik/jak-sprawdzic-biuro-nieruchomosci">jak sprawdzić biuro nieruchomości</Link>.
      </p>

      <h2>Najczęściej zadawane pytania</h2>
      <div className="faq">
        {faq.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>

        </>
      )}

      {otherCities.length > 0 && (
        <>
          <h2>Biura nieruchomości w innych miastach</h2>
          <ul className="city-grid">
            {otherCities.map((c) => (
              <li key={c.slug}>
                <Link href={`/${c.slug}`} title={`Biura nieruchomości ${inCity(c.name)}`}>
                  <b>{c.name}</b>
                  <span>{nBiur(c.listings)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p>
            <Link href="/miasta">Wszystkie miasta według województw</Link>
          </p>
        </>
      )}

      {firstView && (
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }}
      />
      )}

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "@id": `${absoluteUrl(`/${city.slug}`)}#strona`,
          url: absoluteUrl(`/${city.slug}`),
          name: `Biura nieruchomości ${city.name}`,
          inLanguage: "pl-PL",
          dateModified: updatedAt.toISOString(),
          isPartOf: websiteRef(),
          mainEntity: {
            "@type": "ItemList",
            name: ranked ? `Ranking biur nieruchomości ${city.name}` : `Biura nieruchomości ${city.name}`,
            itemListOrder: ranked ? "https://schema.org/ItemListOrderDescending" : "https://schema.org/ItemListOrderAscending",
            numberOfItems: listings.length,
            itemListElement: pageRows.map((row) => ({
              "@type": "ListItem",
              position: row.position,
              name: row.name,
              url: absoluteUrl(`/${city.slug}/${row.slug}`),
            })),
          },
        }}
      />
      <JsonLd data={breadcrumbLd([{ name: "Strona główna", path: "/" }, { name: `Biura nieruchomości ${city.name}`, path: `/${city.slug}` }])} />
    </PublicShell>
  );
}
