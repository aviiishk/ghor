import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { clearCookie, readCookie, setSessionCookies } from "./session";
import { resolveClientIp } from "./client-ip";
import { isTrustedOrigin, trustedOrigins } from "./origin";

// Server-side client for apps/api. The ONLY way this app reaches data: no database
// driver, no Prisma, no direct PostgreSQL access anywhere in apps/admin (D-46).
const API_URL = (process.env.ADMIN_API_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export type AuthMode = "session" | "pre" | "breakGlass" | "none";

function forwardedHeaders(req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  // Real client IP for the API's rate limits and audit metadata — trusted by the API only
  // together with the shared BFF secret, and taken ONLY from the explicitly configured
  // trusted source (see client-ip.ts). Never the raw, client-controlled X-Forwarded-For.
  const secret = process.env.BFF_PROXY_SECRET;
  const ip = resolveClientIp(req.headers, process.env.CLIENT_IP_SOURCE);
  if (secret && ip) {
    headers["x-ghor-client-ip"] = ip;
    headers["x-ghor-proxy-secret"] = secret;
  }
  const ua = req.headers.get("user-agent");
  if (ua) headers["user-agent"] = ua;
  // Dashboard polling marks itself as background so it doesn't keep an idle session alive.
  if (req.headers.get("x-admin-background") === "1") headers["x-admin-background"] = "1";
  return headers;
}

async function tokenFor(mode: AuthMode): Promise<string | undefined> {
  if (mode === "session") return readCookie("access");
  if (mode === "pre") return readCookie("pre");
  return undefined;
}

async function send(req: NextRequest, path: string, init: { method: string; body?: string }, mode: AuthMode) {
  const headers = forwardedHeaders(req);
  const token = await tokenFor(mode);
  if (token) headers.authorization = `Bearer ${token}`;
  return fetch(`${API_URL}${path}`, { method: init.method, body: init.body, headers, cache: "no-store" });
}

// The admin access token lives 10 minutes; on a 401 we try the refresh token exactly once
// (rotation happens server-side) and replay the request.
async function refreshSession(req: NextRequest): Promise<boolean> {
  const refreshToken = await readCookie("refresh");
  if (!refreshToken) return false;
  const res = await fetch(`${API_URL}/admin/auth/refresh`, {
    method: "POST",
    headers: forwardedHeaders(req),
    body: JSON.stringify({ refreshToken }),
    cache: "no-store"
  });
  if (!res.ok) return false;
  await setSessionCookies((await res.json()) as { accessToken: string; refreshToken: string });
  return true;
}

export async function callApi(
  req: NextRequest,
  path: string,
  init: { method: string; body?: string },
  mode: AuthMode
): Promise<Response> {
  let res = await send(req, path, init, mode);
  if (res.status === 401 && mode === "session") {
    const body = (await res.clone().json().catch(() => ({}))) as { code?: string };
    // A step-up requirement is not an expired session — hand it to the UI unchanged.
    if (body.code !== "STEP_UP_REQUIRED") {
      if (await refreshSession(req)) {
        res = await send(req, path, init, mode);
      } else {
        // Only the (dead) session cookies — never an in-progress sign-in's pre-MFA or
        // break-glass cookie (found by the BFF smoke test: a stray console request during
        // enrollment used to wipe the enrollment session).
        await clearCookie("access");
        await clearCookie("refresh");
      }
    }
  }
  return res;
}

// Pass an API response through to the browser: status + JSON body, never headers
// (nothing like Set-Cookie from the API should ever reach the browser directly).
export async function relay(res: Response): Promise<NextResponse> {
  const text = await res.text();
  return new NextResponse(text || null, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json", "cache-control": "no-store" }
  });
}

// CSRF defence for state-changing BFF calls. Session cookies are already SameSite=Strict
// (and admin.ghor.co.in is a separate origin from ghor.co.in); this additionally requires
// that the request provably came from one of the console's configured public origins
// (ADMIN_ALLOWED_ORIGINS, see origin.ts) — never from req.nextUrl.origin, which is the
// internal URL behind a TLS-terminating proxy.
export function isSameOrigin(req: NextRequest): boolean {
  return isTrustedOrigin(req.method, req.headers, trustedOrigins(process.env));
}

export function forbiddenCrossOrigin() {
  return NextResponse.json({ statusCode: 403, message: "Cross-origin request refused", code: "CSRF" }, { status: 403 });
}
