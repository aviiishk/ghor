// CSRF origin check for the admin BFF's state-changing routes.
//
// Behind a TLS-terminating reverse proxy the Next.js server sees an internal URL
// (e.g. http://10.0.0.5:3001), so comparing the browser's Origin with req.nextUrl.origin
// refuses every legitimate request — and deriving "our" origin from X-Forwarded-Host /
// X-Forwarded-Proto would trust client-controllable headers. Instead the console's public
// origins are configured explicitly and the browser-set Origin must match one exactly.
//
// ADMIN_ALLOWED_ORIGINS — comma-separated exact origins (scheme://host[:port]), the same
// value apps/api uses for its ADMIN_ALLOWED_ORIGINS:
//   production  https://admin.ghor.co.in
//   staging     https://admin-staging.ghor.co.in
// Unset in development → http://localhost:3001 and http://127.0.0.1:3001.
// Unset in production → nothing is trusted and every mutation is refused (fail closed).
// Wildcards and non-origin values (paths, "*", "null") are ignored.

const DEV_ORIGINS = ["http://localhost:3001", "http://127.0.0.1:3001"];

function normalizeOrigin(value: string): string | null {
  const v = value.trim();
  if (!v || v.includes("*")) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    // An origin is scheme://host[:port] only.
    if (v.replace(/\/+$/, "") !== u.origin) return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function trustedOrigins(env: { ADMIN_ALLOWED_ORIGINS?: string; NODE_ENV?: string }): string[] {
  const configured = (env.ADMIN_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map(normalizeOrigin)
    .filter((o): o is string => o !== null);
  if (configured.length) return configured;
  return env.NODE_ENV === "production" ? [] : DEV_ORIGINS;
}

// `headers` are the browser request's headers. Sec-Fetch-Site and Origin are set by the
// browser itself (forbidden header names — page scripts cannot forge them).
export function isTrustedOrigin(method: string, headers: Headers, allowed: string[]): boolean {
  if (method === "GET" || method === "HEAD") return true;
  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;
  const origin = headers.get("origin");
  if (!origin) return fetchSite === "same-origin";
  const normalized = normalizeOrigin(origin);
  return normalized !== null && allowed.includes(normalized);
}
