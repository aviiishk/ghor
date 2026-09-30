import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Clock } from '../common/clock';

export interface RateLimitResult {
  allowed: boolean;
  hits: number;
  retryAfterSeconds: number;
}

// Fixed-window counters stored in Postgres (table rate_limit_buckets).
//
// Why Postgres and not memory/Redis: the API may run as several instances (hosting is not
// yet decided, audit F-03). An in-memory counter would give each instance its own budget,
// and Redis would be new infrastructure. A single atomic INSERT … ON CONFLICT per request
// is correct across any number of instances and is cheap at GHOR's volume. If request
// volume ever makes this a hotspot, swap this one class for a Redis implementation.
@Injectable()
export class RateLimitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async hit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const now = this.clock.now();
    const windowEnd = new Date(now.getTime() + windowSeconds * 1000);
    const rows = await this.prisma.$queryRaw<
      { hits: number; window_ends_at: Date }[]
    >`
      INSERT INTO "rate_limit_buckets" ("key", "hits", "window_ends_at")
      VALUES (${key}, 1, ${windowEnd})
      ON CONFLICT ("key") DO UPDATE SET
        "hits" = CASE WHEN "rate_limit_buckets"."window_ends_at" <= ${now}
                      THEN 1 ELSE "rate_limit_buckets"."hits" + 1 END,
        "window_ends_at" = CASE WHEN "rate_limit_buckets"."window_ends_at" <= ${now}
                      THEN ${windowEnd} ELSE "rate_limit_buckets"."window_ends_at" END
      RETURNING "hits", "window_ends_at"`;
    const row = rows[0];
    const hits = Number(row.hits);
    return {
      allowed: hits <= limit,
      hits,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((row.window_ends_at.getTime() - now.getTime()) / 1000),
      ),
    };
  }

  async purgeExpired(): Promise<number> {
    const cutoff = new Date(this.clock.now().getTime() - 60 * 60 * 1000);
    const result = await this.prisma.rateLimitBucket.deleteMany({
      where: { windowEndsAt: { lt: cutoff } },
    });
    return result.count;
  }
}
