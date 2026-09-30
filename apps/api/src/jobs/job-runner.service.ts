import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Clock } from '../common/clock';
import { AlertsService } from '../alerts/alerts.service';

export interface JobResult {
  processed: number;
  details?: Record<string, unknown>;
}

export type JobOutcome =
  | { ran: true; result: JobResult }
  | { ran: false; reason: 'lease_held' }
  | { ran: true; error: string };

const FAILURE_ALERT_THRESHOLD = 3;

// Runs a background job at most once at a time across ALL API instances.
//
// Lease instead of pg_advisory_lock: GHOR's runtime DATABASE_URL goes through Supabase's
// transaction-mode pooler, where session-level advisory locks are unreliable (the lock can
// land on a different backend connection than the unlock). A lease row updated with a
// conditional UPDATE is pooler-safe and survives crashes (it simply expires).
// Correctness never depends on the lease alone: every job mutation is also a conditional,
// version-checked update, so two runners overlapping would still not double-apply work.
@Injectable()
export class JobRunnerService {
  private readonly logger = new Logger(JobRunnerService.name);
  readonly instanceId = randomUUID();

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly alerts: AlertsService,
  ) {}

  async run(
    name: string,
    leaseSeconds: number,
    fn: () => Promise<JobResult>,
  ): Promise<JobOutcome> {
    const startedAt = this.clock.now();
    if (!(await this.acquire(name, leaseSeconds, startedAt))) {
      return { ran: false, reason: 'lease_held' };
    }
    try {
      const result = await fn();
      const finishedAt = this.clock.now();
      await this.prisma.jobState.update({
        where: { name },
        data: {
          lastRunAt: startedAt,
          lastSuccessAt: finishedAt,
          lastError: null,
          consecutiveFailures: 0,
        },
      });
      if (result.processed > 0) {
        await this.prisma.jobRun.create({
          data: {
            jobName: name,
            startedAt,
            finishedAt,
            status: 'success',
            processed: result.processed,
            details: (result.details ?? undefined) as
              Prisma.InputJsonValue | undefined,
          },
        });
      }
      return { ran: true, result };
    } catch (e) {
      const message = (e as Error).message?.slice(0, 500) ?? 'unknown error';
      this.logger.error(`Job ${name} failed: ${message}`);
      const state = await this.prisma.jobState.update({
        where: { name },
        data: {
          lastRunAt: startedAt,
          lastError: message,
          consecutiveFailures: { increment: 1 },
        },
      });
      await this.prisma.jobRun.create({
        data: {
          jobName: name,
          startedAt,
          finishedAt: this.clock.now(),
          status: 'failed',
          details: { error: message },
        },
      });
      if (state.consecutiveFailures >= FAILURE_ALERT_THRESHOLD) {
        await this.alerts.raise(this.prisma, {
          kind: 'job_failing',
          severity: 'critical',
          message: `Background job "${name}" has failed ${state.consecutiveFailures} times in a row`,
          dedupeKey: `job_failing:${name}`,
          metadata: { job: name, lastError: message },
        });
      }
      return { ran: true, error: message };
    } finally {
      await this.prisma.jobState
        .updateMany({
          where: { name, leaseHolder: this.instanceId },
          data: { leaseHolder: null, leaseExpiresAt: null },
        })
        .catch(() => {});
    }
  }

  private async acquire(
    name: string,
    leaseSeconds: number,
    now: Date,
  ): Promise<boolean> {
    await this.prisma.jobState.createMany({
      data: [{ name }],
      skipDuplicates: true,
    });
    const acquired = await this.prisma.jobState.updateMany({
      where: {
        name,
        OR: [
          { leaseExpiresAt: null },
          { leaseExpiresAt: { lt: now } },
          { leaseHolder: this.instanceId },
        ],
      },
      data: {
        leaseHolder: this.instanceId,
        leaseExpiresAt: new Date(now.getTime() + leaseSeconds * 1000),
      },
    });
    return acquired.count === 1;
  }
}
