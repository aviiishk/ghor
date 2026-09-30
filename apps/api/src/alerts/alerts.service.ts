import { Injectable } from '@nestjs/common';
import type { AlertSeverity } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { Db } from '../audit/audit.service';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';

export interface AlertInput {
  kind: string;
  severity: AlertSeverity;
  message: string;
  // When set, at most one open alert exists per key (partial unique index): repeated
  // failures don't flood the dashboard.
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}

// System alerts (dashboard "System alerts", MPB §26.8) and security notifications to admins.
@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async raise(db: Db, alert: AlertInput): Promise<void> {
    const metadata = alert.metadata ? JSON.stringify(alert.metadata) : null;
    await db.$executeRaw`
      INSERT INTO "system_alerts" ("id", "kind", "severity", "message", "dedupe_key", "metadata", "created_at")
      VALUES (${randomUUID()}, ${alert.kind}, ${alert.severity}::"alert_severity", ${alert.message},
              ${alert.dedupeKey ?? null}, ${metadata}::jsonb, now())
      ON CONFLICT ("dedupe_key") WHERE "acknowledged_at" IS NULL AND "dedupe_key" IS NOT NULL
      DO NOTHING`;
  }

  // Security alert (D-47): recovery-code use, break-glass, TOTP reset, refresh-token reuse.
  // Raises a critical/warning system alert AND queues an in-app security notification to
  // the affected admin plus every active super_admin, in the caller's transaction.
  async security(
    db: Db,
    input: {
      kind: string;
      message: string;
      affectedProfileId: string;
      eventId: string;
      severity?: AlertSeverity;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    await this.raise(db, {
      kind: input.kind,
      severity: input.severity ?? 'critical',
      message: input.message,
      metadata: {
        ...input.metadata,
        affectedProfileId: input.affectedProfileId,
      },
    });
    const superAdmins = await db.adminUser.findMany({
      where: { role: 'super_admin', status: 'active' },
      select: { profileId: true },
    });
    const recipients = new Set([
      input.affectedProfileId,
      ...superAdmins.map((s) => s.profileId),
    ]);
    for (const userId of recipients) {
      await this.outbox.enqueue(db, `security:${input.eventId}:${userId}`, {
        topic: 'notify.user',
        payload: {
          userId,
          type: 'security_alert',
          payload: {
            kind: input.kind,
            message: input.message,
            affectedProfileId: input.affectedProfileId,
          },
        },
      });
    }
  }

  async openCount(): Promise<number> {
    return this.prisma.systemAlert.count({ where: { acknowledgedAt: null } });
  }
}
