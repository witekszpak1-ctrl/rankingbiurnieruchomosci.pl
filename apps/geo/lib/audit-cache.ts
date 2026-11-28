import { unstable_cache } from "next/cache";

import { buildAudit, type AuditResult } from "./audit";
import { loadAuditInput } from "./audit-repo";

/**
 * Wynik audytu dla domeny trzymany w pamięci podręcznej serwera przez godzinę (pomiary biblioteki odświeżają się raz
 * w tygodniu). Wspólny dla strony audytu i pulpitu klienta. Tylko odczyt z bazy.
 */
export const AUDIT_CACHE_SECONDS = 3600;

export const loadAudit = unstable_cache(
  async (domain: string): Promise<AuditResult> => buildAudit(await loadAuditInput(domain)),
  ["audyt-v2"],
  { revalidate: AUDIT_CACHE_SECONDS },
);

/** Jak loadAudit, ale zwraca null zamiast błędu (pulpit nie ma się wywracać, gdy audytu nie da się policzyć). */
export async function tryLoadAudit(domain: string | null): Promise<AuditResult | null> {
  if (!domain) return null;
  try {
    return await loadAudit(domain);
  } catch {
    return null;
  }
}
