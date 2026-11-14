"use client";

import { useRouter } from "next/navigation";

/**
 * Wybór miasta na liście ofert: po zmianie od razu przechodzi do ofert biur z tego miasta.
 * Bez JavaScriptu działa zwykły formularz z przyciskiem obok (ta sama nazwa pola "miasto").
 */
export function OfferCitySelect({
  cities,
  value,
}: {
  cities: { slug: string; name: string; n: number }[];
  value: string;
}) {
  const router = useRouter();
  return (
    <select
      id="miasto"
      name="miasto"
      defaultValue={value}
      onChange={(e) => router.push(e.target.value ? `/oferty?miasto=${encodeURIComponent(e.target.value)}` : "/oferty")}
    >
      <option value="">Wszystkie miasta</option>
      {cities.map((c) => (
        <option key={c.slug} value={c.slug}>
          {c.name} ({c.n})
        </option>
      ))}
    </select>
  );
}
