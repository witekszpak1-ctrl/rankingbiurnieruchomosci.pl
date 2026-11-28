import { unstable_cache } from "next/cache";

import { AUDIT_INDUSTRY, MEASUREMENT_WINDOW_DAYS, loadCityMeasurements } from "./audit-repo";
import { query } from "./db";
import { buildExample, type LandingExample, type LandingStats } from "./landing";

/**
 * Dane strony głównej: liczby z biblioteki pomiarów i przykład jednego miasta. Tylko odczyt, bez zapytań do
 * dostawców AI. Gdy baza jest niedostępna, zwraca null i strona pokazuje neutralną ilustrację bez liczb.
 */

export type LandingData = { stats: LandingStats; example: LandingExample | null };

async function load(): Promise<LandingData> {
  const [s] = await query<LandingStats>(
    `select (select count(*) from geo.measurements where status = 'done')::int as answers,
            (select count(distinct lower(p.city)) from geo.measurements m join geo.prompts p on p.id = m.prompt_id
              where m.status = 'done' and p.city is not null)::int as cities,
            (select count(distinct brand_id) from geo.mentions where brand_id is not null)::int as companies,
            (select count(distinct platform) from geo.measurements where status = 'done')::int as platforms`,
  );
  // Miasto z największą liczbą gotowych pomiarów w oknie audytu (te same pomiary, które widzi audyt).
  const cities = await query<{ name: string; slug: string }>(
    `select c.name, c.slug
       from public.cities c
       join geo.prompts p on lower(p.city) = lower(c.name) and p.industry = $1
       join geo.measurements m on m.prompt_id = p.id and m.status = 'done' and m.measured_at > now() - make_interval(days => $2)
      group by c.name, c.slug
      order by count(*) desc, c.name
      limit 1`,
    [AUDIT_INDUSTRY, MEASUREMENT_WINDOW_DAYS],
  );
  let example: LandingExample | null = null;
  if (cities[0]) {
    const measurements = await loadCityMeasurements(cities[0].name);
    const ids = [...new Set(measurements.flatMap((m) => m.mentions.map((x) => x.brandId).filter((x): x is string => Boolean(x))))];
    const domains = ids.length
      ? await query<{ brand_id: string; host: string }>(
          `select distinct on (brand_id) brand_id, host from public.domains where brand_id = any($1::uuid[]) order by brand_id, host`,
          [ids],
        )
      : [];
    example = buildExample(cities[0], measurements, new Map(domains.map((d) => [d.brand_id, d.host.replace(/^www\./, "")])));
  }
  return { stats: s, example };
}

const cached = unstable_cache(load, ["landing-v1"], { revalidate: 3600 });

export async function loadLanding(): Promise<LandingData | null> {
  try {
    return await cached();
  } catch {
    return null;
  }
}
