import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Clock } from '../common/clock';
import { CreateReportDto } from './dto/create-report.dto';
import { AppSettingsService } from '../app-config/app-settings.service';
import { AuditService, SYSTEM_ACTOR, type AuditContext } from '../audit/audit.service';
import { ModerationService } from '../moderation/moderation.service';
import { actorProfileId, type Principal } from '../auth/principal';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: AppSettingsService,
    private readonly audit: AuditService,
    private readonly moderation: ModerationService,
  ) {}

  async create(reporterId: string, dto: CreateReportDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
      select: { id: true, status: true, ownerId: true, pausedAt: true, deletedAt: true },
    });
    // Only listings the reporter can actually see — same 404-not-403 rule as the listing
    // endpoints, so reports can't probe for drafts/pending/rejected/paused listings.
    if (!listing || (listing.status !== 'approved' && listing.status !== 'rented') || listing.pausedAt || listing.deletedAt) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.ownerId === reporterId) {
      throw new BadRequestException('You cannot report your own listing');
    }

    return this.prisma.$transaction(async (tx) => {
      // One open report per person per listing (code review 2026-09-26), now also enforced
      // atomically by a partial unique index (reports_one_open_per_reporter).
      const existing = await tx.report.findFirst({
        where: { listingId: dto.listingId, reporterId, status: 'pending' },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException("You've already reported this listing — we're reviewing it");
      }
      const report = await tx.report.create({
        data: { listingId: dto.listingId, reporterId, reason: dto.reason, reasonCategory: dto.reasonCategory },
      });
      await this.maybeHoldForReports(tx, dto.listingId);
      return report;
    });
  }

  // The Postgres trigger this used to be, pre-pivot — now application logic. When distinct
  // open reporters reach report_threshold, a LIVE listing goes back to review AND is held,
  // so the 5-minute auto-approval can never put a reported listing straight back online.
  private async maybeHoldForReports(tx: Prisma.TransactionClient, listingId: string): Promise<void> {
    const threshold = await this.settings.get<number>('report_threshold', tx);
    const openReporters = await tx.report.findMany({
      where: { listingId, status: 'pending' },
      distinct: ['reporterId'],
      select: { reporterId: true },
    });
    if (openReporters.length >= threshold) {
      await this.moderation.holdForReports(tx, listingId, 'reports_threshold', SYSTEM_ACTOR('report_threshold'), null);
    }
  }

  // Admin queue — open reports, oldest first, cursor-paginated. Reporter identity is
  // shown by name only (no phone number, audit T-26).
  async listForAdmin(query: { status?: 'pending' | 'reviewed' | 'dismissed'; category?: string; cursor?: string; limit?: number }) {
    const limit = query.limit ?? 50;
    const where: Prisma.ReportWhereInput = { status: query.status ?? 'pending' };
    if (query.category) where.reasonCategory = query.category as Prisma.ReportWhereInput['reasonCategory'];
    const rows = await this.prisma.report.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: {
        listing: { select: { id: true, title: true, status: true, ownerId: true, version: true, pausedAt: true, heldAt: true } },
        reporter: { select: { id: true, fullName: true } },
      },
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return { items, nextCursor: hasMore ? items[items.length - 1]!.id : null };
  }

  // dismiss: report closed, listing untouched.
  // confirm: report closed as reviewed; the listing is held for human re-review ONLY if it
  //   is live (approved → pending+held) or awaiting review (pending → held). A rejected,
  //   rented, draft or paused listing is never moved back to pending (audit §18 bug).
  async resolve(principal: Principal, id: string, input: { action: 'dismiss' | 'confirm'; note?: string }, ctx: AuditContext) {
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.report.findUnique({ where: { id } });
      if (!report) throw new NotFoundException('Report not found');
      const resolved = await tx.report.updateMany({
        where: { id, status: 'pending' },
        data: {
          status: input.action === 'dismiss' ? 'dismissed' : 'reviewed',
          resolvedById: actorProfileId(principal),
          resolvedAt: this.clock.now(),
          resolutionNote: input.note ?? null,
        },
      });
      if (resolved.count !== 1) {
        throw new ConflictException({ message: 'This report has already been resolved', code: 'REPORT_ALREADY_RESOLVED' });
      }
      let listingHeld = false;
      if (input.action === 'confirm') {
        const r = await this.moderation.holdForReports(
          tx,
          report.listingId,
          'report_confirmed',
          AuditService.actor(principal),
          actorProfileId(principal),
          ctx,
        );
        listingHeld = r.changed;
      }
      await this.audit.record(tx, {
        category: 'admin_action',
        action: input.action === 'dismiss' ? 'report.dismissed' : 'report.confirmed',
        actor: AuditService.actor(principal),
        target: { type: 'report', id },
        reason: input.note ?? null,
        before: { status: report.status },
        after: { status: input.action === 'dismiss' ? 'dismissed' : 'reviewed', listingHeld },
        metadata: { listingId: report.listingId },
        ctx,
      });
      return tx.report.findUniqueOrThrow({ where: { id } }).then((r) => ({ ...r, listingHeld }));
    });
  }
}
