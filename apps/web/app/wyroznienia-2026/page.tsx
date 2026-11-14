import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd, PublicShell } from "@/components/SiteChrome";
import { AWARD, BADGE_HEIGHT, BADGE_WIDTH, pickCityLeaders } from "@/lib/awards";
import { listPublishedCards } from "@/lib/catalog";
import { inCity } from "@/lib/cities";
import { formatDate } from "@/lib/format";
import { nBiur } from "@/lib/plural";
import { CITY_RANKING_MIN } from "@/lib/ranking";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";

// Dane z bazy przy każdym wejściu (bez prerenderu w czasie budowania, kiedy baza jest niedostępna).
export const dynamic = "force-dynamic";

const citiesLabel = (n: number) => `${n} ${n === 1 ? "mieście" : "miastach"}`;

export async function generateMetadata(): Promise<Metadata> {
  const cards = await listPublishedCards().catch(() => []);
  const cities = pickCityLeaders(cards);
  return pageMetadata({
    title: `${AWARD.title}: najlepsze biura nieruchomości w ${citiesLabel(cities.length)}`,
    description: `Trzy najwyżej ocenione biura nieruchomości w każdym mieście, w którym oceniamy co najmniej ${CITY_RANKING_MIN} biur. Jawna metodologia, aktualizacja codziennie, wyróżnienia nie można kupić.`,
    path: AWARD.path,
    noindex: cities.length === 0,
  });
}

export default async function AwardsPage() {
  const cards = await listPublishedCards();
  const cities = pickCityLeaders(cards);
  const laureates = cities.reduce((n, c) => n + c.leaders.length, 0);
  const ranked = cities.reduce((n, c) => n + c.count, 0);
  const updated = new Date(Math.max(0, ...cards.map((c) => (c.publishedAt ? new Date(c.publishedAt).getTime() : 0))));
  const biggest = cities.slice(0, 3);
  const example = cities[0]?.leaders[0];

  return (
    <PublicShell>
      <p className="crumbs">
        <Link href="/">Strona główna</Link> / {AWARD.title}
      </p>
      <h1>{AWARD.title}: najlepsze biura nieruchomości w miastach</h1>
      <p>
        Wyróżniamy trzy najwyżej ocenione biura w każdym mieście, w którym ranking obejmuje co najmniej {CITY_RANKING_MIN}{" "}
        biur. W tej edycji to {nBiur(laureates)} w {citiesLabel(cities.length)}, wybranych spośród {ranked} ocenianych
        wpisów. Kolejność wynika z tej samej <Link href="/metodologia">jawnej metodologii</Link> co na stronach miast
        i zmienia się razem z danymi. Wyróżnienia nie można kupić ani o nie zabiegać. Dane zaktualizowaliśmy{" "}
        {formatDate(updated)}.
      </p>

      {biggest.length > 0 && (
        <div className="answer">
          <strong>W skrócie</strong>
          <p>
            W największych miastach na pierwszym miejscu są:{" "}
            {biggest.map((c, i) => (
              <span key={c.citySlug}>
                {i > 0 && (i === biggest.length - 1 ? " i " : ", ")}
                <Link href={`/${c.citySlug}/${c.leaders[0].slug}`}>{c.leaders[0].name}</Link> {inCity(c.cityName)} (
                {c.leaders[0].score}/100)
              </span>
            ))}
            .
          </p>
        </div>
      )}

      <h2>Wyróżnione biura w miastach</h2>
      <div className="tablewrap">
        <table className="awards-table">
          <thead>
            <tr>
              <th>Miasto</th>
              <th>1. miejsce</th>
              <th>2. miejsce</th>
              <th>3. miejsce</th>
            </tr>
          </thead>
          <tbody>
            {cities.map((c) => (
              <tr key={c.citySlug}>
                <td>
                  <Link href={`/${c.citySlug}`}>{c.cityName}</Link>
                  <span className="awards-count">{nBiur(c.count)} w rankingu</span>
                </td>
                {[1, 2, 3].map((place) => {
                  const f = c.leaders.find((l) => l.position === place);
                  return (
                    <td key={place}>
                      {f ? (
                        <>
                          <Link href={`/${c.citySlug}/${f.slug}`}>{f.name}</Link>
                          <span className="awards-count">{f.score}/100</span>
                        </>
                      ) : (
                        <span className="awards-count">brak profilu</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Jak wybieramy</h2>
      <ul>
        <li>
          Liczy się wynik według <Link href="/metodologia">metodologii katalogu</Link>: potwierdzenie w rejestrze, staż,
          jawność cennika, spójność danych, zakres usług, opinie w Google i aktualne oferty.
        </li>
        <li>Wyróżniamy pierwszą trójkę w mieście, ale tylko tam, gdzie oceniamy co najmniej {CITY_RANKING_MIN} biur.</li>
        <li>Kolejność aktualizujemy codziennie, razem z rankingiem. Płatność nie wpływa na wynik.</li>
      </ul>

      <h2>Odznaka dla wyróżnionych biur</h2>
      <p>
        Każde wyróżnione biuro może pobrać odznakę na swoją stronę: w profilu biura jest przycisk „Pobierz odznakę” z
        gotowym kodem do wklejenia. Odznaka pokazuje aktualne miejsce i prowadzi do profilu biura z pełnym wynikiem. Gdy
        biuro wypadnie z pierwszej trójki, odznaka sama zmieni się na neutralną, bez informacji o miejscu.
      </p>
      {example && (
        <p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/odznaka/${example.listingId}.svg`} width={BADGE_WIDTH} height={BADGE_HEIGHT} alt={`Przykładowa odznaka: ${example.name}`} />
        </p>
      )}

      <h2>Dla mediów</h2>
      <p>
        Zestawienie i dane z katalogu można cytować z podaniem źródła: Ranking Biur Nieruchomości
        (rankingbiurnieruchomosci.pl). Jak liczymy wyniki, opisujemy w <Link href="/metodologia">metodologii</Link>, a
        zestawienie stawek w raporcie <Link href="/raporty/prowizje-biur-nieruchomosci-2026">Prowizje biur 2026</Link>.
        Pytania: <Link href="/kontakt">kontakt</Link>.
      </p>

      <JsonLd
        data={breadcrumbLd([
          { name: "Strona główna", path: "/" },
          { name: AWARD.title, path: AWARD.path },
        ])}
      />
    </PublicShell>
  );
}
