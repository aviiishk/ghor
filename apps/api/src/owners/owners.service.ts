import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LISTING_INCLUDE } from '../listings/listings.service';

// Below this many recent inquiry threads, response stats are too noisy to show ("0%
// response rate" off one unanswered message would be unfair to a new owner).
const MIN_THREADS_FOR_RESPONSE_STATS = 3;
const RESPONSE_WINDOW_DAYS = 90;
const MAX_THREADS_SAMPLED = 50;

// Root CLAUDE.md §2 "Owner profile page" — the Airbnb host-profile analog. Pure reads
// over existing profiles/listings/messages; no schema change. Response stats are computed
// live; CLAUDE.md §2 says to denormalize onto profiles once volume makes this slow.
@Injectable()
export class OwnersService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnerProfile(ownerId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: ownerId },
      // Public fields only — never phone (that's revealed per-listing on the Call
      // action) and never idDocumentUrl (root CLAUDE.md §6).
      select: {
        id: true,
        fullName: true,
        role: true,
        banned: true,
        createdAt: true,
        phoneVerified: true,
        lastActiveAt: true,
        idVerificationStatus: true,
      },
    });
    // Banned owners and people who have never listed anything aren't browsable "hosts".
    if (!profile || profile.banned)
      throw new NotFoundException('Owner not found');

    const [listings, ratedListings, responseStats] = await Promise.all([
      this.prisma.listing.findMany({
        where: { ownerId, status: 'approved' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: LISTING_INCLUDE,
      }),
      // Rented listings still carry real reviews — include them in the reputation.
      this.prisma.listing.findMany({
        where: {
          ownerId,
          status: { in: ['approved', 'rented'] },
          reviewCount: { gt: 0 },
        },
        select: { avgRating: true, reviewCount: true },
      }),
      this.responseStats(ownerId),
    ]);

    if (
      !listings.length &&
      profile.role !== 'owner' &&
      profile.role !== 'admin'
    ) {
      throw new NotFoundException('Owner not found');
    }

    // An owner's rating is the aggregate of their listings' reviews (root CLAUDE.md §2 —
    // not a second, parallel owner-rating system), weighted by each listing's count.
    const reviewCount = ratedListings.reduce((n, l) => n + l.reviewCount, 0);
    const avgRating = reviewCount
      ? Math.round(
          (ratedListings.reduce(
            (sum, l) => sum + (l.avgRating ?? 0) * l.reviewCount,
            0,
          ) /
            reviewCount) *
            10,
        ) / 10
      : null;

    return {
      id: profile.id,
      fullName: profile.fullName,
      createdAt: profile.createdAt,
      phoneVerified: profile.phoneVerified,
      lastActiveAt: profile.lastActiveAt,
      idVerificationStatus: profile.idVerificationStatus,
      avgRating,
      reviewCount,
      ...responseStats,
      listings,
    };
  }

  // Per inquiry thread in the window: did the owner reply after the seeker's first
  // message, and how long did that first reply take? Rate = replied / threads;
  // time = median minutes to first reply (median, so one slow weekend doesn't dominate).
  private async responseStats(ownerId: string) {
    const since = new Date(Date.now() - RESPONSE_WINDOW_DAYS * 86_400_000);
    const threads = await this.prisma.conversation.findMany({
      where: { ownerId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: MAX_THREADS_SAMPLED,
      select: {
        seekerId: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 30,
          select: { senderId: true, createdAt: true },
        },
      },
    });

    let inquiries = 0;
    let replied = 0;
    const delaysMin: number[] = [];
    for (const t of threads) {
      const firstSeeker = t.messages.find((m) => m.senderId === t.seekerId);
      if (!firstSeeker) continue; // opened chat, never said anything — not an inquiry
      inquiries++;
      const reply = t.messages.find(
        (m) => m.senderId === ownerId && m.createdAt > firstSeeker.createdAt,
      );
      if (reply) {
        replied++;
        delaysMin.push(
          (reply.createdAt.getTime() - firstSeeker.createdAt.getTime()) /
            60_000,
        );
      }
    }

    if (inquiries < MIN_THREADS_FOR_RESPONSE_STATS) {
      return { responseRate: null, responseTimeMinutes: null };
    }
    delaysMin.sort((a, b) => a - b);
    const mid = Math.floor(delaysMin.length / 2);
    const median = !delaysMin.length
      ? null
      : delaysMin.length % 2
        ? delaysMin[mid]
        : (delaysMin[mid - 1] + delaysMin[mid]) / 2;
    return {
      responseRate: Math.round((replied / inquiries) * 100),
      responseTimeMinutes: median == null ? null : Math.round(median),
    };
  }
}
