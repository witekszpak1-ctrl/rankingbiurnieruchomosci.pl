import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySession } from "./lib/session";

// Chroni cały /admin poza stroną logowania. Akcje serwerowe dodatkowo wołają requireAdmin().
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
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

export const config = { matcher: ["/admin/:path*"] };
