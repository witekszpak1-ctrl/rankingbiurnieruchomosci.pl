import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FirmProfile, rankingInput } from "@/components/FirmProfile";
import { getPublishedListing } from "@/lib/catalog";
import { isShownOnFirmPage } from "@/lib/prices";
import { firmMeta } from "@/lib/meta-texts";
import { getPremium } from "@/lib/premium";
import { pageMetadata } from "@/lib/seo";
import { scoreListing } from "@/lib/ranking";

export const revalidate = 300;

// Pusta lista: żaden profil nie powstaje przy budowaniu, każdy renderuje się przy pierwszym wejściu i trafia do
// pamięci podręcznej na `revalidate` sekund (ISR). Bez tego Next.js renderował profil przy każdym wejściu,
// także każdego bota, i baza pracowała bez przerwy.
export async function generateStaticParams(): Promise<{ city: string; firm: string }[]> {
  return [];
}

// Uwaga: ta strona nie czyta searchParams, headers() ani cookies(), żeby zostać stroną ISR (pamięć podręczna 300 s).
// Podgląd szkicu Premium to osobna trasa dynamiczna /podglad/[token].
type Props = { params: Promise<{ city: string; firm: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, firm } = await params;
  const listing = await getPublishedListing(city, firm);
  if (!listing) return { title: "Nie znaleziono", robots: { index: false } };
  const { score } = scoreListing(rankingInput(listing));
  const meta = firmMeta({
    name: listing.name,
    cityName: listing.cityName,
    score,
    hasGoogle: Boolean(listing.googleRating && listing.googleCount),
    hasPrices: listing.prices.some(isShownOnFirmPage),
    offers: listing.offersCount,
  });
  return pageMetadata({
    ...meta,
    // Firma w kilku miastach: kanoniczny jest pierwszy (główny) wpis, żeby ten sam profil nie był duplikatem.
    path: listing.cities[0]?.path ?? `/${listing.citySlug}/${listing.slug}`,
    image: listing.coverUrl ?? listing.logoUrl,
    type: "profile",
  });
}


export default async function FirmPage({ params }: Props) {
  const { city, firm } = await params;
  const listing = await getPublishedListing(city, firm);
  if (!listing) notFound();
  const premium = await getPremium(listing.listingId, "published");
  return <FirmProfile listing={listing} premium={premium} />;
}
