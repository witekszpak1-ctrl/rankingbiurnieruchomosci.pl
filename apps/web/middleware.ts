import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import { reportBot } from "./lib/pulse-bots";
import { SESSION_COOKIE, verifySession } from "./lib/session";

// Chroni cały /admin poza stroną logowania. Akcje serwerowe dodatkowo wołają requireAdmin().
// Poza panelem: zgłasza boty (wyszukiwarki, AI, podglądy linków) do „Statystyk stron” w CRM.
export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  if (pathname !== "/admin" && !pathname.startsWith("/admin/")) {
    reportBot(request, event);
    return NextResponse.next();
  }
  if (pathname === "/admin/login") return NextResponse.next();

  const secret = process.env.ADMIN_SESSION_SECRET;
  const admin =
    secret && secret.length >= 32 ? await verifySession(request.cookies.get(SESSION_COOKIE)?.value, secret) : null;
  if (!admin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    // Strony publiczne (do liczenia botów), bez API i plików statycznych; robots.txt, sitemap.xml i llms.txt celowo w środku.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|css|js|map|woff2?|mp4|webm)$).*)",
  ],
};
