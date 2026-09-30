import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { AuditService, type AuditContext } from '../audit/audit.service';
import type { Principal } from '../auth/principal';

const DEFAULT_PAGE_SIZE = 20;

const REVIEW_SELECT = {
  id: true,
  rating: true,
  comment: true,
  createdAt: true,
  reviewer: { select: { id: true, fullName: true } },
} satisfies Prisma.ReviewSelect;

type ListingForReview = {
  id: string;
  ownerId: string;
  status: string;
  title: string;
};

// Root CLAUDE.md §2 "Reviews & ratings" / §6 `reviews`. Reviews are about the listing,
// go live immediately (no pending gate), and admin can hide them. Aggregates are
// denormalized onto Listing and recomputed in the same transaction as every change.
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly audit: AuditService,
  ) {}

  // Same visibility rule as ListingsService.findOne(): approved to everyone, anything
  // else only to its owner or an admin — and 404 (not 403) otherwise. `rented` is added
  // for reviews specifically: a rented listing's past tenants/inquirers should still be
  // able to read and leave reviews, it's just off the browse feed.
  private async getVisibleListing(
    userId: string,
    staff: boolean,
    listingId: string,
  ): Promise<ListingForReview> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, ownerId: true, status: true, title: true, deletedAt: true },
    });
    // Archived (deleted) listings: reviews stay readable to staff only (trust & safety).
    const visible =
      listing &&
      (!listing.deletedAt || staff) &&
      (listing.status === 'approved' ||
        listing.status === 'rented' ||
        listing.ownerId === userId ||
        staff);
    if (!visible) throw new NotFoundException('Listing not found');
    return listing;
  }

  // The anti-fake-review gate (root CLAUDE.md §2): you must have actually messaged this
  // listing's owner about this listing. A conversation row alone isn't enough — one is
  // created the moment a seeker taps "Chat with Owner", before they've said anything.
  private async eligibility(userId: string, listing: ListingForReview) {
    if (listing.ownerId === userId)
      return { canReview: false, hasReviewed: false };
    if (listing.status !== 'approved' && listing.status !== 'rented') {
      return { canReview: false, hasReviewed: false };
    }
    const [existing, sentMessage] = await Promise.all([
      this.prisma.review.findUnique({
        where: {
          listingId_reviewerId: { listingId: listing.id, reviewerId: userId },
        },
        select: { id: true },
      }),
      this.prisma.message.findFirst({
        where: {
          senderId: userId,
          conversation: {
            listingId: listing.id,
            seekerId: userId,
            ownerId: listing.ownerId,
          },
        },
        select: { id: true },
      }),
    ]);
    return { canReview: !existing && !!sentMessage, hasReviewed: !!existing };
  }

  async list(
    userId: string,
    staff: boolean,
    listingId: string,
    cursor?: string,
    limit = DEFAULT_PAGE_SIZE,
  ) {
    const listing = await this.getVisibleListing(userId, staff, listingId);

    let cursorWhere: Prisma.ReviewWhereInput = {};
    if (cursor) {
      const c = await this.prisma.review.findUnique({
        where: { id: cursor },
        select: { createdAt: true, id: true },
      });
      if (!c) throw new BadRequestException('Invalid cursor');
      cursorWhere = {
        OR: [
          { createdAt: { lt: c.createdAt } },
          { createdAt: c.createdAt, id: { lt: c.id } },
        ],
      };
    }

    const [rows, viewer] = await Promise.all([
      this.prisma.review.findMany({
        where: { listingId, hidden: false, ...cursorWhere },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        select: REVIEW_SELECT,
      }),
      this.eligibility(userId, listing),
    ]);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
      viewer,
    };
  }

  async create(
    userId: string,
    staff: boolean,
    listingId: string,
    dto: CreateReviewDto,
  ) {
    const listing = await this.getVisibleListing(userId, staff, listingId);
    if (listing.ownerId === userId) {
      throw new BadRequestException("You can't review your own listing");
    }
    const { canReview, hasReviewed } = await this.eligibility(userId, listing);
    if (hasReviewed)
      throw new ConflictException('You have already reviewed this listing');
    if (!canReview) {
      throw new ForbiddenException(
        'Message the owner about this listing before reviewing it',
      );
    }

    const comment = dto.comment?.trim() || null;
    let review: Prisma.ReviewGetPayload<{ select: typeof REVIEW_SELECT }>;
    try {
      review = await this.prisma.$transaction(async (tx) => {
        const created = await tx.review.create({
          data: { listingId, reviewerId: userId, rating: dto.rating, comment },
          select: REVIEW_SELECT,
        });
        await this.recomputeAggregates(tx, listingId);
        return created;
      });
    } catch (e) {
      // Two concurrent submits from the same user both pass eligibility(); the unique
      // (listingId, reviewerId) constraint is the real guard.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('You have already reviewed this listing');
      }
      throw e;
    }

    this.notifyOwner(listing, dto.rating);
    return review;
  }

  // ---------------------------------------------------------------------------
  // Admin moderation — `hidden` is the only lever (no edit, no pending gate).
  // ---------------------------------------------------------------------------

  async adminList(query: { hidden?: boolean; cursor?: string; limit?: number }) {
    const limit = query.limit ?? 50;
    const rows = await this.prisma.review.findMany({
      where: query.hidden === undefined ? {} : { hidden: query.hidden },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: {
        ...REVIEW_SELECT,
        hidden: true,
        listing: { select: { id: true, title: true } },
      },
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return { items, nextCursor: hasMore ? items[items.length - 1]!.id : null };
  }

  // Hide/unhide + aggregate recompute + audit row, all in one transaction.
  async setHidden(principal: Principal, id: string, hidden: boolean, reason: string | undefined, ctx: AuditContext) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.review.findUnique({
        where: { id },
        select: { listingId: true, hidden: true },
      });
      if (!existing) throw new NotFoundException('Review not found');
      const updated = await tx.review.update({
        where: { id },
        data: { hidden },
        select: { ...REVIEW_SELECT, hidden: true },
      });
      await this.recomputeAggregates(tx, existing.listingId);
      await this.audit.record(tx, {
        category: 'admin_action',
        action: hidden ? 'review.hidden' : 'review.unhidden',
        actor: AuditService.actor(principal),
        target: { type: 'review', id },
        reason: reason ?? null,
        before: { hidden: existing.hidden },
        after: { hidden },
        metadata: { listingId: existing.listingId },
        ctx,
      });
      return updated;
    });
  }

  // avgRating stays null (not 0) when there are no visible reviews — clients use that to
  // show the "New listing" badge instead of a rating (root CLAUDE.md §6).
  private async recomputeAggregates(
    tx: Prisma.TransactionClient,
    listingId: string,
  ) {
    const agg = await tx.review.aggregate({
      where: { listingId, hidden: false },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await tx.listing.update({
      where: { id: listingId },
      data: {
        avgRating: agg._count._all
          ? Math.round(agg._avg.rating! * 10) / 10
          : null,
        reviewCount: agg._count._all,
      },
    });
  }

  private notifyOwner(listing: ListingForReview, rating: number): void {
    this.prisma.notification
      .create({
        data: {
          userId: listing.ownerId,
          type: 'new_review',
          payload: { listingId: listing.id, rating },
        },
      })
      .catch(() => {});

    this.push
      .sendToUser(listing.ownerId, {
        title: 'New review',
        body: `Someone rated "${listing.title}" ${rating}★`,
        data: { type: 'new_review', listingId: listing.id },
      })
      .catch(() => {});
  }
}
