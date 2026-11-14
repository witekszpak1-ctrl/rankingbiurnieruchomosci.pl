import type { Metadata } from "next";
import Link from "next/link";

import { FirmImage } from "@/components/FirmImage";
import { PublicShell } from "@/components/SiteChrome";
import { compareCards, type CompareCard } from "@/lib/catalog";
import { formatYear } from "@/lib/format";
import { nOfert, nOpinii } from "@/lib/plural";
import { scoreListing } from "@/lib/ranking";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Porównanie biur nieruchomości",
  description: "Porównaj wybrane biura nieruchomości: wynik w rankingu, prowizja, ocena w Google, staż, usługi i oferty.",
  path: "/porownaj",
  noindex: true,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = { searchParams: Promise<{ biura?: string }> };

function score(c: CompareCard): number {
  return scoreListing({
    startDate: c.startDate,
    hasPublicPrices: c.hasPublicPrices,
    verificationScore: c.verificationScore,
    registryConfirmed: c.registryConfirmed,
    servicesCount: c.servicesCount,
    offersCount: c.offersCount,
    googleRating: c.googleRating,
    googleCount: c.googleCount,
  }).score;
}

export default async function ComparePage({ searchParams }: Props) {
  const { biura } = await searchParams;
  const ids = [...new Set((biura ?? "").split(",").map((x) => x.trim()).filter((x) => UUID.test(x)))].slice(0, 3);
  const found = await compareCards(ids).catch(() => []);
  const cards = ids.map((id) => found.find((c) => c.listingId === id)).filter((c): c is CompareCard => Boolean(c));

  const rows: { label: string; value: (c: CompareCard) => React.ReactNode }[] = [
    { label: "Miasto", value: (c) => c.cityName },
    { label: "Wynik w rankingu", value: (c) => `${score(c)}/100` },
    {
      label: "Prowizja od sprzedaży",
      value: (c) => (c.saleCommission != null ? `od ${c.saleCommission.toLocaleString("pl-PL")}%` : "brak na stronie"),
    },
    {
      label: "Ocena w Google",
      value: (c) =>
        c.googleRating ? `${c.googleRating.toFixed(1).replace(".", ",")} (${nOpinii(c.googleCount ?? 0)})` : "brak profilu",
    },
    { label: "W rejestrze od", value: (c) => (c.registryConfirmed ? formatYear(c.startDate) : "bez potwierdzenia") },
    { label: "Usługi", value: (c) => (c.services.length > 0 ? c.services.slice(0, 8).join(", ") : "nie podaje") },
    { label: "Aktualne oferty", value: (c) => nOfert(c.offersCount) },
  ];

  return (
    <PublicShell>
      <h1>Porównanie biur nieruchomości</h1>
      {cards.length < 2 ? (
        <p>
          Wybierz co najmniej dwa biura do porównania. Na stronie miasta zaznacz pole „Porównaj” przy biurach (najwyżej
          trzy), a potem kliknij „Porównaj wybrane”. <Link href="/miasta">Lista miast</Link>.
        </p>
      ) : (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>
                  <span className="sr-only">Parametr</span>
                </th>
                {cards.map((c) => (
                  <th key={c.listingId}>
                    <Link href={`/${c.citySlug}/${c.slug}`} className="firm-cell">
                      <FirmImage src={c.logoUrl} kind="logo" name={c.name} alt={`Logo ${c.name}`} size="sm" />
                      <span>{c.name}</span>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  {cards.map((c) => (
                    <td key={c.listingId}>{r.value(c)}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row">
                  <span className="sr-only">Kontakt</span>
                </th>
                {cards.map((c) => (
                  <td key={c.listingId}>
                    <Link className="compare-go" href={`/${c.citySlug}/${c.slug}#zapytanie`}>
                      Zapytaj bezpłatnie
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="note">
        Wynik liczymy według <Link href="/metodologia">metodologii</Link>. Prowizja to najniższa stawka procentowa za
        sprzedaż, którą biuro podaje na swojej stronie.
      </p>
    </PublicShell>
  );
}
