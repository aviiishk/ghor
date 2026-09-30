import { NextResponse, type NextRequest } from "next/server";

// 1. Per-request Content-Security-Policy with a script nonce (Next.js applies the nonce
//    to its own scripts). No inline scripts, no third-party origins, no framing.
// 2. UX gate: pages other than sign-in require a session cookie. This is NOT the security
//    boundary — every data request is authorized by apps/api (permission + live MFA
//    session); a missing/expired session simply fails there.
const PROD = process.env.NODE_ENV === "production";
const SESSION_COOKIE = PROD ? "__Host-ghor_admin_rt" : "ghor_admin_rt";
const PUBLIC_PAGES = ["/sign-in", "/mfa", "/enroll"];

function csp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${PROD ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://res.cloudinary.com",
    "font-src 'self'",
    `connect-src 'self'${PROD ? "" : " ws:"}`,
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'"
  ].join("; ");
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const isPublic = PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!isApi && !isPublic && !req.cookies.has(SESSION_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const nonce = btoa(crypto.randomUUID());
  const policy = csp(nonce);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", policy);
  return res;
}

export const config = {
  // robots.txt must be reachable without a session (it tells crawlers to stay out).
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico|robots.txt).*)" }]
};
