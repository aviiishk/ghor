import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';

// Fallback when no `report_threshold` row exists in app_config yet — root CLAUDE.md §6/§14.6
// describes the value as config-editable, not what it defaults to before anyone sets it.
const DEFAULT_REPORT_THRESHOLD = 3;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(reporterId: string, dto: CreateReportDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
      select: { id: true, status: true, ownerId: true },
    });
    // Only listings the reporter can actually see — same 404-not-403 rule as the listing
    // endpoints, so reports can't probe for drafts/pending/rejected listings.
    if (
      !listing ||
      (listing.status !== 'approved' && listing.status !== 'rented')
    ) {
      throw new NotFoundException('Listing not found');
    }
    // Found live while building the first client UI for this endpoint (2026-08-19): no
    // guard existed against an owner reporting their own listing — not exploitable
    // against anyone else, but clearly wrong behavior, and the chat module already has
    // the analogous guard (getOrCreateConversation blocks messaging your own listing).
    if (listing.ownerId === reporterId) {
      throw new BadRequestException('You cannot report your own listing');
    }

    // One open report per person per listing (code review 2026-09-26): otherwise a single
    // account could file `report_threshold` reports and pull any competitor's listing
    // off the feed by itself.
    const existing = await this.prisma.report.findFirst({
      where: { listingId: dto.listingId, reporterId, status: 'pending' },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        "You've already reported this listing — we're reviewing it",
      );
    }

    const report = await this.prisma.report.create({
      data: {
        listingId: dto.listingId,
        reporterId,
        reason: dto.reason,
        reasonCategory: dto.reasonCategory,
      },
    });

    await this.maybeRevertToPending(dto.listingId);
    return report;
  }

  // The Postgres trigger this used to be, pre-pivot (root CLAUDE.md §6's `reports` entry) —
  // now application logic. Only ever reverts a currently-`approved` listing; a report on a
  // draft/pending/already-rejected/rented listing has nothing to "revert" to pending from.
  private async maybeRevertToPending(listingId: string): Promise<void> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { status: true },
    });
    if (!listing || listing.status !== 'approved') return;

    // Distinct reporters, not report rows — belt-and-braces with the per-person check in
    // create(), which a concurrent double-submit could still slip past.
    const [openReporters, config] = await Promise.all([
      this.prisma.report.findMany({
        where: { listingId, status: 'pending' },
        distinct: ['reporterId'],
        select: { reporterId: true },
      }),
      this.prisma.appConfig.findUnique({ where: { key: 'report_threshold' } }),
    ]);
    const threshold =
      typeof config?.value === 'number'
        ? config.value
        : DEFAULT_REPORT_THRESHOLD;

    if (openReporters.length >= threshold) {
      await this.prisma.listing.update({
        where: { id: listingId },
        data: { status: 'pending' },
      });
    }
  }

  // Admin queue — open (`pending`) reports only, oldest first (matches the listings
  // moderation queue's oldest-first convention).
  async findOpen() {
    return this.prisma.report.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      include: {
        listing: {
          select: { id: true, title: true, status: true, ownerId: true },
        },
        reporter: { select: { id: true, fullName: true, phone: true } },
      },
    });
  }

  async resolve(id: string, action: 'dismiss' | 'confirm') {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');

    if (action === 'dismiss') {
      return this.prisma.report.update({
        where: { id },
        data: { status: 'dismissed' },
      });
    }

    // Confirm: mark reviewed and force the listing back to `pending` — an explicit admin
    // override, not gated on the threshold check above (a single confirmed report is
    // reason enough once a human has looked at it).
    return this.prisma.$transaction(async (tx) => {
      await tx.listing.update({
        where: { id: report.listingId },
        data: { status: 'pending' },
      });
      return tx.report.update({ where: { id }, data: { status: 'reviewed' } });
    });
  }
}
