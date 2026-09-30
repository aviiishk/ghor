import { expect, test } from "@playwright/test";
import http from "http";
import { E2E } from "./env";
import { isTrustedOrigin, trustedOrigins } from "../lib/server/origin";

// Pre-merge fix: the BFF's CSRF check compares the browser Origin with an explicit
// allowlist (ADMIN_ALLOWED_ORIGINS), not with req.nextUrl.origin — which behind a
// TLS-terminating proxy is the internal upstream URL.

const post = (origin: string | null, extra: Record<string, string> = {}) => {
  const h = new Headers(extra);
  if (origin) h.set("origin", origin);
  return h;
};

test.describe("trusted-origin rules", () => {
  test("production and staging origins; nothing trusted when unset in production", () => {
    const prod = trustedOrigins({ NODE_ENV: "production", ADMIN_ALLOWED_ORIGINS: "https://admin.ghor.co.in" });
    const staging = trustedOrigins({ NODE_ENV: "production", ADMIN_ALLOWED_ORIGINS: "https://admin-staging.ghor.co.in/" });
    expect(prod).toEqual(["https://admin.ghor.co.in"]);
    expect(staging).toEqual(["https://admin-staging.ghor.co.in"]);
    expect(isTrustedOrigin("POST", post("https://admin.ghor.co.in"), prod)).toBe(true);
    expect(isTrustedOrigin("POST", post("https://admin-staging.ghor.co.in"), prod)).toBe(false);
    expect(isTrustedOrigin("POST", post("https://admin-staging.ghor.co.in"), staging)).toBe(true);
    // Scheme, host and port must all match.
    expect(isTrustedOrigin("POST", post("http://admin.ghor.co.in"), prod)).toBe(false);
    expect(isTrustedOrigin("POST", post("https://admin.ghor.co.in:8443"), prod)).toBe(false);
    expect(isTrustedOrigin("POST", post("https://evil.admin.ghor.co.in"), prod)).toBe(false);
    expect(isTrustedOrigin("POST", post("null"), prod)).toBe(false);
    // Fail closed: production with no configuration trusts nothing.
    expect(trustedOrigins({ NODE_ENV: "production" })).toEqual([]);
    expect(isTrustedOrigin("POST", post("https://admin.ghor.co.in"), [])).toBe(false);
  });

  test("development defaults; wildcards and non-origins are ignored", () => {
    expect(trustedOrigins({ NODE_ENV: "development" })).toEqual(["http://localhost:3001", "http://127.0.0.1:3001"]);
    expect(trustedOrigins({ NODE_ENV: "production", ADMIN_ALLOWED_ORIGINS: "*, https://*.ghor.co.in, https://admin.ghor.co.in/path, ftp://x" })).toEqual([]);
  });

  test("forwarding headers and Sec-Fetch-Site cannot widen the allowlist", () => {
    const prod = ["https://admin.ghor.co.in"];
    const forged = post("https://evil.example", { "x-forwarded-host": "admin.ghor.co.in", "x-forwarded-proto": "https", host: "admin.ghor.co.in" });
    expect(isTrustedOrigin("POST", forged, prod)).toBe(false);
    expect(isTrustedOrigin("POST", post("https://admin.ghor.co.in", { "sec-fetch-site": "cross-site" }), prod)).toBe(false);
    expect(isTrustedOrigin("POST", post(null, { "sec-fetch-site": "same-origin" }), prod)).toBe(true);
    expect(isTrustedOrigin("POST", post(null), prod)).toBe(false);
    expect(isTrustedOrigin("GET", post("https://evil.example"), prod)).toBe(true); // reads are not state-changing
  });
});

test.describe("behind a reverse proxy", () => {
  // A minimal proxy in front of the running console, rewriting Host to the upstream (as
  // nginx's default `proxy_set_header Host $proxy_host` does). Its public origin is listed
  // in the console's ADMIN_ALLOWED_ORIGINS (e2e/env.ts); the console itself only ever sees
  // the internal URL.
  let proxy: http.Server;
  test.beforeAll(async () => {
    proxy = http.createServer((req, res) => {
      const upstream = http.request(
        { host: "localhost", port: E2E.adminPort, path: req.url, method: req.method, headers: { ...req.headers, host: `localhost:${E2E.adminPort}` } },
        (up) => {
          res.writeHead(up.statusCode ?? 502, up.headers);
          up.pipe(res);
        }
      );
      req.pipe(upstream);
    });
    await new Promise<void>((r) => proxy.listen(E2E.proxyPort, "127.0.0.1", () => r()));
  });
  test.afterAll(() => new Promise<void>((r) => proxy.close(() => r())));

  test("a request from the public origin passes the CSRF check; others are refused", async ({ request }) => {
    const url = `${E2E.proxyOrigin}/api/admin/listings/bulk-decision`;
    // Trusted public origin → reaches the API (401: no session), not the CSRF 403.
    const ok = await request.post(url, { headers: { origin: E2E.proxyOrigin }, data: {} });
    expect(ok.status()).toBe(401);
    // Foreign origin, even when it forges forwarding headers → CSRF 403.
    const evil = await request.post(url, {
      headers: { origin: "https://evil.example", "x-forwarded-host": "127.0.0.1:3312", "x-forwarded-proto": "http" },
      data: {}
    });
    expect(evil.status()).toBe(403);
    expect((await evil.json()).code).toBe("CSRF");
    // The internal upstream URL is not a browser origin anyone should be using.
    const internal = await request.post(url, { headers: { origin: "http://localhost:9" }, data: {} });
    expect(internal.status()).toBe(403);
  });
});
