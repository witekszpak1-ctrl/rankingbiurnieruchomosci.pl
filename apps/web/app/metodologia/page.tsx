import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd, PublicShell } from "@/components/SiteChrome";
import { listCityListings, type ListingCard } from "@/lib/catalog";
import { absoluteUrl, formatDate, SITE_NAME } from "@/lib/format";
import { operatorJsonLd } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo";
import {
  CITY_RANKING_MIN,
  METHODOLOGY,
  PARAMETERS,
  PRICE_STAT_MIN,
  rankListings,
  type RankingInput,
  weightShare,
} from "@/lib/ranking";

// Przykład wyliczenia korzysta z aktualnych danych, odświeżany raz na dobę.
export const revalidate = 86400;

export const metadata: Metadata = pageMetadata({
  title: "Metodologia rankingu biur nieruchomości | Jak oceniamy",
  description:
    "Jak powstaje ranking biur nieruchomości: źródła danych (KRS, wykaz VAT, strony biur), parametry i wagi, potwierdzenie w rejestrze i zasady liczenia prowizji.",
  path: "/metodologia",
});

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

const pts = (n: number) => n.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Przykład: pierwsze biuro rankingu Warszawy (albo Krakowa), z podziałem wyniku na parametry. */
async function example() {
  for (const [slug, cityName] of [["warszawa", "Warszawie"], ["krakow", "Krakowie"]] as const) {
    const listings = await listCityListings(slug).catch(() => []);
    if (listings.length >= CITY_RANKING_MIN) {
      const top = rankListings(listings, toInput)[0];
      return { top, slug, cityName };
    }
  }
  return null;
}

export default async function MethodologyPage() {
  const ex = await example();
  const exIncluded = ex ? ex.top.breakdown.reduce((sum, b) => sum + weightShare(b.weight), 0) : 0;
  const exPoints = ex ? ex.top.breakdown.reduce((sum, b) => sum + b.value * weightShare(b.weight), 0) : 0;
  return (
    <PublicShell>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Metodologia rankingu biur nieruchomości",
          url: absoluteUrl("/metodologia"),
          datePublished: METHODOLOGY.published,
          dateModified: METHODOLOGY.modified,
          version: METHODOLOGY.version,
          inLanguage: "pl",
          publisher: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/"), parentOrganization: operatorJsonLd() },
        }}
      />
      <h1>Metodologia rankingu</h1>
      <p className="note">
        Wersja {METHODOLOGY.version}, opublikowana {formatDate(new Date(METHODOLOGY.published))}, ostatnia zmiana{" "}
        {formatDate(new Date(METHODOLOGY.modified))}. <a href="#historia">Historia zmian</a>.
      </p>
      <div className="answer">
        <strong>W skrócie</strong>
        <p>
          Do katalogu trafiają biura nieruchomości z własną stroną internetową. Biura, których NIP ze strony zgadza się
          z rejestrem publicznym, oznaczamy jako potwierdzone. Biura bez takiego potwierdzenia (najczęściej brak NIP na
          stronie) też publikujemy, ale z wyraźnym oznaczeniem i niżej w rankingu. Wynik liczymy z mierzalnych parametrów
          ze strony firmy, rejestrów i Map Google. Płatność nie wpływa na pozycję.
        </p>
      </div>

      <h2>Skąd bierzemy dane</h2>
      <ul className="plain">
        <li>Rejestry publiczne: KRS (Ministerstwo Sprawiedliwości) i wykaz podatników VAT (Ministerstwo Finansów).</li>
        <li>Oficjalna strona internetowa firmy: dane kontaktowe, zakres usług, cennik, aktualne oferty.</li>
        <li>Mapy Google: średnia ocena, liczba opinii i opinie klientów, jeśli biuro ma tam profil.</li>
      </ul>
      <p>
        Opinie klientów pokazujemy tak, jak publikuje je Google: bez zmian, z podpisem źródła i linkiem do profilu
        biura w Mapach Google. Sami nie piszemy opinii i nie oceniamy obsługi biur. Opisy firm powstają z faktów zapisanych
        ze źródeł, a każdy fakt ma adres źródła i datę pobrania.
      </p>

      <h2>Weryfikacja wpisu</h2>
      <ol>
        <li>Znajdujemy kandydata na oficjalną stronę i odrzucamy katalogi, portale ogłoszeniowe, artykuły i strony niezwiązane z branżą.</li>
        <li>Odczytujemy z niej NIP i sprawdzamy go w rejestrach (suma kontrolna, status podmiotu, nazwa, adres).</li>
        <li>
          Gdy NIP ze strony zgadza się z rejestrem, biuro jest oznaczone jako potwierdzone w rejestrze. Firmy wykreślone
          lub nieaktywne w rejestrze odrzucamy.
        </li>
        <li>
          Gdy strona nie podaje NIP albo dane nie zgadzają się z rejestrem, biuro publikujemy z oznaczeniem „bez
          potwierdzenia w rejestrze”. Nie dostaje wtedy punktów za potwierdzenie w rejestrze ani za staż, a jego opis
          opiera się wyłącznie na stronie biura.
        </li>
        <li>Każdy wpis ma opis napisany od nowa z faktów ze strony biura, sprawdzony automatycznie (cytaty, źródła, brak kopiowania).</li>
      </ol>

      <h2>Parametry rankingu</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Parametr</th>
              <th>Co oceniamy</th>
              <th className="num">Punkty na 100</th>
              <th>Gdy brak danych</th>
            </tr>
          </thead>
          <tbody>
            {PARAMETERS.map((p) => (
              <tr key={p.key}>
                <td>{p.label}</td>
                <td>{p.description}</td>
                <td className="num">{pts(weightShare(p.weight))}</td>
                <td>{p.whenMissing}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Każdy parametr ma wartość od 0 do 100% i daje część z podanych punktów. Rozróżniamy dwie sytuacje. Gdy coś
        sprawdziliśmy i biuro tego nie spełnia (np. strona nie podaje cen), parametr daje 0 punktów. Gdy nie mamy z czego
        go policzyć (np. brak daty wpisu do rejestru albo profilu w Google), pomijamy go, a punkty pozostałych parametrów
        przeliczamy proporcjonalnie do 100. Planujemy dodać kolejne parametry (m.in. skalę działalności, potwierdzone
        ubezpieczenie OC). Każda zmiana wag lub parametrów jest opisana niżej z datą.
      </p>

      {ex && (
        <>
          <h2 id="przyklad">Przykład wyliczenia</h2>
          <p>
            Pierwsze biuro rankingu w {ex.cityName}:{" "}
            <Link href={`/${ex.slug}/${ex.top.slug}`}>{ex.top.name}</Link>, wynik {ex.top.score}/100 (dane z{" "}
            {formatDate(new Date())}).
          </p>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Parametr</th>
                  <th className="num">Wartość</th>
                  <th className="num">Punkty na 100</th>
                  <th className="num">Zdobyte punkty</th>
                </tr>
              </thead>
              <tbody>
                {PARAMETERS.map((p) => {
                  const item = ex.top.breakdown.find((b) => b.key === p.key);
                  return (
                    <tr key={p.key}>
                      <td>{p.label}</td>
                      <td className="num">{item ? `${Math.round(item.value * 100)}%` : "brak danych"}</td>
                      <td className="num">{item ? pts(weightShare(p.weight)) : "pominięty"}</td>
                      <td className="num">{item ? pts(item.value * weightShare(p.weight)) : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p>
            Uwzględnione parametry dają razem {pts(exIncluded)} z 100 możliwych punktów, a biuro zdobyło {pts(exPoints)}.
            Wynik: {pts(exPoints)} / {pts(exIncluded)} x 100 = {ex.top.score} (po zaokrągleniu).
          </p>
        </>
      )}

      <h2>Oferty nieruchomości</h2>
      <p>
        Oferty widoczne na stronie biura pobieramy zwykle co 1-2 dni, najwyżej 20 najnowszych. Liczba na profilu to liczba ofert
        pobranych przez robota, a nie całkowita liczba ofert biura; przy pełnej próbce piszemy „co najmniej 20”.
        Lokalizacja nieruchomości wynika z treści ogłoszenia, a nie z adresu biura.
      </p>

      <h2>Kiedy publikujemy ranking</h2>
      <p>
        Ranking z pozycjami pokazujemy, gdy w mieście jest co najmniej {CITY_RANKING_MIN} biur w katalogu. Dla
        mniejszej liczby publikujemy listę w kolejności alfabetycznej, bo pozycje przy trzech firmach niewiele mówią.
      </p>

      <h2>Ceny i statystyki</h2>
      <p>
        Ceny to wartości deklarowane przez firmy na ich stronach, zapisane z cytatem i datą. Mogły się zmienić po
        dacie pobrania. Medianę prowizji od sprzedaży liczymy tylko ze stawek procentowych za sprzedaż lub kupno (bez opłat
        za najem i zarządzanie najmem), po jednej stawce na biuro, i pomijamy wartości spoza przedziału 0,5-10%, które
        zwykle są błędnym odczytem. Statystyki miasta publikujemy, gdy mamy co najmniej {PRICE_STAT_MIN} takie stawki, i
        zawsze podajemy liczbę biur, na których się opierają. Tryb VAT (netto, brutto, + VAT) pokazujemy tak, jak podaje
        go biuro.
      </p>

      <h2>Niezależność i reklama</h2>
      <p>
        Pozycja w rankingu nie zależy od płatności. Treści sponsorowane będą wyraźnie oznaczone i oddzielone od rankingu.
        Szczegóły: <Link href="/reklama">Reklama i niezależność</Link>.
      </p>

      <h2 id="historia">Historia zmian</h2>
      <ul className="plain">
        {METHODOLOGY.changes.map((c) => (
          <li key={c.version}>
            <b>
              Wersja {c.version}, {formatDate(new Date(c.date))}:
            </b>{" "}
            {c.text}
          </li>
        ))}
      </ul>

      <h2>Błąd w danych?</h2>
      <p>
        Jeśli widzisz nieprawidłowe dane albo chcesz usunięcia wpisu, zobacz <Link href="/dla-firm">stronę dla firm</Link>.
      </p>
    </PublicShell>
  );
}
