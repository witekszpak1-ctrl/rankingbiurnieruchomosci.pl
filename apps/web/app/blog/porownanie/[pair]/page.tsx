import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlogArticle, Faq, ShortAnswer, faqLd } from "@/components/BlogArticle";
import { PairBars } from "@/components/BlogCharts";
import { blogPath, coverPath, fmtInt, fmtRate, fmtRating, fmtShare, fmtYears } from "@/lib/blog";
import { CITY_COMPARE_MIN, MIN_REVIEWS, YEARS_MIN, cityPairs, loadBlogData, pairPoints, type CityPair, type CityStats } from "@/lib/blog-stats";
import { getCity, listCityListings, cityServices, type ListingCard } from "@/lib/catalog";
import { serviceGroups } from "@/lib/city-content";
import { inCity } from "@/lib/cities";
import {
  cityPortrait,
  pairAdvice,
  pairFaq,
  pricesComparison,
  ratingsComparison,
  seedOf,
  servicesComparison,
  tenureComparison,
  type CityExtra,
} from "@/lib/pair-content";
import { nBiur, nBiurGen, nOpinii, plural } from "@/lib/plural";
import { CITY_RANKING_MIN, PRICE_STAT_MIN, rankListings, type RankingInput } from "@/lib/ranking";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 86400;

const PUBLISHED = "2026-11-21";
const MODIFIED = "2026-11-21";

type Props = { params: Promise<{ pair: string }> };

export async function generateStaticParams(): Promise<{ pair: string }[]> {
  const data = await loadBlogData().catch(() => null);
  return data ? cityPairs(data.cities).map((p) => ({ pair: p.slug })) : [];
}

async function findPair(slug: string): Promise<{ pair: CityPair; all: CityPair[] } | null> {
  const data = await loadBlogData().catch(() => null);
  if (!data) return null;
  const all = cityPairs(data.cities);
  const pair = all.find((p) => p.slug === slug);
  return pair ? { pair, all } : null;
}

const titleOf = (p: CityPair) => `${p.a.name} czy ${p.b.name}? Biura nieruchomości w liczbach`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pair } = await params;
  const found = await findPair(pair);
  if (!found) return { title: "Porównanie miast", robots: { index: false } };
  const { a, b } = found.pair;
  return pageMetadata({
    title: `${a.name} czy ${b.name}? Porównanie biur nieruchomości 2026`,
    description: `${a.name} i ${b.name} w liczbach: biura nieruchomości, oceny Google, staż, jawne cenniki i mediana prowizji za sprzedaż.`,
    path: blogPath(`porownanie/${pair}`),
    type: "article",
    image: coverPath(`porownanie-${pair}`),
  });
}

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

/** Dane jednego miasta spoza statystyk bloga: usługi (odsetek wpisów), TOP 3 rankingu miasta i opis redakcyjny. */
async function cityExtra(c: CityStats): Promise<CityExtra> {
  const [listings, services, city] = await Promise.all([
    listCityListings(c.slug).catch(() => [] as ListingCard[]),
    cityServices(c.slug).catch(() => []),
    getCity(c.slug).catch(() => null),
  ]);
  const denom = Math.max(listings.length, 1);
  const ranked = listings.length >= CITY_RANKING_MIN ? rankListings(listings, toInput) : [];
  return {
    services: serviceGroups(services).map((g) => ({ label: g.label, share: (100 * g.count) / denom })),
    top: ranked.slice(0, 3).map((f) => ({ name: f.name, slug: f.slug, citySlug: c.slug, score: f.score, rating: f.googleRating, reviews: f.googleCount })),
    editorial: city?.editorial?.split(/\n\s*\n/)[0]?.trim() || null,
  };
}

function winnerText(key: string, w: "a" | "b" | "tie" | null, a: CityStats, b: CityStats): string | null {
  if (w == null) return null;
  const win = w === "a" ? a : b;
  const lose = w === "a" ? b : a;
  switch (key) {
    case "firms":
      return w === "tie"
        ? `W obu miastach mamy w katalogu tyle samo biur (${a.firms}).`
        : `Więcej biur mamy w katalogu ${inCity(win.name)}: ${win.firms} wobec ${lose.firms} ${inCity(lose.name)}.`;
    case "rating":
      return w === "tie"
        ? `Biura w obu miastach są oceniane podobnie (średnio ${fmtRating(a.avgRating)} i ${fmtRating(b.avgRating)}).`
        : `Wyżej oceniane są biura ${inCity(win.name)}: średnio ${fmtRating(win.avgRating)} wobec ${fmtRating(lose.avgRating)}.`;
    case "years":
      return w === "tie"
        ? `Typowe biuro jest w rejestrze podobnie długo w obu miastach (${fmtYears(a.medianYears)}).`
        : `Dłużej w rejestrze są biura ${inCity(win.name)}: mediana stażu ${fmtYears(win.medianYears)} wobec ${fmtYears(lose.medianYears)}.`;
    case "prices":
      return w === "tie"
        ? `Cennik na stronie publikuje podobna część biur (${fmtShare(a.sharePrices)} i ${fmtShare(b.sharePrices)}).`
        : `Cennik na stronie częściej publikują biura ${inCity(win.name)} (${fmtShare(win.sharePrices)} wobec ${fmtShare(lose.sharePrices)}).`;
    case "commission":
      return w === "tie"
        ? `Prowizje za sprzedaż są podobne (mediana ${fmtRate(a.commission)} i ${fmtRate(b.commission)}).`
        : `Niższe prowizje za sprzedaż są ${inCity(win.name)}: mediana ${fmtRate(win.commission)} wobec ${fmtRate(lose.commission)}.`;
    default:
      return null;
  }
}

export default async function CityPairPage({ params }: Props) {
  const { pair } = await params;
  const found = await findPair(pair);
  if (!found) notFound();
  const { a, b } = found.pair;
  const points = pairPoints(a, b);
  const sentences = points.map((p) => winnerText(p.key, p.winner, a, b)).filter((s): s is string => s != null);
  const ratedOk = (c: CityStats) => c.rated >= CITY_COMPARE_MIN;
  const yearsOk = (c: CityStats) => c.withYears >= YEARS_MIN;
  const rows: { label: string; a: string; b: string }[] = [
    { label: "Biura w katalogu", a: fmtInt(a.firms), b: fmtInt(b.firms) },
    { label: "Biura ze znaną datą rejestracji", a: fmtInt(a.withYears), b: fmtInt(b.withYears) },
    { label: "Wszystkie wpisy (z oddziałami firm z innych miast)", a: fmtInt(a.listings), b: fmtInt(b.listings) },
    {
      label: `Średnia ocena Google (biura od ${nOpinii(MIN_REVIEWS)})`,
      a: ratedOk(a) ? fmtRating(a.avgRating) : "za mało danych",
      b: ratedOk(b) ? fmtRating(b.avgRating) : "za mało danych",
    },
    { label: "Biura z oceną 4,8 i wyższą", a: ratedOk(a) ? fmtShare(a.share48) : "-", b: ratedOk(b) ? fmtShare(b.share48) : "-" },
    { label: "Opinie Google łącznie", a: fmtInt(a.reviews), b: fmtInt(b.reviews) },
    { label: "Mediana stażu", a: yearsOk(a) ? fmtYears(a.medianYears) : "-", b: yearsOk(b) ? fmtYears(b.medianYears) : "-" },
    { label: "Biura działające 10+ lat", a: yearsOk(a) ? fmtShare(a.share10y) : "-", b: yearsOk(b) ? fmtShare(b.share10y) : "-" },
    { label: "Biura z jawnym cennikiem", a: fmtShare(a.sharePrices), b: fmtShare(b.sharePrices) },
    { label: "Biura z ofertami na stronie", a: fmtShare(a.shareOffers), b: fmtShare(b.shareOffers) },
    {
      label: "Mediana prowizji za sprzedaż",
      a: a.commission != null ? `${fmtRate(a.commission)} (${nBiur(a.commissionN)})` : "za mało cenników",
      b: b.commission != null ? `${fmtRate(b.commission)} (${nBiur(b.commissionN)})` : "za mało cenników",
    },
  ];
  const [ea, eb] = await Promise.all([cityExtra(a), cityExtra(b)]);
  const seed = seedOf(pair);
  const faq = pairFaq(a, b, ea, eb);
  const advice = pairAdvice(a, b, ea, eb);
  const serviceLabels = [...new Set([...ea.services, ...eb.services].map((x) => x.label))];
  const others = found.all.filter((p) => p.slug !== pair && (p.a.slug === a.slug || p.b.slug === a.slug || p.a.slug === b.slug || p.b.slug === b.slug));
  const headline = titleOf(found.pair);
  const description = `Porównanie biur nieruchomości: ${a.name} i ${b.name}.`;
  return (
    <BlogArticle
      post={{ slug: `porownanie/${pair}`, h1: headline, description, published: PUBLISHED, modified: MODIFIED, category: "Porównania" }}
      path={blogPath(`porownanie/${pair}`)}
      related={false}
      extraLd={[faqLd(faq)]}
    >
      <ShortAnswer>{sentences.join(" ")}</ShortAnswer>

      <h2>
        {a.name} i {b.name}: porównanie
      </h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Wskaźnik</th>
              <th className="num">{a.name}</th>
              <th className="num">{b.name}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className="num">{r.a}</td>
                <td className="num">{r.b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="plain note">
        <li>
          Biura liczymy raz, w mieście głównego wpisu. Firmy z innych miast, które mają tu też wpis (oddział albo obsługa
          okolicy), liczymy tylko we „wszystkich wpisach”. Liczba biur to biura w naszym katalogu, a nie cały rynek.
        </li>
        <li>
          Średnią ocenę liczymy z biur mających co najmniej {nOpinii(MIN_REVIEWS)}, gdy takich biur jest w mieście co najmniej{" "}
          {CITY_COMPARE_MIN}.
        </li>
        <li>
          Mediana prowizji to mediana najniższych stawek za sprzedaż z cenników biur (jedna stawka na biuro), liczona, gdy{" "}
          {plural(PRICE_STAT_MIN, "podaje", "podają", "podaje")} je co najmniej {nBiur(PRICE_STAT_MIN)}.
        </li>
        <li>
          Staż liczymy od daty wpisu do KRS albo rejestracji jako podatnik VAT, gdy znamy ją dla co najmniej{" "}
          {nBiurGen(YEARS_MIN)} w mieście. To data rejestracji, nie zawsze faktyczny początek działalności.
        </li>
      </ul>

      <PairBars
        title={`${a.name} i ${b.name}: odsetek biur spełniających kryterium`}
        caption="Odsetki z tabeli wyżej. Przy zbyt małej próbie słupka nie pokazujemy (brak danych)."
        nameA={a.name}
        nameB={b.name}
        format={(v) => fmtShare(v)}
        rows={[
          { label: "Ocena Google 4,8+", a: ratedOk(a) ? a.share48 : null, b: ratedOk(b) ? b.share48 : null },
          { label: "10+ lat w rejestrze", a: yearsOk(a) ? a.share10y : null, b: yearsOk(b) ? b.share10y : null },
          { label: "Jawny cennik", a: a.sharePrices, b: b.sharePrices },
          { label: "Oferty na stronie", a: a.shareOffers, b: b.shareOffers },
        ]}
      />

      {[
        { c: a, e: ea },
        { c: b, e: eb },
      ].map(({ c, e }) => (
        <section key={c.slug}>
          <h2>Biura nieruchomości {inCity(c.name)}</h2>
          {e.editorial && <p>{e.editorial}</p>}
          {cityPortrait(c, e, seed).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
          {e.top.length > 0 && (
            <ol>
              {e.top.map((f) => (
                <li key={f.slug}>
                  <Link href={`/${f.citySlug}/${f.slug}`}>{f.name}</Link>: wynik {f.score}/100
                  {f.rating != null ? `, ocena Google ${fmtRating(f.rating)} (${fmtInt(f.reviews ?? 0)})` : ""}
                </li>
              ))}
            </ol>
          )}
          <p>
            <Link className="link-arrow" href={`/${c.slug}`}>
              Pełny ranking biur {inCity(c.name)}
            </Link>
          </p>
        </section>
      ))}

      <h2>Opinie klientów</h2>
      <p>{ratingsComparison(a, b, seed)}</p>

      <h2>Staż firm</h2>
      <p>{tenureComparison(a, b, seed)}</p>

      <h2>Usługi biur</h2>
      <p>{servicesComparison(a, b, ea, eb)}</p>
      {serviceLabels.length > 0 && (
        <PairBars
          title="Jakie usługi deklarują biura (odsetek wpisów w mieście)"
          caption="Na podstawie opisów usług na stronach biur. Biuro może świadczyć usługę, której nie opisuje."
          nameA={a.name}
          nameB={b.name}
          format={(v) => fmtShare(v)}
          rows={serviceLabels.map((label) => ({
            label,
            a: ea.services.find((x) => x.label === label)?.share ?? 0,
            b: eb.services.find((x) => x.label === label)?.share ?? 0,
          }))}
        />
      )}

      <h2>Prowizje i cenniki</h2>
      <p>
        {pricesComparison(a, b)} Jak policzyć prowizję w złotych, pokazujemy w kalkulatorze w artykule{" "}
        <Link href={blogPath("sprzedaz-mieszkania-z-biurem-czy-samemu")}>sprzedaż mieszkania z biurem czy samemu</Link>.
      </p>

      <h2>Które miasto lepiej pasuje do Twoich potrzeb</h2>
      <ul className="plain">
        {advice.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>

      <Faq items={faq} />

      <h2>Ranking biur w obu miastach</h2>
      <ul className="cards">
        {[a, b].map((c) => (
          <li key={c.slug}>
            <Link href={`/${c.slug}`}>
              <small>Ranking i lista biur</small>
              Biura nieruchomości {inCity(c.name)}
            </Link>
          </li>
        ))}
      </ul>

      {others.length > 0 && (
        <>
          <h2>Inne porównania</h2>
          <ul className="chips">
            {others.map((p) => (
              <li key={p.slug}>
                <Link href={blogPath(`porownanie/${p.slug}`)}>
                  {p.a.name} czy {p.b.name}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <p>
        Więcej miast w jednej tabeli:{" "}
        <Link href={blogPath("biura-nieruchomosci-w-najwiekszych-miastach")}>biura nieruchomości w największych miastach</Link>{" "}
        i <Link href={blogPath("oceny-biur-nieruchomosci-w-miastach")}>ranking miast według ocen</Link>.
      </p>
    </BlogArticle>
  );
}
