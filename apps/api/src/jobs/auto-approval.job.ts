import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { Clock } from '../common/clock';
import { AppSettingsService } from '../app-config/app-settings.service';
import { AlertsService } from '../alerts/alerts.service';
import { ModerationService } from '../moderation/moderation.service';
import { JobRunnerService, type JobResult } from './job-runner.service';

const BATCH = 50;
const BACKLOG_ALERT_SECONDS = 120;

// D-17 5-minute auto-approval, D-47 hold/claim semantics (docs/GHOR-ADMIN-API-AUDIT.md §12).
//
//  * DB-driven: the due time lives in listings.auto_approve_at; nothing is scheduled in
//    memory and no request handler ever waits on a timer — a restart loses nothing.
//  * One runner at a time across instances (JobRunnerService lease), and every approval
//    is a conditional, version-checked update, so a racing admin decision always wins
//    cleanly and a double tick is a no-op (idempotent).
//  * Only an explicit hold or a decision stops it. A claim does not (claim fields are not
//    part of the selection).
//  * Kill switch: app_config auto_approval_enabled (default OFF until the renter-facing
//    "Automatically approved" label ships — see config-registry.ts).
//  * Overdue items after an outage: governed by auto_approval_max_overdue_seconds, an
//    explicit placeholder for open founder decision F-04 (null = approve all overdue).
//  * Verified-owner immediate approval (D-18) is NOT implemented: GHOR Verified does not
//    exist yet (Phase 1).
@Injectable()
export class AutoApprovalJob {
  private readonly logger = new Logger(AutoApprovalJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: AppSettingsService,
    private readonly alerts: AlertsService,
    private readonly moderation: ModerationService,
    private readonly runner: JobRunnerService,
  ) {}

  @Interval('auto-approval', 15_000)
  async scheduled() {
    if (process.env.JOBS_ENABLED === 'false') return;
    await this.runner.run('auto_approval', 60, () => this.tick());
  }

  async tick(): Promise<JobResult> {
    const enabled = await this.settings.get<boolean>('auto_approval_enabled');
    if (!enabled) return { processed: 0, details: { disabled: true } };
    const maxOverdue = await this.settings.get<number | null>(
      'auto_approval_max_overdue_seconds',
    );
    const now = this.clock.now();

    const due = await this.prisma.listing.findMany({
      where: {
        status: 'pending',
        heldAt: null,
        pausedAt: null,
        deletedAt: null,
        autoApproveAt: { lte: now },
      },
      orderBy: { autoApproveAt: 'asc' },
      take: BATCH,
      select: { id: true, version: true },
    });

    const counts = { approved: 0, held: 0, skipped: 0, errors: 0 };
    const errors: { id: string; error: string }[] = [];
    for (const candidate of due) {
      try {
        const outcome = await this.moderation.autoApproveOne(
          candidate,
          now,
          maxOverdue,
        );
        counts[outcome]++;
      } catch (e) {
        counts.errors++;
        errors.push({
          id: candidate.id,
          error: (e as Error).message.slice(0, 200),
        });
      }
    }
    if (counts.errors) {
      this.logger.error(`Auto-approval: ${counts.errors} item(s) failed`);
      await this.alerts.raise(this.prisma, {
        kind: 'auto_approval_item_errors',
        severity: 'warning',
        message: `${counts.errors} listing(s) failed auto-approval and will be retried`,
        dedupeKey: 'auto_approval_item_errors',
        metadata: { errors },
      });
    }

    // Backlog monitor: anything still due 2 minutes later means the job can't keep up
    // (or keeps failing) — surface it on the dashboard.
    const stale = await this.prisma.listing.count({
      where: {
        status: 'pending',
        heldAt: null,
        pausedAt: null,
        deletedAt: null,
        autoApproveAt: {
          lte: new Date(now.getTime() - BACKLOG_ALERT_SECONDS * 1000),
        },
      },
    });
    if (stale > 0) {
      await this.alerts.raise(this.prisma, {
        kind: 'auto_approval_backlog',
        severity: 'warning',
        message: `${stale} listing(s) are more than ${BACKLOG_ALERT_SECONDS / 60} minutes past their auto-approval time`,
        dedupeKey: 'auto_approval_backlog',
      });
    }

    return {
      processed: counts.approved + counts.held,
      details: { ...counts, errors },
    };
  }
}
