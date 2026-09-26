import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const CONNECT_TIMEOUT_S = 20;
// 8 attempts ≈ up to ~3.5 min worst case. Measured 2026-09-26: after idle, Supabase's
// free-tier pooler took several 20s-timeout attempts to "warm up" before connecting in
// ~1.5s — a cold start, not an outage. Better a slow boot than a crash loop.
const STARTUP_ATTEMPTS = 8;

// Prisma's default connect_timeout is 5s. Measured 2026-09-26: the first connection to
// Supabase's transaction pooler (:6543) from a cold client regularly took just over 5s
// (5.07s → P1001 "Can't reach database server") while later ones took 1.2–3s — so the
// API crashed on startup and first requests failed intermittently, though the database
// was healthy. Raise the timeout unless the URL already sets one explicitly.
function withConnectTimeout(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has('connect_timeout')) {
      u.searchParams.set('connect_timeout', String(CONNECT_TIMEOUT_S));
    }
    // pool_timeout (default 10s) must exceed connect_timeout, or the pool gives up
    // waiting for a connection that's still mid-handshake ("Timed out fetching a new
    // connection from the connection pool" — seen on the first retry of this fix).
    if (!u.searchParams.has('pool_timeout')) {
      u.searchParams.set('pool_timeout', String(CONNECT_TIMEOUT_S + 10));
    }
    return u.toString();
  } catch {
    return url; // not a parseable URL — leave it to Prisma to report
  }
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const url = withConnectTimeout(process.env.DATABASE_URL);
    super(url ? { datasources: { db: { url } } } : undefined);
  }

  // Retry the initial connect instead of letting one slow/failed handshake take the whole
  // API down at boot. Prisma reconnects lazily on later queries by itself.
  async onModuleInit() {
    for (let attempt = 1; ; attempt++) {
      try {
        await this.$connect();
        return;
      } catch (e) {
        if (attempt >= STARTUP_ATTEMPTS) throw e;
        const waitMs = Math.min(attempt * 2000, 10_000);
        this.logger.warn(
          `Database connect failed (attempt ${attempt}/${STARTUP_ATTEMPTS}), retrying in ${waitMs}ms: ${
            (e as Error).message.split('\n').filter(Boolean).pop() ?? ''
          }`,
        );
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
