import { buildAudit, topMentioned, type AuditMeasurement, type TopMentioned } from "./audit";

/** Dane przykładu na stronie głównej: czysta obróbka pomiarów jednego miasta (bez bazy). Wszystkie liczby pochodzą z pomiarów. */

export type LandingExample = {
  city: string;
  /** ISO najnowszego pomiaru w próbie. */
  measuredAt: string | null;
  sample: number;
  top: TopMentioned[];
  firm: { name: string; score: number | null; sample: number } | null;
};

export type LandingStats = { answers: number; cities: number; companies: number; platforms: number };

/**
 * Przykład z pomiaru jednego miasta: trzy najczęściej wymieniane firmy oraz wynik widoczności najczęściej wymienianej
 * firmy z katalogu (gdy znamy jej domenę). Wynik jest null przy próbie mniejszej niż MIN_SAMPLE (za mało danych).
 */
export function buildExample(
  city: { name: string; slug: string },
  measurements: AuditMeasurement[],
  catalogDomains: Map<string, string>,
): LandingExample | null {
  if (!measurements.length) return null;
  const top = topMentioned(measurements, 3);
  if (!top.length) return null;
  const times = measurements.map((m) => new Date(m.measuredAt).getTime());
  const lead = topMentioned(measurements, 10).find((t) => t.brandId && catalogDomains.has(t.brandId));
  let firm: LandingExample["firm"] = null;
  if (lead && lead.brandId) {
    const domain = catalogDomains.get(lead.brandId) as string;
    const audit = buildAudit({
      domain,
      firm: { brandId: lead.brandId, name: lead.name },
      city,
      profileUrl: null,
      measurements,
    });
    firm = { name: lead.name, score: audit.score, sample: measurements.length };
  }
  return {
    city: city.name,
    measuredAt: new Date(Math.max(...times)).toISOString(),
    sample: measurements.length,
    top,
    firm,
  };
}
