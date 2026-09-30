import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Clock } from '../common/clock';
import { PushService } from '../push/push.service';
import { AlertsService } from '../alerts/alerts.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import type { NotifyUserPayload } from '../outbox/outbox.service';
import { JobRunnerService, type JobResult } from './job-runner.service';

const BATCH = 50;
const MAX_ATTEMPTS = 8;

// Delivers transactional-outbox messages after commit (docs/GHOR-ADMIN-API-AUDIT.md §15).
//
// Idempotency: each message is claimed and its durable effect (the in-app notification
// row) written in ONE transaction, so a crash either leaves the message unprocessed (and
// it is retried) or fully processed — never a duplicate notification. The push is sent
// after that commit on a best-effort basis (Expo push is not transactional); a failed push
// never re-creates the notification.
@Injectable()
export class OutboxWorker {
  private readonly logger = new Logger(OutboxWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly push: PushService,
    private readonly alerts: AlertsService,
    private readonly limiter: RateLimitService,
    private readonly runner: JobRunnerService,
  ) {}

  @Interval('outbox', 5_000)
  async scheduled() {
    if (process.env.JOBS_ENABLED === 'false') return;
    await this.runner.run('outbox', 60, () => this.tick());
  }

  // Housekeeping for the Postgres rate-limit table (expired windows).
  @Interval('maintenance', 10 * 60_000)
  async maintenance() {
    if (process.env.JOBS_ENABLED === 'false') return;
    await this.runner.run('maintenance', 300, async () => ({
      processed: await this.limiter.purgeExpired(),
    }));
  }

  async tick(): Promise<JobResult> {
    const now = this.clock.now();
    const due = await this.prisma.outboxEvent.findMany({
      where: { processedAt: null, nextAttemptAt: { lte: now } },
      orderBy: { createdAt: 'asc' },
      take: BATCH,
    });
    let delivered = 0;
    let failed = 0;
    for (const event of due) {
      try {
        const pushJob = await this.prisma.$transaction(async (tx) => {
          const claimed = await tx.outboxEvent.updateMany({
            where: { id: event.id, processedAt: null },
            data: { processedAt: this.clock.now(), attempts: { increment: 1 } },
          });
          if (claimed.count !== 1) return null; // another worker got it
          if (event.topic !== 'notify.user')
            throw new Error(`Unknown outbox topic ${event.topic}`);
          const payload = event.payload as unknown as NotifyUserPayload;
          await tx.notification.create({
            data: {
              userId: payload.userId,
              type: payload.type,
              payload: payload.payload as Prisma.InputJsonValue,
            },
          });
          return payload.push
            ? { userId: payload.userId, push: payload.push }
            : null;
        });
        delivered++;
        if (pushJob) {
          await this.push
            .sendToUser(pushJob.userId, pushJob.push)
            .catch((e: Error) => {
              this.logger.warn(
                `Push for outbox ${event.id} failed: ${e.message}`,
              );
            });
        }
      } catch (e) {
        failed++;
        await this.recordFailure(
          event.id,
          event.attempts + 1,
          (e as Error).message,
        );
      }
    }
    return { processed: delivered, details: { delivered, failed } };
  }

  private async recordFailure(id: string, attempts: number, message: string) {
    const dead = attempts >= MAX_ATTEMPTS;
    // Exponential backoff: 10 s, 20 s, 40 s … capped at 1 h.
    const delayMs = Math.min(10_000 * 2 ** (attempts - 1), 60 * 60_000);
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        attempts,
        lastError: message.slice(0, 500),
        nextAttemptAt: new Date(this.clock.now().getTime() + delayMs),
        ...(dead ? { processedAt: this.clock.now() } : {}),
      },
    });
    if (dead) {
      await this.alerts.raise(this.prisma, {
        kind: 'outbox_dead_letter',
        severity: 'warning',
        message: `An outbox message failed ${attempts} times and was abandoned`,
        dedupeKey: 'outbox_dead_letter',
        metadata: { outboxId: id, lastError: message.slice(0, 200) },
      });
    }
  }
}
