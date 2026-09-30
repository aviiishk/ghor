import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { isIP } from 'net';
import type { NextFunction, Request, Response } from 'express';

export type GhorRequest = Request & { requestId?: string };

const REQUEST_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

// Correlates a request across logs, error responses and audit rows. A caller-supplied
// X-Request-Id is kept only when it looks like an id (never echo arbitrary header input).
export function requestIdMiddleware(
  req: GhorRequest,
  res: Response,
  next: NextFunction,
) {
  const incoming = req.headers['x-request-id'];
  req.requestId =
    typeof incoming === 'string' && REQUEST_ID_RE.test(incoming)
      ? incoming
      : randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// The web and admin BFFs call this API server-to-server, so the TCP peer is the BFF, not
// the browser. A BFF may forward the real client IP in X-GHOR-Client-IP, which is only
// trusted together with the shared BFF_PROXY_SECRET — otherwise anyone could spoof it to
// dodge per-IP limits or poison audit metadata.
export function clientIp(req: Request): string {
  const secret = process.env.BFF_PROXY_SECRET;
  const forwarded = req.headers['x-ghor-client-ip'];
  const presented = req.headers['x-ghor-proxy-secret'];
  if (
    secret &&
    typeof forwarded === 'string' &&
    typeof presented === 'string' &&
    safeEqual(presented, secret) &&
    isIP(forwarded)
  ) {
    return forwarded;
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

// Audit rows store a keyed hash of the IP, never the IP itself (enough to correlate
// "same source" without keeping personal data around). IP_HASH_KEY is required in
// production (see assertProductionConfig).
export function hashIp(ip: string): string {
  const key = process.env.IP_HASH_KEY || 'ghor-non-production-ip-hash-key';
  return createHmac('sha256', key).update(ip).digest('hex').slice(0, 32);
}

export function userAgent(req: Request): string | undefined {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' ? ua.slice(0, 300) : undefined;
}
