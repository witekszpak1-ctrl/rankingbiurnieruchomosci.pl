import { hostVariants, type AuditInput, type AuditMeasurement } from "./audit";
import { query } from "./db";

/**
 * Zapytania darmowego audytu. Tylko odczyt: katalog (public.*, rola geo_app ma SELECT z migracji 0004)
 * i biblioteka pomiarów (geo.*). Żadnych zapytań do dostawców AI i żadnych zapisów.
 */

export const CATALOG_URL = "https://rankingbiurnieruchomosci.pl";
export const AUDIT_INDUSTRY = "nieruchomosci";
export const MEASUREMENT_WINDOW_DAYS = 30;
/** Górna granica liczby pomiarów jednego audytu (biblioteka: 3 pytania x 3 platformy na miasto, z zapasem). */
const MAX_MEASUREMENTS = 300;

type FirmRow = {
  brand_id: string;
  brand_name: string;
  city_id: string;
  city_name: string;
  city_slug: string;
  listing_slug: string | null;
  measurements: number;
};

export type CatalogMatch = {
  brandId: string;
  brandName: string;
  city: { id: string; name: string; slug: string };
  profileUrl: string | null;
};

/** Firma z opublikowanym wpisem w katalogu nieruchomości, dopasowana po domenie (z www i bez). */
export async function findFirmByDomain(domain: string): Promise<CatalogMatch | null> {
  // Firma może mieć wpisy w kilku miastach: wybieramy miasto z największą liczbą pomiarów biblioteki.
  const rows = await query<FirmRow>(
    `select b.id as brand_id, b.name as brand_name, c.id as city_id, c.name as city_name, c.slug as city_slug,
            l.slug as listing_slug,
            (select count(*) from geo.measurements m join geo.prompts p on p.id = m.prompt_id
              where m.status = 'done' and p.industry = $2 and lower(p.city) = lower(c.name)
                and m.measured_at > now() - make_interval(days => $3))::int as measurements
       from public.domains d
       join public.brands b on b.id = d.brand_id
       join public.listings l on l.brand_id = b.id and l.status = 'published'
       join public.verticals v on v.id = l.vertical_id and v.slug = $2
       join public.cities c on c.id = l.city_id
      where d.host = any($1::text[])
      order by measurements desc, c.name
      limit 1`,
    [hostVariants(domain), AUDIT_INDUSTRY, MEASUREMENT_WINDOW_DAYS],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    brandId: r.brand_id,
    brandName: r.brand_name,
    city: { id: r.city_id, name: r.city_name, slug: r.city_slug },
    profileUrl: r.listing_slug ? `${CATALOG_URL}/${r.city_slug}/${r.listing_slug}` : null,
  };
}

type MeasurementRow = { id: string; platform: string; measured_at: Date; text: string };
type MentionRow = { measurement_id: string; position: number; name: string; domain: string | null; brand_id: string | null; brand_name: string | null; recommended: boolean };
type CitationRow = { measurement_id: string; domain: string; is_own_portal: boolean };

/** Najnowszy gotowy pomiar na klucz pamięci podręcznej z ostatnich 30 dni, dla pytań o miasto, z wzmiankami i cytowaniami. */
export async function loadCityMeasurements(cityName: string): Promise<AuditMeasurement[]> {
  const ms = await query<MeasurementRow>(
    `select distinct on (m.cache_key) m.id, m.platform, m.measured_at, p.text
       from geo.measurements m
       join geo.prompts p on p.id = m.prompt_id
      where m.status = 'done' and m.measured_at is not null
        and p.industry = $2 and lower(p.city) = lower($1)
        and m.measured_at > now() - make_interval(days => $3)
      order by m.cache_key, m.measured_at desc
      limit ${MAX_MEASUREMENTS}`,
    [cityName, AUDIT_INDUSTRY, MEASUREMENT_WINDOW_DAYS],
  );
  if (!ms.length) return [];
  const ids = ms.map((m) => m.id);
  const mentions = await query<MentionRow>(
    `select x.measurement_id, x.position, x.name, x.domain, x.brand_id, b.name as brand_name, x.recommended
       from geo.mentions x
       left join public.brands b on b.id = x.brand_id
      where x.measurement_id = any($1::uuid[])
      order by x.measurement_id, x.position`,
    [ids],
  );
  const citations = await query<CitationRow>(
    `select measurement_id, domain, is_own_portal from geo.citations where measurement_id = any($1::uuid[])`,
    [ids],
  );
  const mBy = new Map<string, MentionRow[]>();
  for (const r of mentions) (mBy.get(r.measurement_id) ?? mBy.set(r.measurement_id, []).get(r.measurement_id)!).push(r);
  const cBy = new Map<string, CitationRow[]>();
  for (const r of citations) (cBy.get(r.measurement_id) ?? cBy.set(r.measurement_id, []).get(r.measurement_id)!).push(r);
  return ms.map((m) => ({
    id: m.id,
    platform: m.platform,
    measuredAt: m.measured_at,
    promptText: m.text,
    mentions: (mBy.get(m.id) ?? []).map((x) => ({
      name: x.name,
      domain: x.domain,
      brandId: x.brand_id,
      brandName: x.brand_name,
      position: x.position,
      recommended: x.recommended,
    })),
    citations: (cBy.get(m.id) ?? []).map((c) => ({ domain: c.domain, isOwnPortal: c.is_own_portal })),
  }));
}

export const HISTORY_WEEKS = 12;
const MAX_HISTORY = 3000;

/**
 * Wszystkie gotowe pomiary miasta z ostatnich tygodni (bez deduplikacji po kluczu pamięci podręcznej), tylko ze wzmiankami.
 * Służą do wykresu historii: odsetek odpowiedzi z firmą w każdym tygodniu.
 */
export async function loadCityHistory(cityName: string): Promise<AuditMeasurement[]> {
  const ms = await query<{ id: string; platform: string; measured_at: Date }>(
    `select m.id, m.platform, m.measured_at
       from geo.measurements m
       join geo.prompts p on p.id = m.prompt_id
      where m.status = 'done' and m.measured_at is not null
        and p.industry = $2 and lower(p.city) = lower($1)
        and m.measured_at > now() - make_interval(days => $3)
      order by m.measured_at desc
      limit ${MAX_HISTORY}`,
    [cityName, AUDIT_INDUSTRY, HISTORY_WEEKS * 7],
  );
  if (!ms.length) return [];
  const mentions = await query<MentionRow>(
    `select x.measurement_id, x.position, x.name, x.domain, x.brand_id, null::text as brand_name, x.recommended
       from geo.mentions x where x.measurement_id = any($1::uuid[])`,
    [ms.map((m) => m.id)],
  );
  const by = new Map<string, MentionRow[]>();
  for (const r of mentions) (by.get(r.measurement_id) ?? by.set(r.measurement_id, []).get(r.measurement_id)!).push(r);
  return ms.map((m) => ({
    id: m.id,
    platform: m.platform,
    measuredAt: m.measured_at,
    promptText: "",
    mentions: (by.get(m.id) ?? []).map((x) => ({ name: x.name, domain: x.domain, brandId: x.brand_id, brandName: null, position: x.position, recommended: x.recommended })),
    citations: [],
  }));
}

/** Całość danych wejściowych audytu dla domeny (już znormalizowanej). */
export async function loadAuditInput(domain: string): Promise<AuditInput> {
  const firm = await findFirmByDomain(domain);
  if (!firm) return { domain, firm: null, city: null, profileUrl: null, measurements: [] };
  const [measurements, history] = await Promise.all([loadCityMeasurements(firm.city.name), loadCityHistory(firm.city.name)]);
  return {
    domain,
    firm: { brandId: firm.brandId, name: firm.brandName },
    city: { name: firm.city.name, slug: firm.city.slug },
    profileUrl: firm.profileUrl,
    measurements,
    history,
  };
}
