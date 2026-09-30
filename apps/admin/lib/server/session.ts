import "server-only";
import { cookies } from "next/headers";

// Admin session cookies (D-47): httpOnly (never readable by browser JS), SameSite=Strict,
// Secure in production, host-only (no Domain attribute) and — in production — the
// `__Host-` prefix, which the browser only accepts when all of that holds. They are
// entirely separate from the marketplace's ghor_at / ghor_rt cookies.
const PROD = process.env.NODE_ENV === "production";
const name = (base: string) => (PROD ? `__Host-${base}` : base);

export const COOKIES = {
  access: name("ghor_admin_at"),
  refresh: name("ghor_admin_rt"),
  pre: name("ghor_admin_pre"),
  breakGlass: name("ghor_admin_bg")
} as const;

// Lifetimes mirror the API: access token 10 min; the refresh cookie may live up to the
// 12 h absolute session cap (the API enforces idle 30 min / absolute 12 h regardless).
const MAX_AGE = { access: 10 * 60, refresh: 12 * 60 * 60, pre: 10 * 60, breakGlass: 5 * 60 };

function options(maxAge: number) {
  return { httpOnly: true, secure: PROD, sameSite: "strict" as const, path: "/", maxAge };
}

// Clearing a cookie is a Set-Cookie too, and browsers ignore a `__Host-` Set-Cookie that
// lacks Secure/Path=/ — so Next's cookies().delete(name), which sends only an expiry, never
// removed these cookies in production (found by the Playwright sign-out check). Expire
// them with exactly the attributes they were set with.
function expire(jar: Awaited<ReturnType<typeof cookies>>, name: string) {
  jar.set(name, "", { ...options(0), expires: new Date(0) });
}

export async function readCookie(key: keyof typeof COOKIES): Promise<string | undefined> {
  return (await cookies()).get(COOKIES[key])?.value;
}

export async function setSessionCookies(tokens: { accessToken: string; refreshToken: string }) {
  const jar = await cookies();
  jar.set(COOKIES.access, tokens.accessToken, options(MAX_AGE.access));
  jar.set(COOKIES.refresh, tokens.refreshToken, options(MAX_AGE.refresh));
  expire(jar, COOKIES.pre);
  expire(jar, COOKIES.breakGlass);
}

export async function setPreCookie(token: string) {
  (await cookies()).set(COOKIES.pre, token, options(MAX_AGE.pre));
}

export async function setBreakGlassCookie(token: string) {
  (await cookies()).set(COOKIES.breakGlass, token, options(MAX_AGE.breakGlass));
}

export async function clearCookie(key: keyof typeof COOKIES) {
  expire(await cookies(), COOKIES[key]);
}

export async function clearAllAdminCookies() {
  const jar = await cookies();
  for (const c of Object.values(COOKIES)) expire(jar, c);
}
