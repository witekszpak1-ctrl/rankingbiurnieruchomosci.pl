/**
 * Przekierowania i adresy usunięte (kod 410) dla middleware, z pamięcią podręczną na 5 minut.
 * Dane z /api/path-status; przy błędzie strona działa jak dotąd (bez przekierowań i bez 410).
 */
type PathStatus = { redirects: Record<string, string>; gone: Set<string> };

const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; data: PathStatus } | null = null;
let pending: Promise<void> | null = null;

// Adresy profilu (/miasto/firma) i miasta (/miasto); inne ścieżki nie mają starych wersji.
const CANDIDATE = /^\/[a-z0-9-]+(?:\/[a-z0-9-]+)?$/;

export function isCandidatePath(pathname: string): boolean {
  return CANDIDATE.test(pathname);
}

async function refresh(origin: string): Promise<void> {
  try {
    const res = await fetch(`${origin}/api/path-status`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return;
    const body = (await res.json()) as { redirects: Record<string, string>; gone: string[] };
    cache = { at: Date.now(), data: { redirects: body.redirects ?? {}, gone: new Set(body.gone ?? []) } };
  } catch {
    // brak danych: zostaje poprzednia wersja albo nic
  } finally {
    pending = null;
  }
}

/** Status ścieżki: "redirect" z adresem docelowym, "gone" albo null. Nieaktualna pamięć odświeża się w tle. */
export async function pathStatus(
  pathname: string,
  origin: string,
  waitUntil: (p: Promise<unknown>) => void,
): Promise<{ kind: "redirect"; to: string } | { kind: "gone" } | null> {
  const fresh = cache && Date.now() - cache.at < TTL_MS;
  if (!fresh) {
    pending ??= refresh(origin);
    if (cache) waitUntil(pending);
    else await pending;
  }
  if (!cache) return null;
  const to = cache.data.redirects[pathname];
  if (to) return { kind: "redirect", to };
  if (cache.data.gone.has(pathname)) return { kind: "gone" };
  return null;
}

export const GONE_HTML = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Strona usunięta</title></head>
<body style="font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem;line-height:1.5">
<h1>Ta strona została usunięta</h1><p>Wpisu nie ma już w katalogu. Zobacz <a href="/">listę miast i biur nieruchomości</a>.</p>
</body></html>`;
