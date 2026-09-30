import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  type AuditActorType,
  type AuditCategory,
} from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  clientIp,
  hashIp,
  userAgent,
  type GhorRequest,
} from '../common/request-context';
import {
  actorProfileId,
  actorRoleLabel,
  type Principal,
} from '../auth/principal';

export type Db = PrismaService | Prisma.TransactionClient;

export interface AuditActor {
  type: AuditActorType;
  id?: string | null;
  role?: string | null;
}

export interface AuditContext {
  requestId?: string;
  sessionId?: string;
  ipHash?: string;
  userAgent?: string;
}

export interface AuditEntry {
  category: AuditCategory;
  action: string;
  actor: AuditActor;
  target?: { type: string; id: string };
  reason?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  ctx?: AuditContext;
}

export const SYSTEM_ACTOR = (job: string): AuditActor => ({
  type: 'system',
  id: null,
  role: job,
});

// Audit log writer (docs/GHOR-ADMIN-API-AUDIT.md §15).
//
// Transaction boundary — the rule every caller follows:
//  * State-changing admin actions call record(tx, …) with the SAME transaction client
//    that performs the change, after the change succeeded. If the audit insert fails the
//    transaction rolls back: no change without its audit row, no audit row for a change
//    that didn't happen.
//  * Security events that have no state change of their own (failed logins, denied
//    attempts) use recordStandalone(), which never throws into the caller.
// There is deliberately no update or delete method here; the table is also protected by a
// database trigger (migration 20260929120000_phase0_admin_foundation).
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(db: Db, entry: AuditEntry): Promise<void> {
    await db.auditLog.create({ data: this.toData(entry) });
  }

  async recordStandalone(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({ data: this.toData(entry) });
    } catch (e) {
      // Must never mask the real outcome for the caller, but must never be silent either.
      this.logger.error(
        `Failed to write audit event ${entry.action}: ${(e as Error).message}`,
      );
    }
  }

  static actor(principal: Principal): AuditActor {
    return {
      type: principal.kind === 'user' ? 'user' : 'admin',
      id: actorProfileId(principal),
      role: actorRoleLabel(principal),
    };
  }

  static context(req: Request, principal?: Principal): AuditContext {
    return {
      requestId: (req as GhorRequest).requestId,
      sessionId:
        principal && principal.kind !== 'user'
          ? principal.sessionId
          : undefined,
      ipHash: hashIp(clientIp(req)),
      userAgent: userAgent(req),
    };
  }

  private toData(entry: AuditEntry): Prisma.AuditLogCreateInput {
    const json = (v: unknown) =>
      v === undefined
        ? undefined
        : v === null
          ? Prisma.JsonNull
          : (v as Prisma.InputJsonValue);
    return {
      category: entry.category,
      action: entry.action,
      actorType: entry.actor.type,
      actorId: entry.actor.id ?? null,
      actorRole: entry.actor.role ?? null,
      targetType: entry.target?.type ?? null,
      targetId: entry.target?.id ?? null,
      reason: entry.reason ?? null,
      before: json(entry.before),
      after: json(entry.after),
      metadata: json(entry.metadata),
      sessionId: entry.ctx?.sessionId ?? null,
      requestId: entry.ctx?.requestId ?? null,
      ipHash: entry.ctx?.ipHash ?? null,
      userAgent: entry.ctx?.userAgent ?? null,
    };
  }
}

// Phone numbers never go into audit rows in clear text.
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  return phone.length <= 4
    ? '****'
    : `${phone.slice(0, 3)}******${phone.slice(-2)}`;
}
