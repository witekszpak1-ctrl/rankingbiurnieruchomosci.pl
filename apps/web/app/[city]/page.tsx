import type { Metadata } from "next";

import { CityView, cityMetadata } from "@/components/CityView";
import { DEFAULT_VIEW } from "@/lib/city-view";

// Strona miasta w widoku domyślnym (strona 1, bez filtrów) jest ISR: pamięć podręczna 300 s, bez czytania parametrów
// żądania (searchParams, headers, cookies), więc boty nie obciążają bazy przy każdym wejściu. Adresy z filtrami
// i numerem strony (?cel=, ?filtr=, ?strona=) obsługuje trasa dynamiczna /widok/[city] przez przepisanie adresu
// w next.config.mjs (adres w przeglądarce i dla robotów się nie zmienia).
export const revalidate = 300;

// Pusta lista: żadna strona miasta nie powstaje przy budowaniu, każda renderuje się przy pierwszym wejściu
// i trafia do pamięci podręcznej (jak profile firm).
export async function generateStaticParams(): Promise<{ city: string }[]> {
  return [];
}

type Props = { params: Promise<{ city: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  return cityMetadata(city, DEFAULT_VIEW);
}

export default async function CityPage({ params }: Props) {
  const { city } = await params;
  return <CityView slug={city} view={DEFAULT_VIEW} />;
}
