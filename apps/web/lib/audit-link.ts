/**
 * Link do darmowego audytu widoczności w AI (platforma GeoTrace, apps/geo): `${NEXT_PUBLIC_GEO_AUDIT_URL}/audyt/<domena>`.
 * Zmienna jest czytana przy budowaniu (NEXT_PUBLIC_*). Gdy nie jest ustawiona, przycisk się nie pokazuje i profile
 * wyglądają dokładnie jak dotąd (stan na 28.11.2026: zmienna nieustawiona).
 */
export function auditUrl(
  host: string | null | undefined,
  citySlug: string,
  firmSlug: string | null,
  base: string | undefined = process.env.NEXT_PUBLIC_GEO_AUDIT_URL,
): string | null {
  const root = base?.trim().replace(/\/+$/, "");
  if (!root || !/^https?:\/\//i.test(root)) return null;
  const domain = host?.trim().toLowerCase().replace(/^www\./, "");
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return null;
  const q = new URLSearchParams({
    utm_source: "ranking",
    utm_medium: "profil",
    utm_campaign: "audyt-ai",
    utm_content: `${citySlug}/${firmSlug ?? "profil"}`,
  });
  return `${root}/audyt/${encodeURIComponent(domain)}?${q.toString()}`;
}
