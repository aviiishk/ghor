import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Clock } from '../common/clock';
import { AppSettingsService } from '../app-config/app-settings.service';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { auditScopeFor } from '../permissions/permissions';
import type { AdminPrincipal } from '../auth/principal';
import type { AuditExportDto, AuditQueryDto, RangeQueryDto } from './admin.dto';

const EXPORT_MAX_ROWS = 5000;
const JOB_STALE_SECONDS: Record<string, number> = {
  auto_approval: 120,
  outbox: 120,
  maintenance: 3600,
};

// Read-side of the admin console: dashboard, analytics, audit viewer/export, system
// health, trust status. Everything here is aggregate or masked — no verification documents,
// no chat content, no raw phone numbers.
@Injectable()
export class AdminReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: AppSettingsService,
    private readonly audit: AuditService,
  ) {}

  // "What needs GHOR's attention right now?" (MPB §26.8). Real counts only. Archived
  // (owner-deleted) listings are excluded everywhere. There is no verified-owner track yet
  // (GHOR Verified is Phase 1), so every pending listing is a free-owner listing and the
  // verified track is reported as unavailable rather than as zero.
  async dashboard() {
    const now = this.clock.now();
    const soon = new Date(now.getTime() + 2 * 60 * 1000);
    const live = { deletedAt: null };
    const [
      pending,
      held,
      heldByReason,
      approachingAutoApproval,
      postReview,
      paused,
      openReports,
      listingsWithOpenReports,
      oldestPending,
      oldestReport,
      openAlerts,
      criticalAlerts,
      jobs,
      outboxBacklog,
      autoApprovalEnabled,
      recentDecisions,
    ] = await Promise.all([
      this.prisma.listing.count({ where: { ...live, status: 'pending', heldAt: null } }),
      this.prisma.listing.count({ where: { ...live, status: 'pending', heldAt: { not: null } } }),
      this.prisma.listing.groupBy({
        by: ['holdReason'],
        where: { ...live, status: 'pending', heldAt: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.listing.count({
        where: { ...live, status: 'pending', heldAt: null, autoApproveAt: { lte: soon } },
      }),
      this.prisma.listing.count({
        where: { ...live, status: 'approved', postReviewStatus: { in: ['pending', 'escalated'] } },
      }),
      this.prisma.listing.count({ where: { ...live, pausedAt: { not: null } } }),
      this.prisma.report.count({ where: { status: 'pending' } }),
      this.prisma.report.groupBy({ by: ['listingId'], where: { status: 'pending' } }),
      this.prisma.listing.findFirst({
        where: { ...live, status: 'pending' },
        orderBy: { submittedAt: 'asc' },
        select: { submittedAt: true },
      }),
      this.prisma.report.findFirst({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      this.prisma.systemAlert.count({ where: { acknowledgedAt: null } }),
      this.prisma.systemAlert.count({ where: { acknowledgedAt: null, severity: 'critical' } }),
      this.prisma.jobState.findMany({ select: { name: true, lastSuccessAt: true, consecutiveFailures: true } }),
      this.prisma.outboxEvent.count({ where: { processedAt: null } }),
      this.settings.get<boolean>('auto_approval_enabled'),
      this.prisma.moderationDecision.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          listingId: true,
          decision: true,
          actorType: true,
          reasonCodes: true,
          createdAt: true,
        },
      }),
    ]);
    const titles = await this.prisma.listing.findMany({
      where: { id: { in: recentDecisions.map((d) => d.listingId) } },
      select: { id: true, title: true },
    });
    const titleById = new Map(titles.map((t) => [t.id, t.title]));
    const ageSeconds = (d: Date | null | undefined) =>
      d ? Math.round((now.getTime() - d.getTime()) / 1000) : null;
    return {
      generatedAt: now,
      queues: {
        pendingReview: pending,
        held,
        approachingAutoApproval,
        awaitingPostReview: postReview,
        paused,
        openReports,
        oldestPendingAgeSeconds: ageSeconds(oldestPending?.submittedAt),
        oldestReportAgeSeconds: ageSeconds(oldestReport?.createdAt),
      },
      ownerTracks: {
        freeOwner: { available: true, pendingReview: pending },
        verifiedOwner: {
          available: false,
          note: 'GHOR Verified does not exist yet (Phase 1). No verified-owner queue.',
        },
      },
      highRisk: {
        // "High risk" in Phase 0 = what the system can actually see: holds (reports
        // threshold, confirmed reports, failed safeguards, overdue backlog) and live
        // listings with open reports. Automated risk flags are Phase 1.
        heldByReason: Object.fromEntries(heldByReason.map((h) => [h.holdReason ?? 'manual', h._count._all])),
        listingsWithOpenReports: listingsWithOpenReports.length,
      },
      recentModeration: recentDecisions.map((d) => ({
        ...d,
        listingTitle: titleById.get(d.listingId) ?? null,
      })),
      system: {
        openAlerts,
        criticalAlerts,
        outboxBacklog,
        jobs: jobs.map((j) => ({
          name: j.name,
          lastSuccessAt: j.lastSuccessAt,
          consecutiveFailures: j.consecutiveFailures,
        })),
      },
      autoApproval: {
        enabled: autoApprovalEnabled,
        lastSuccessAt: jobs.find((j) => j.name === 'auto_approval')?.lastSuccessAt ?? null,
      },
      openAlerts,
    };
  }

  // Daily moderation / report trends for the analytics page (IST calendar days). Built
  // from records that already exist; days before Phase 0 simply have no decision rows.
  async trends(daysInput: number) {
    const days = Math.min(Math.max(Math.trunc(daysInput) || 30, 7), 90);
    const since = new Date(this.clock.now().getTime() - days * 86_400_000);
    const [decisions, reports, submissions, approvals] = await Promise.all([
      this.prisma.$queryRaw<{ day: string; decision: string; n: number }[]>`
        SELECT to_char(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day,
               decision::text AS decision, count(*)::int AS n
        FROM moderation_decisions WHERE created_at >= ${since}
        GROUP BY 1, 2`,
      this.prisma.$queryRaw<{ day: string; n: number }[]>`
        SELECT to_char(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day, count(*)::int AS n
        FROM reports WHERE created_at >= ${since} GROUP BY 1`,
      this.prisma.$queryRaw<{ day: string; n: number }[]>`
        SELECT to_char(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day, count(*)::int AS n
        FROM audit_log WHERE action = 'listing.submitted' AND created_at >= ${since} GROUP BY 1`,
      // Minutes from (last) submission to approval, for listings approved in the window.
      this.prisma.$queryRaw<{ day: string; median_minutes: number | null; n: number }[]>`
        SELECT to_char(approved_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day,
               percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM approved_at - submitted_at) / 60)::float AS median_minutes,
               count(*)::int AS n
        FROM listings
        WHERE approved_at >= ${since} AND submitted_at IS NOT NULL AND approved_at >= submitted_at
        GROUP BY 1`,
    ]);

    const series: {
      date: string;
      submitted: number;
      approved: number;
      autoApproved: number;
      rejected: number;
      held: number;
      reports: number;
      medianApprovalMinutes: number | null;
    }[] = [];
    const index = new Map<string, (typeof series)[number]>();
    const IST_MS = 330 * 60_000;
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(this.clock.now().getTime() + IST_MS - i * 86_400_000).toISOString().slice(0, 10);
      const row = { date, submitted: 0, approved: 0, autoApproved: 0, rejected: 0, held: 0, reports: 0, medianApprovalMinutes: null };
      series.push(row);
      index.set(date, row);
    }
    for (const d of decisions) {
      const row = index.get(d.day);
      if (!row) continue;
      if (d.decision === 'approve') row.approved += d.n;
      else if (d.decision === 'auto_approve') row.autoApproved += d.n;
      else if (['reject', 'request_changes', 'post_review_reject'].includes(d.decision)) row.rejected += d.n;
      else if (['hold', 'system_hold'].includes(d.decision)) row.held += d.n;
    }
    for (const r of reports) {
      const row = index.get(r.day);
      if (row) row.reports = r.n;
    }
    for (const r of submissions) {
      const row = index.get(r.day);
      if (row) row.submitted = r.n;
    }
    for (const a of approvals) {
      const row = index.get(a.day);
      if (row && a.median_minutes !== null) row.medianApprovalMinutes = Math.round(a.median_minutes * 10) / 10;
    }
    return { days, series };
  }

  async analytics(range: RangeQueryDto) {
    const createdAt = this.range(range);
    const count = (eventName: string) =>
      this.prisma.event.count({
        where: { eventName, ...(createdAt ? { createdAt } : {}) },
      });
    const [
      signups,
      listingViews,
      contactTaps,
      chatStarted,
      listingsCreated,
      totalUsers,
      totalListings,
      pendingListings,
      openReports,
    ] = await Promise.all([
      count('signup'),
      count('listing_view'),
      count('contact_tap'),
      count('chat_started'),
      count('listing_created'),
      this.prisma.profile.count(),
      this.prisma.listing.count(),
      this.prisma.listing.count({ where: { status: 'pending' } }),
      this.prisma.report.count({ where: { status: 'pending' } }),
    ]);
    const decisions = await this.prisma.moderationDecision.groupBy({
      by: ['decision'],
      where: createdAt ? { createdAt } : {},
      _count: { _all: true },
    });
    return {
      range: { from: range.from ?? null, to: range.to ?? null },
      funnel: {
        signups,
        listingViews,
        contactTaps,
        chatStarted,
        listingsCreated,
      },
      totals: { totalUsers, totalListings, pendingListings, openReports },
      moderation: Object.fromEntries(
        decisions.map((d) => [d.decision, d._count._all]),
      ),
    };
  }

  // Audit visibility (MPB §26.5): admin → own actions; senior_reviewer → own + trust
  // (verification/badge) actions; super_admin → everything.
  async auditLog(principal: AdminPrincipal, query: AuditQueryDto) {
    const limit = query.limit ?? 50;
    const where: Prisma.AuditLogWhereInput = {
      AND: [this.scopeFilter(principal), this.filters(query)],
    };
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      scope: auditScopeFor(principal.role),
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  // Export is itself a data-access event, recorded BEFORE the data is returned (audit §15
  // rule 3): if the audit write fails, nothing is exported.
  async exportAudit(
    principal: AdminPrincipal,
    dto: AuditExportDto,
    ctx: AuditContext,
  ) {
    const from = new Date(dto.from);
    const to = new Date(dto.to);
    if (!(from < to))
      throw new BadRequestException('"from" must be before "to"');
    const where: Prisma.AuditLogWhereInput = {
      createdAt: { gte: from, lt: to },
      ...(dto.category ? { category: dto.category } : {}),
    };
    const total = await this.prisma.auditLog.count({ where });
    if (total > EXPORT_MAX_ROWS) {
      throw new BadRequestException({
        message: `Range has ${total} rows; narrow it to at most ${EXPORT_MAX_ROWS}`,
        code: 'EXPORT_TOO_LARGE',
      });
    }
    await this.audit.record(this.prisma, {
      category: 'data_access',
      action: 'audit.exported',
      actor: AuditService.actor(principal),
      reason: dto.reason,
      metadata: {
        from: dto.from,
        to: dto.to,
        category: dto.category ?? null,
        rows: total,
      },
      ctx,
    });
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
    return { exportedAt: this.clock.now(), rows };
  }

  async systemHealth() {
    const now = this.clock.now();
    const t0 = Date.now();
    let database: { ok: boolean; latencyMs: number | null };
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = { ok: true, latencyMs: Date.now() - t0 };
    } catch {
      database = { ok: false, latencyMs: null };
    }
    const [jobs, outboxBacklog, oldestOutbox, deadLetters, alerts] =
      await Promise.all([
        this.prisma.jobState.findMany({ orderBy: { name: 'asc' } }),
        this.prisma.outboxEvent.count({ where: { processedAt: null } }),
        this.prisma.outboxEvent.findFirst({
          where: { processedAt: null },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        }),
        this.prisma.outboxEvent.count({
          where: {
            processedAt: { not: null },
            lastError: { not: null },
            attempts: { gte: 8 },
          },
        }),
        this.prisma.systemAlert.findMany({
          where: { acknowledgedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      ]);
    return {
      checkedAt: now,
      database,
      jobsEnabled: process.env.JOBS_ENABLED !== 'false',
      jobs: jobs.map((j) => ({
        name: j.name,
        lastRunAt: j.lastRunAt,
        lastSuccessAt: j.lastSuccessAt,
        consecutiveFailures: j.consecutiveFailures,
        lastError: j.lastError,
        stale:
          !j.lastSuccessAt ||
          now.getTime() - j.lastSuccessAt.getTime() >
            (JOB_STALE_SECONDS[j.name] ?? 600) * 1000,
      })),
      outbox: {
        backlog: outboxBacklog,
        oldestAgeSeconds: oldestOutbox
          ? Math.round(
              (now.getTime() - oldestOutbox.createdAt.getTime()) / 1000,
            )
          : null,
        deadLetters,
      },
      alerts,
    };
  }

  async acknowledgeAlert(
    principal: AdminPrincipal,
    id: string,
    note: string | undefined,
    ctx: AuditContext,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const res = await tx.systemAlert.updateMany({
        where: { id, acknowledgedAt: null },
        data: {
          acknowledgedAt: this.clock.now(),
          acknowledgedById: principal.profileId,
          ackNote: note ?? null,
        },
      });
      if (res.count !== 1) {
        const exists = await tx.systemAlert.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!exists) throw new NotFoundException('Alert not found');
        throw new ConflictException({
          message: 'Alert already acknowledged',
          code: 'ALREADY_ACKNOWLEDGED',
        });
      }
      await this.audit.record(tx, {
        category: 'admin_action',
        action: 'system.alert_acknowledged',
        actor: AuditService.actor(principal),
        target: { type: 'system_alert', id },
        reason: note ?? null,
        ctx,
      });
      return tx.systemAlert.findUniqueOrThrow({ where: { id } });
    });
  }

  // Trust (verification) STATUS only — no documents, no evidence URLs. Evidence access is
  // Phase 1 and will be a separate step-up + evidence-access-audited endpoint.
  async verificationStatuses(query: { cursor?: string; limit?: number }) {
    const limit = query.limit ?? 50;
    const rows = await this.prisma.profile.findMany({
      where: { idVerificationStatus: { not: 'none' } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        fullName: true,
        idVerificationStatus: true,
        createdAt: true,
      },
    });
    const counts = await this.prisma.profile.groupBy({
      by: ['idVerificationStatus'],
      _count: { _all: true },
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      counts: Object.fromEntries(
        counts.map((c) => [c.idVerificationStatus, c._count._all]),
      ),
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  private scopeFilter(principal: AdminPrincipal): Prisma.AuditLogWhereInput {
    const scope = auditScopeFor(principal.role);
    if (scope === 'all') return {};
    const own: Prisma.AuditLogWhereInput = { actorId: principal.profileId };
    if (scope === 'own') return own;
    return {
      OR: [
        own,
        { action: { startsWith: 'verification.' } },
        { action: { startsWith: 'badge.' } },
      ],
    };
  }

  private filters(q: AuditQueryDto): Prisma.AuditLogWhereInput {
    const createdAt = this.range(q);
    return {
      ...(q.actorId ? { actorId: q.actorId } : {}),
      ...(q.action ? { action: { startsWith: q.action } } : {}),
      ...(q.targetType ? { targetType: q.targetType } : {}),
      ...(q.targetId ? { targetId: q.targetId } : {}),
      ...(q.category ? { category: q.category } : {}),
      ...(createdAt ? { createdAt } : {}),
    };
  }

  private range(r: {
    from?: string;
    to?: string;
  }): { gte?: Date; lt?: Date } | null {
    if (!r.from && !r.to) return null;
    return {
      ...(r.from ? { gte: new Date(r.from) } : {}),
      ...(r.to ? { lt: new Date(r.to) } : {}),
    };
  }
}
