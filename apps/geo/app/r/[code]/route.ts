import { NextResponse, type NextRequest } from "next/server";

import { DAY_MS, REF_COOKIE, encodeRefCookie, normalizeCampaign, normalizeCode, safeRedirectPath } from "@/lib/affiliate";
import { currentTerms, recordClick, visitorHash } from "@/lib/affiliate-repo";

export const dynamic = "force-dynamic";

const BOT_RE = /bot|crawler|spider|crawl|slurp|preview|facebookexternalhit|whatsapp|telegram|slack|discord|curl\/|wget|python-|httpx|headless/i;

/**
 * Link partnera: /r/<kod>?c=<kampania>&to=<ścieżka>. Zapisuje kliknięcie (bez IP), ustawia ciasteczko z kodem
 * na tyle dni, ile mówią warunki, i przekierowuje na naszą stronę. Boty i podglądy linków nie są liczone
 * i nie dostają ciasteczka. Nieznany kod przekierowuje bez zapisu.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = normalizeCode(raw);
  const to = safeRedirectPath(req.nextUrl.searchParams.get("to")) ?? "/";
  const target = new URL(to, req.nextUrl.origin);
  const res = NextResponse.redirect(target, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex");
  const ua = req.headers.get("user-agent") ?? "";
  if (!code || !ua || BOT_RE.test(ua)) return res;

  const campaign = normalizeCampaign(req.nextUrl.searchParams.get("c"));
  let referrerHost: string | null = null;
  try {
    const r = req.headers.get("referer");
    referrerHost = r ? new URL(r).hostname.slice(0, 200) : null;
  } catch {
    referrerHost = null;
  }
  const ip = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const day = new Date().toISOString().slice(0, 10);
  try {
    const [terms, clickId] = await Promise.all([
      currentTerms(),
      recordClick({ code, landingPath: to, campaign, referrerHost, visitor: visitorHash(ip, ua, day, process.env.GEO_SESSION_SECRET ?? "") }),
    ]);
    if (clickId === null) return res;
    res.cookies.set(REF_COOKIE, encodeRefCookie({ code, clickId, at: Date.now(), campaign }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.round((terms.cookieDays * DAY_MS) / 1000),
    });
  } catch {
    // Błąd bazy nie może zablokować przejścia na stronę.
  }
  return res;
}
