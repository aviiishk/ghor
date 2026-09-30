// Origin allowlists. Browsers are the only clients CORS applies to: the web/admin BFFs call
// this API server-to-server and the mobile app is native, so neither sends an Origin that
// needs allowing. What *does* come from a browser is the web app's Socket.io chat
// connection — hence CORS_ALLOWED_ORIGINS for the marketplace origins. Admin origins are
// kept in a separate list and are never allowed on non-admin routes' CORS (and vice versa
// for /admin/*, see AdminOriginGuard).

const DEV_WEB_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];
const DEV_ADMIN_ORIGINS = ['http://localhost:3001', 'http://127.0.0.1:3001'];

function parseList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((v) => v.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

export function webAllowedOrigins(): string[] {
  const configured = parseList(process.env.CORS_ALLOWED_ORIGINS);
  if (configured.length) return configured;
  return process.env.NODE_ENV === 'production' ? [] : DEV_WEB_ORIGINS;
}

export function adminAllowedOrigins(): string[] {
  const configured = parseList(process.env.ADMIN_ALLOWED_ORIGINS);
  if (configured.length) return configured;
  return process.env.NODE_ENV === 'production' ? [] : DEV_ADMIN_ORIGINS;
}

type OriginCallback = (err: Error | null, allow?: boolean) => void;

// Requests without an Origin (server-to-server, native mobile) are allowed through CORS —
// CORS is a browser read-protection, not authentication; every route still authenticates.
export function webCorsOrigin(origin: string | undefined, cb: OriginCallback) {
  if (!origin) return cb(null, true);
  cb(null, webAllowedOrigins().includes(origin.replace(/\/+$/, '')));
}
