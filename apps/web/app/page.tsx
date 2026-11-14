import type { Metadata } from "next";
import Link from "next/link";

import { FirmImage } from "@/components/FirmImage";
import { OfferTile } from "@/components/OfferTile";
import { JsonLd, LogoMark, PublicShell } from "@/components/SiteChrome";
import { ProfileShowcase } from "@/components/ProfileShowcase";
import { Stars } from "@/components/Stars";
import { homeStats, listAllPublished, listCities, listLatestOffers, type TopListing } from "@/lib/catalog";
import { absoluteUrl, SITE_NAME } from "@/lib/format";
import { homeMeta } from "@/lib/meta-texts";
import { inCity } from "@/lib/cities";
import { ORG_ID, organizationLd, pageMetadata, SITE_ID } from "@/lib/seo";
import { nBiur, nMiast, nOfert, offersLabel, plural } from "@/lib/plural";
import { rankListings, type RankingInput } from "@/lib/ranking";
import { GOALS, type Goal } from "@/lib/city-view";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const stats = await homeStats().catch(() => ({ firms: 0, cities: 0, offers: 0, withPrices: 0 }));
  return pageMetadata({ ...homeMeta(new Date().getFullYear(), stats.firms, stats.cities), path: "/" });
}

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

// Na stronie głównej największe miasta, pełna lista na /miasta.
const HOME_CITIES = 30;

const toInput = (l: TopListing): RankingInput => ({
  startDate: l.startDate,
  hasPublicPrices: l.hasPublicPrices,
  verificationScore: l.verificationScore,
  registryConfirmed: l.registryConfirmed,
  servicesCount: l.servicesCount,
  offersCount: l.offersCount,
  googleRating: l.googleRating,
  googleCount: l.googleCount,
});

const STEPS = [
  {
    title: "Wybierz miasto",
    text: "Wpisz miejscowość i zobacz wszystkie biura nieruchomości, które sprawdziliśmy w tej okolicy.",
  },
  {
    title: "Porównaj biura",
    text: "Ranking pokazuje staż w rejestrze, jawność cennika, zakres usług i liczbę aktualnych ofert.",
  },
  {
    title: "Napisz do biura",
    text: "Zadaj pytanie przez formularz na stronie biura. Przekażemy je bezpłatnie i bez zobowiązań.",
  },
];

const FAQ = [
  {
    q: "Skąd pochodzą dane o biurach?",
    a: "Z rejestrów publicznych (KRS, wykaz podatników VAT) i z oficjalnych stron internetowych biur. Biura potwierdzone w rejestrze mają to oznaczone na profilu; biura bez potwierdzenia też są w katalogu, ale niżej w rankingu.",
  },
  {
    q: "Czy biura płacą za miejsce w rankingu?",
    a: "Nie. Pozycja wynika wyłącznie z jawnej metodologii. Płatność nie ma wpływu na wynik ani na kolejność.",
  },
  {
    q: "Jak często dane są aktualizowane?",
    a: "Oferty, kontakt i obrazki sprawdzamy codziennie. Dane z rejestrów i opisy odświeżamy regularnie, a każda strona biura ma datę aktualizacji.",
  },
  {
    q: "Moje biuro ma błędne dane. Co zrobić?",
    a: "Wypełnij formularz na stronie Dla biur. Poprawimy dane albo usuniemy wpis.",
  },
];

export default async function HomePage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const missing = typeof sp.brak === "string" ? sp.brak : null;
  const [cities, stats, all, offers] = await Promise.all([
    listCities(),
    homeStats(),
    listAllPublished(),
    listLatestOffers(6),
  ]);
  const top = rankListings(all, toInput).slice(0, 6);

  return (
    <PublicShell wide>
      <div className="hero-wrap">
      <section className="hero-dark">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <span className="kicker">Dane z KRS i wykazu VAT · {nBiur(stats.firms)} w katalogu</span>
            <h1>
              Ranking biur nieruchomości{" "}
              <span className="swash">
                w Polsce {new Date().getFullYear()}
                <svg viewBox="0 0 300 30" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M4 20 C 70 6, 150 4, 296 14" />
                </svg>
              </span>
            </h1>
            <p className="hero-sub">
              Wybierz biuro nieruchomości <em>sprawdzone w rejestrach</em>
            </p>
            <p className="hero-lead">
              Porównaj biura w swoim mieście według stażu, jawnych prowizji i liczby aktualnych ofert. Potem napisz do
              wybranego biura jednym formularzem.
            </p>
            <ul className="checks-row">
              <li>Bezpłatnie</li>
              <li>Bez zobowiązań</li>
              <li>Bez płatnych pozycji</li>
            </ul>
          </div>
          <ProfileShowcase
            firms={top.slice(0, 3).map((f) => ({
              key: f.listingId,
              href: `/${f.citySlug}/${f.slug}`,
              name: f.name,
              host: f.host,
              cityName: f.cityName,
              score: f.score,
              googleRating: f.googleRating,
              googleCount: f.googleCount,
              offersCount: f.offersCount,
              sinceYear: f.registryConfirmed && f.startDate ? new Date(f.startDate).getFullYear() : null,
              registryConfirmed: f.registryConfirmed,
              hasPublicPrices: f.hasPublicPrices,
              servicesCount: f.servicesCount,
              logoUrl: f.logoUrl,
              coverUrl: f.coverUrl ?? (f.imageKind === "og" ? f.imageUrl : null),
            }))}
          />
        </div>
      </section>

      <section className="search-band" id="szukaj">
        <div className="wrap">
          <form className="search-bar" action="/szukaj" method="get" data-track="Search">
            <div className="search-field">
              <label htmlFor="miasto">Miasto</label>
              <input id="miasto" name="miasto" list="lista-miast" placeholder="Wpisz miasto, np. Wrocław" autoComplete="off" required />
              <datalist id="lista-miast">
                {cities.map((c) => (
                  <option key={c.slug} value={c.name} />
                ))}
              </datalist>
            </div>
            <div className="search-field">
              <label htmlFor="cel">Czego potrzebujesz</label>
              <select id="cel" name="cel" defaultValue="">
                <option value="">Wszystkie biura</option>
                {(Object.keys(GOALS) as Goal[]).map((g) => (
                  <option key={g} value={g}>
                    {GOALS[g].label}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit">
              Pokaż biura <span aria-hidden="true">→</span>
            </button>
          </form>
          {missing && (
            <p className="search-miss">
              Nie mamy jeszcze biur w mieście „{missing}”. Wybierz jedno z miast poniżej, katalog stale się powiększa.
            </p>
          )}
          <nav className="search-links" aria-label="Na skróty">
            <Link href="/oferty">Aktualne oferty biur</Link>
            <Link href="/ranking">Ranking ogólnopolski</Link>
            <Link href="/miasta">Wszystkie miasta</Link>
            <Link href="/metodologia">Jak oceniamy</Link>
          </nav>
        </div>
      </section>

      </div>

      <section className="stats-row" aria-label="Katalog w liczbach">
        <div className="wrap">
          <div>
            <b>{stats.firms.toLocaleString("pl-PL")}</b>
            <span>{plural(stats.firms, "biuro", "biura", "biur")} nieruchomości w katalogu</span>
          </div>
          <div>
            <b>{stats.cities.toLocaleString("pl-PL")}</b>
            <span>{plural(stats.cities, "miasto", "miasta", "miast")}, a co dzień kolejne</span>
          </div>
          <div>
            <b>{stats.offers.toLocaleString("pl-PL")}</b>
            <span>{plural(stats.offers, "aktualna oferta", "aktualne oferty", "aktualnych ofert")} ze stron biur</span>
          </div>
          <div>
            <b>0 zł</b>
            <span>za wyszukiwanie. Płatność nie wpływa na pozycję w rankingu</span>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow">Jak to działa</span>
            <h2>Dobre biuro w trzech krokach</h2>
          </div>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="step-num">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {top.length > 0 && (
        <section id="ranking" className="section">
          <div className="wrap">
            <div className="section-head">
              <div>
                <span className="eyebrow">Ranking</span>
                <h2>Najwyżej ocenione biura</h2>
              </div>
              <Link className="link-arrow" href="/metodologia">
                Jak liczymy wynik
              </Link>
            </div>
            <div className="agency-grid">
              {top.map((f) => (
                <Link key={f.listingId} href={`/${f.citySlug}/${f.slug}`} className="agency-card">
                  <FirmImage src={f.coverUrl ?? f.logoUrl} kind={f.coverUrl ? "og" : "logo"} name={f.name} size="lg" />
                  <div className="agency-body">
                    <div className="agency-top">
                      <span className="pos">#{f.position}</span>
                      <span className="score">
                        <b>{f.score}</b>/100
                      </span>
                    </div>
                    <h3>{f.name}</h3>
                    <p className="agency-city">{f.cityName}</p>
                    {f.googleRating && f.googleCount ? (
                      <div className="agency-rating">
                        <Stars value={f.googleRating} size={14} /> {f.googleRating.toFixed(1)} ({f.googleCount})
                      </div>
                    ) : null}
                    <div className="agency-tags">
                      {f.offersCount > 0 && <span className="tag">{offersLabel(f.offersCount)}</span>}
                      {f.hasPublicPrices && <span className="tag ok">jawny cennik</span>}
                      {f.servicesCount > 0 && <span className="tag">{f.servicesCount} usług</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {offers.length > 0 && (
        <section id="oferty" className="section soft">
          <div className="wrap">
            <div className="section-head">
              <div>
                <span className="eyebrow">Świeże ogłoszenia</span>
                <h2>Aktualne oferty z biur w katalogu</h2>
              </div>
            </div>
            <ul className="offer-tiles">
              {offers.map((o) => (
                <OfferTile key={o.url} offer={o} />
              ))}
            </ul>
          </div>
        </section>
      )}

      <section id="miasta" className="section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">Miasta</span>
              <h2>Biura nieruchomości w Twojej okolicy</h2>
            </div>
          </div>
          {cities.length === 0 ? (
            <p className="note">Katalog jest w budowie.</p>
          ) : (
            <>
              <ul className="city-grid">
                {cities.slice(0, HOME_CITIES).map((c) => (
                  <li key={c.slug}>
                    <Link href={`/${c.slug}`} title={`Biura nieruchomości ${inCity(c.name)}`}>
                      <b>{c.name}</b>
                      <span>{nBiur(c.listings)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {cities.length > HOME_CITIES && (
                <p>
                  <Link href="/miasta">Wszystkie miasta ({cities.length}) według województw</Link>
                </p>
              )}
            </>
          )}
        </div>
      </section>

      <section className="section soft">
        <div className="wrap why">
          <div>
            <span className="eyebrow">Dlaczego nam zaufać</span>
            <h2>Sprawdzamy, zanim pokażemy</h2>
            <p className="why-lead">
              Do katalogu trafiają tylko biura, których stronę i dane potwierdziliśmy w rejestrach publicznych.
            </p>
          </div>
          <ul className="why-list">
            <li>
              <b>Dane z rejestrów</b>
              <span>NIP, nazwa i adres zgodne z KRS lub wykazem VAT.</span>
            </li>
            <li>
              <b>Jawna metodologia</b>
              <span>Każdy punkt w rankingu ma opisane źródło i wagę.</span>
            </li>
            <li>
              <b>Bez płatnych pozycji</b>
              <span>Kolejność nie zależy od pieniędzy.</span>
            </li>
            <li>
              <b>Codzienna aktualizacja</b>
              <span>Oferty i kontakt sprawdzamy każdego dnia.</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="section">
        <div className="wrap faq-wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">Pytania</span>
              <h2>Najczęstsze pytania</h2>
            </div>
          </div>
          <div className="faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap cta-dark">
          <div>
            <h2>Prowadzisz biuro nieruchomości?</h2>
            <p>Sprawdź swój wpis, popraw dane albo zgłoś biuro, którego jeszcze nie ma w katalogu.</p>
          </div>
          <Link className="btn-green" href="/dla-firm">
            Przejdź do strony dla biur
          </Link>
          <p className="cta-meta">
            {nBiur(stats.firms)} w katalogu · {nMiast(stats.cities)} · {nOfert(stats.offers)} ze stron biur
          </p>
        </div>
      </section>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          "@id": SITE_ID,
          name: SITE_NAME,
          url: absoluteUrl("/"),
          inLanguage: "pl-PL",
          publisher: { "@id": ORG_ID },
          potentialAction: {
            "@type": "SearchAction",
            target: `${absoluteUrl("/szukaj")}?miasto={miasto}`,
            "query-input": "required name=miasto",
          },
        }}
      />
      <JsonLd
        data={{ "@context": "https://schema.org", ...organizationLd() }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }}
      />
    </PublicShell>
  );
}
