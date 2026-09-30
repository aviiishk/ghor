import { isIP } from "net";

// Which client IP (if any) the admin BFF forwards to apps/api for rate limits and audit
// metadata. The API trusts the forwarded value only together with BFF_PROXY_SECRET, so
// what matters is that THIS layer never takes an attacker-supplied value.
//
// CLIENT_IP_SOURCE (set per deployment; hosting is not decided yet — audit F-03):
//   unset / "none"     Forward nothing (default, and the right choice when nothing trusted
//                      sits in front of the app, e.g. `next dev`/`next start` locally).
//                      The API then sees the BFF's own address: sign-in limits still hold
//                      per phone number and per admin account.
//   "header:<name>"    Use a single-value header that the hosting platform's edge SETS and
//                      OVERWRITES on every request (e.g. header:x-vercel-forwarded-for on
//                      Vercel, header:cf-connecting-ip behind Cloudflare, header:x-real-ip
//                      behind an nginx you control). Never name a header a client can send
//                      straight through.
//   "xff:<n>"          Use X-Forwarded-For, taking the n-th address counted from the RIGHT,
//                      where n = the number of trusted proxies that append to it (xff:1 =
//                      the address seen by the last trusted proxy). Everything to the left
//                      is client-controlled and ignored.
// Any value that isn't a syntactically valid IP address is dropped.
export function resolveClientIp(headers: Headers, source: string | undefined): string | null {
  const spec = (source ?? "").trim();
  if (!spec || spec === "none") return null;

  let candidate: string | undefined;
  if (spec.startsWith("header:")) {
    const name = spec.slice("header:".length).trim().toLowerCase();
    if (!name || name === "x-forwarded-for") return null; // multi-hop header: use xff:<n>
    candidate = headers.get(name)?.split(",")[0]?.trim();
  } else if (spec.startsWith("xff:")) {
    const hops = Number(spec.slice("xff:".length));
    if (!Number.isInteger(hops) || hops < 1 || hops > 10) return null;
    const chain = (headers.get("x-forwarded-for") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    candidate = chain[chain.length - hops];
  } else {
    return null; // unknown setting → fail closed (forward nothing)
  }
  return candidate && isIP(candidate) ? candidate : null;
}
