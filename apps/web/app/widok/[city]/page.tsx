import type { Metadata } from "next";

import { CityView, cityMetadata } from "@/components/CityView";
import { parseView, type SearchParams } from "@/lib/city-view";

/**
 * Widoki strony miasta z parametrami: ?cel=, ?filtr=, ?strona=. Adresy /<miasto>?cel=... są przepisywane tutaj w
 * next.config.mjs (rewrites, tylko gdy w adresie jest któryś z tych parametrów), więc strona /<miasto> bez
 * parametrów zostaje ISR (app/[city]/page.tsx), a ta trasa jest dynamiczna i czyta searchParams.
 * Canonical i noindex tych widoków ustala cityMetadata (filtry: noindex i canonical na miasto; kolejne strony: własny
 * canonical). Bezpośrednie wejście na /widok/<miasto> daje canonical na adres miasta.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ city: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { city } = await params;
  return cityMetadata(city, parseView(await searchParams));
}

export default async function CityViewPage({ params, searchParams }: Props) {
  const { city } = await params;
  return <CityView slug={city} view={parseView(await searchParams)} />;
}
