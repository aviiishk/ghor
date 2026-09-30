import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Clock } from '../common/clock';
import { ListingsService } from '../listings/listings.service';

const DAY_MS = 86_400_000;
const CONTENT_FIELDS = [
  'title',
  'description',
  'propertyType',
  'rent',
  'deposit',
  'locality',
  'city',
  'availableFrom',
  'amenities',
  'images',
  'institutionIds',
] as const;

// Extra review-workspace panels (MPB §26.10 / ADM-10) built ONLY from data GHOR already
// has. Where a panel needs data that doesn't exist yet it says so explicitly
// (`available: false` + phase) instead of fabricating anything.
@Injectable()
export class ReviewContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly listings: ListingsService,
  ) {}

  async build(listing: {
    id: string;
    ownerId: string;
    rent: number;
    locality: string;
    city: string;
    propertyType: string;
    images: { cloudinaryUrl: string; position: number }[];
    owner: { createdAt: Date; banned: boolean; phoneVerified: boolean };
  }) {
    const now = this.clock.now();
    const urls = listing.images.map((i) => i.cloudinaryUrl);

    const [duplicates, reportCounts, rejections, otherListings, comparables, insights, changes] =
      await Promise.all([
        // Exact reuse of the same stored photo on another listing. (Perceptual/visual
        // similarity needs image hashing — Phase 1.)
        urls.length
          ? this.prisma.listingImage.findMany({
              where: { cloudinaryUrl: { in: urls }, listingId: { not: listing.id } },
              select: {
                cloudinaryUrl: true,
                listing: { select: { id: true, title: true, ownerId: true, status: true } },
              },
              take: 50,
            })
          : Promise.resolve([]),
        this.prisma.report.groupBy({
          by: ['status'],
          where: { listing: { ownerId: listing.ownerId } },
          _count: { _all: true },
        }),
        this.prisma.moderationDecision.count({
          where: {
            decision: { in: ['reject', 'request_changes', 'post_review_reject'] },
            listingId: {
              in: (
                await this.prisma.listing.findMany({
                  where: { ownerId: listing.ownerId },
                  select: { id: true },
                })
              ).map((l) => l.id),
            },
          },
        }),
        this.prisma.listing.groupBy({
          by: ['status'],
          where: { ownerId: listing.ownerId, id: { not: listing.id }, deletedAt: null },
          _count: { _all: true },
        }),
        this.prisma.listing.findMany({
          where: {
            id: { not: listing.id },
            status: 'approved',
            deletedAt: null,
            propertyType: listing.propertyType as 'room' | 'flat',
            city: listing.city,
            locality: { equals: listing.locality.trim(), mode: 'insensitive' },
          },
          select: { rent: true },
          take: 500,
        }),
        this.listings.getInsights(listing.ownerId, true, listing.id),
        this.changesSinceApproval(listing.id),
      ]);

    const rents = comparables.map((c) => c.rent).sort((a, b) => a - b);
    const median = rents.length
      ? rents.length % 2
        ? rents[(rents.length - 1) / 2]
        : Math.round((rents[rents.length / 2 - 1] + rents[rents.length / 2]) / 2)
      : null;

    return {
      media: {
        photoCount: listing.images.length,
        photos: listing.images.map((i) => ({
          position: i.position,
          url: i.cloudinaryUrl,
          format: /\.([a-z0-9]+)(?:\?|$)/i.exec(i.cloudinaryUrl)?.[1]?.toLowerCase() ?? null,
          cover: i.position === 0,
        })),
        video: { available: false, phase: 'Phase 1 (listing video)' },
        exactDuplicates: duplicates.map((d) => ({
          url: d.cloudinaryUrl,
          listingId: d.listing.id,
          listingTitle: d.listing.title,
          listingStatus: d.listing.status,
          sameOwner: d.listing.ownerId === listing.ownerId,
        })),
        visualSimilarity: { available: false, phase: 'Phase 1 (perceptual photo hashing)' },
      },
      risk: {
        // Facts, not a score. Automated risk scoring/flags are Phase 1 (MPB §13.3).
        ownerAccountAgeDays: Math.floor((now.getTime() - listing.owner.createdAt.getTime()) / DAY_MS),
        ownerBanned: listing.owner.banned,
        ownerPhoneVerified: listing.owner.phoneVerified,
        reportsAgainstOwner: Object.fromEntries(reportCounts.map((r) => [r.status, r._count._all])),
        previousRejectionsForOwner: rejections,
        ownerOtherListings: Object.fromEntries(otherListings.map((r) => [r.status, r._count._all])),
        rentVsLocality: {
          rent: listing.rent,
          comparableApprovedListings: rents.length,
          medianRent: median,
          differencePercent: median ? Math.round(((listing.rent - median) / median) * 100) : null,
        },
        automatedFlags: { available: false, phase: 'Phase 1 (risk flags, MPB §13.3)' },
      },
      ownerPlan: {
        // Every owner is on the free tier today: plans, subscriptions and GHOR Verified
        // don't exist yet (Phase 1–2). Not an assumption about any individual owner.
        plan: 'free',
        ghorVerified: false,
        note: 'Plans and GHOR Verified are not built yet (Phase 1–2); all owners are on the free tier.',
      },
      responseBehaviour: insights.totals,
      changesSinceApproval: changes,
    };
  }

  // Field-level diff between the snapshot taken at the last approval and the latest
  // snapshot (DB-06). null when the listing was never approved or no snapshots exist.
  private async changesSinceApproval(listingId: string) {
    const lastApproval = await this.prisma.moderationDecision.findFirst({
      where: { listingId, decision: { in: ['approve', 'auto_approve', 'post_review_confirm'] } },
      orderBy: { createdAt: 'desc' },
      select: { resultingVersion: true, createdAt: true },
    });
    if (!lastApproval) return null;
    const [approved, latest] = await Promise.all([
      this.prisma.listingSnapshot.findUnique({
        where: { listingId_version: { listingId, version: lastApproval.resultingVersion } },
      }),
      this.prisma.listingSnapshot.findFirst({ where: { listingId }, orderBy: { version: 'desc' } }),
    ]);
    if (!approved || !latest) return null;
    const a = approved.content as Record<string, unknown>;
    const b = latest.content as Record<string, unknown>;
    const changedFields = CONTENT_FIELDS.filter((f) => JSON.stringify(a[f]) !== JSON.stringify(b[f]));
    return {
      approvedVersion: approved.version,
      latestVersion: latest.version,
      approvedAt: lastApproval.createdAt,
      changedFields,
      before: Object.fromEntries(changedFields.map((f) => [f, a[f]])),
      after: Object.fromEntries(changedFields.map((f) => [f, b[f]])),
    };
  }
}
