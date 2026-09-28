import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { EventsService } from '../events/events.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { BrowseListingsDto } from './dto/browse-listings.dto';

const OWNER_CARD_SELECT = {
  id: true,
  fullName: true,
  phoneVerified: true,
  lastActiveAt: true,
  idVerificationStatus: true,
} satisfies Prisma.ProfileSelect;

// Exported for OwnersService's owner-profile listing grid — same card shape everywhere.
export const LISTING_INCLUDE = {
  images: { orderBy: { position: 'asc' as const } },
  institutions: { include: { institution: true } },
  owner: { select: OWNER_CARD_SELECT },
} satisfies Prisma.ListingInclude;

const MAP_PIN_LIMIT = 500;

// Deterministic ~±150m offset per listing. Every listing in one locality geocodes to the
// same suburb centroid, so without this their pins would stack exactly on top of each
// other; it also keeps map positions honestly approximate (the privacy policy promises
// "approximate map coordinates"). Derived from the id, so a pin never jumps between loads.
function jitter(id: string, lat: number, lng: number) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = ((h >>> 0) % 10000) / 10000; // [0, 1)
  const b = ((Math.imul(h, 2654435761) >>> 0) % 10000) / 10000;
  const angle = a * 2 * Math.PI;
  const radiusDeg = 0.0005 + b * 0.0009; // ~55m–155m
  return {
    lat: lat + radiusDeg * Math.sin(angle),
    lng: lng + (radiusDeg * Math.cos(angle)) / Math.cos((lat * Math.PI) / 180),
  };
}

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly geocoding: GeocodingService,
    private readonly events: EventsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Create (always starts as `draft` — root CLAUDE.md §6: "force to pending" only
  // fires on the owner's explicit publish action, never on insert.)
  // ---------------------------------------------------------------------------

  async create(ownerId: string, dto: CreateListingDto) {
    if (dto.institutionIds?.length) {
      await this.assertInstitutionsExist(dto.institutionIds);
    }

    const created = await this.prisma.listing.create({
      data: {
        ownerId,
        title: dto.title,
        description: dto.description,
        propertyType: dto.propertyType,
        rent: dto.rent,
        deposit: dto.deposit,
        locality: dto.locality,
        city: dto.city ?? 'Guwahati',
        availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : undefined,
        amenities: (dto.amenities ?? {}) as Prisma.InputJsonValue,
        status: 'draft',
        images: dto.images?.length
          ? {
              create: dto.images.map((img) => ({
                cloudinaryUrl: img.cloudinaryUrl,
                position: img.position,
              })),
            }
          : undefined,
        institutions: dto.institutionIds?.length
          ? { create: dto.institutionIds.map((institutionId) => ({ institutionId })) }
          : undefined,
      },
      include: LISTING_INCLUDE,
    });
    this.geocodeInBackground(created.id, created.locality, created.city, created.state);
    this.events.record(ownerId, 'listing_created', { listingId: created.id });
    return created;
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async findMine(ownerId: string) {
    return this.prisma.listing.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
      include: LISTING_INCLUDE,
    });
  }

  async findOne(userId: string, role: string, id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: { ...LISTING_INCLUDE, owner: { select: { ...OWNER_CARD_SELECT, phone: true } } },
    });
    // 404, not 403, for a listing that exists but isn't visible — doesn't confirm
    // existence of someone else's draft/pending/rejected listing to a random caller.
    if (!listing) throw new NotFoundException('Listing not found');

    const isOwner = listing.ownerId === userId;
    const canView = listing.status === 'approved' || isOwner || role === 'admin';
    if (!canView) throw new NotFoundException('Listing not found');

    if (!isOwner) {
      // Fire-and-forget — trust signal ("X people viewed this today", root CLAUDE.md §2).
      // An owner viewing their own listing doesn't count as a view.
      this.events.record(userId, 'listing_view', { listingId: id });
    }

    return listing;
  }

  // ---------------------------------------------------------------------------
  // Browse feed — cursor-paginated, approved-only, root CLAUDE.md §14.3/§14.4.
  // ---------------------------------------------------------------------------

  async findApproved(query: BrowseListingsDto) {
    const limit = query.limit ?? 20;
    const where = this.buildBrowseWhere(query);

    const orderBy: Prisma.ListingOrderByWithRelationInput[] =
      query.sort === 'price_asc'
        ? [{ rent: 'asc' }, { id: 'asc' }]
        : query.sort === 'price_desc'
          ? [{ rent: 'desc' }, { id: 'asc' }]
          : [{ createdAt: 'desc' }, { id: 'desc' }];

    const rows = await this.prisma.listing.findMany({
      where,
      orderBy,
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: LISTING_INCLUDE,
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]!.id : null,
    };
  }

  // Shared by the list feed and the map so both views always show the same filtered set.
  private buildBrowseWhere(query: BrowseListingsDto): Prisma.ListingWhereInput {
    const where: Prisma.ListingWhereInput = {
      status: 'approved',
      city: query.city ?? 'Guwahati',
    };
    if (query.propertyType) where.propertyType = query.propertyType;
    const q = query.q?.trim();
    const textFilters: Prisma.ListingWhereInput[] = [];
    if (q) {
      textFilters.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { locality: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    const locality = query.locality?.trim();
    if (locality) {
      textFilters.push({ locality: { contains: locality, mode: 'insensitive' } });
    }
    if (query.rentMin !== undefined || query.rentMax !== undefined) {
      where.rent = {
        ...(query.rentMin !== undefined ? { gte: query.rentMin } : {}),
        ...(query.rentMax !== undefined ? { lte: query.rentMax } : {}),
      };
    }
    if (query.amenities) {
      const keys = query.amenities.split(',').map((k) => k.trim()).filter(Boolean);
      where.AND = keys.map((key) => ({
        amenities: { path: [key], equals: true },
      })) as Prisma.ListingWhereInput[];
    }
    if (query.institutionIds) {
      const ids = query.institutionIds.split(',').map((id) => id.trim()).filter(Boolean);
      if (ids.length) {
        where.institutions = { some: { institutionId: { in: ids } } };
      }
    }
    if (textFilters.length) {
      where.AND = [...((where.AND as Prisma.ListingWhereInput[] | undefined) ?? []), ...textFilters];
    }
    return where;
  }

  // ---------------------------------------------------------------------------
  // Popular areas — real counts of live listings per locality (case/whitespace-folded),
  // with the lowest rent in each. Powers the browse page's area chips; returns [] until
  // there are listings, so the UI never shows invented areas.
  // ---------------------------------------------------------------------------

  // Same lookup create/update runs (listings are Guwahati-only at launch, root CLAUDE.md
  // §2), so the owner's preview matches what renters will see. Never throws.
  async geocodePreview(locality: string) {
    if (locality.length < 2) return null;
    return this.geocoding.geocode(locality, 'Guwahati', 'Assam');
  }

  async popularLocalities(city = 'Guwahati', limit = 8) {
    const rows = await this.prisma.listing.findMany({
      where: { status: 'approved', city },
      select: { locality: true, rent: true },
      take: 2000,
    });
    const byArea = new Map<string, { locality: string; count: number; minRent: number }>();
    for (const r of rows) {
      const key = r.locality.trim().toLowerCase();
      const cur = byArea.get(key);
      if (cur) {
        cur.count++;
        cur.minRent = Math.min(cur.minRent, r.rent);
      } else {
        byArea.set(key, { locality: r.locality.trim(), count: 1, minRent: r.rent });
      }
    }
    return [...byArea.values()].sort((a, b) => b.count - a.count || a.locality.localeCompare(b.locality)).slice(0, limit);
  }

  // ---------------------------------------------------------------------------
  // Map view — root CLAUDE.md §2 "Map view". Same filters as the feed, no pagination
  // (a map shows the whole filtered set at once), capped, and slim: just what a rent pin
  // and its preview card need. Listings without coordinates (geocoding failed or hasn't
  // run yet) are simply absent from the map — they still appear in list view.
  // ---------------------------------------------------------------------------

  async findMapPins(query: BrowseListingsDto) {
    const rows = await this.prisma.listing.findMany({
      where: {
        ...this.buildBrowseWhere(query),
        latitude: { not: null },
        longitude: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: MAP_PIN_LIMIT,
      select: {
        id: true,
        title: true,
        rent: true,
        propertyType: true,
        locality: true,
        latitude: true,
        longitude: true,
        avgRating: true,
        reviewCount: true,
        images: { orderBy: { position: 'asc' }, take: 1, select: { cloudinaryUrl: true } },
      },
    });

    return rows.map(({ images, latitude, longitude, ...rest }) => {
      const { lat, lng } = jitter(rest.id, latitude!, longitude!);
      return { ...rest, latitude: lat, longitude: lng, imageUrl: images[0]?.cloudinaryUrl ?? null };
    });
  }

  // ---------------------------------------------------------------------------
  // Geocoding — coordinates are derived server-side from locality/city/state, never
  // client-settable (root CLAUDE.md §6).
  // ---------------------------------------------------------------------------

  private geocodeInBackground(id: string, locality: string, city: string, state: string) {
    // Fire-and-forget: geocoding is rate-limited to 1 req/s and must never slow down or
    // fail a listing save. A miss writes null, which also clears stale coordinates when
    // an owner changes the locality to something that can't be resolved.
    this.geocoding
      .geocode(locality, city, state)
      .then((coords) =>
        this.prisma.listing.update({
          where: { id },
          data: { latitude: coords?.latitude ?? null, longitude: coords?.longitude ?? null },
        }),
      )
      .catch(() => {});
  }

  // Admin one-off for listings created before geocoding existed (or while it was down).
  // Queues up to `limit` un-geocoded, non-draft listings; the 1 req/s queue means this
  // finishes in the background roughly `limit` seconds later.
  async backfillGeocoding(limit = 100) {
    const pending = await this.prisma.listing.findMany({
      where: { latitude: null, status: { in: ['approved', 'pending', 'rented'] } },
      select: { id: true, locality: true, city: true, state: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    pending.forEach((l) => this.geocodeInBackground(l.id, l.locality, l.city, l.state));
    return { queued: pending.length };
  }

  // ---------------------------------------------------------------------------
  // Similar listings — root CLAUDE.md §2 "Additional Airbnb-level polish". Query-only:
  // approved listings in the same city that share the locality, an institution tag, or
  // a ±25% rent band, ranked locality (3) > institution (2) > price band (1), newest
  // first within a score. Candidate set capped so this stays one cheap query.
  // ---------------------------------------------------------------------------

  async findSimilar(userId: string, role: string, id: string, limit = 6) {
    // Same visibility rule as findOne() — reuses it for the 404 behaviour, but without
    // logging a listing_view event (this isn't the user viewing the listing).
    const base = await this.prisma.listing.findUnique({
      where: { id },
      include: { institutions: { select: { institutionId: true } } },
    });
    const canView =
      base && (base.status === 'approved' || base.ownerId === userId || role === 'admin');
    if (!canView) throw new NotFoundException('Listing not found');

    const baseLocality = base.locality.trim().toLowerCase();
    const institutionIds = base.institutions.map((i) => i.institutionId);
    const rentBand = { gte: Math.floor(base.rent * 0.75), lte: Math.ceil(base.rent * 1.25) };

    const candidates = await this.prisma.listing.findMany({
      where: {
        status: 'approved',
        city: base.city,
        id: { not: base.id },
        OR: [
          // `contains`, not `equals`: tolerates legacy untrimmed rows and "Jalukbari" vs
          // "Jalukbari Road"-style variants of the same area.
          { locality: { contains: baseLocality, mode: 'insensitive' } },
          ...(institutionIds.length
            ? [{ institutions: { some: { institutionId: { in: institutionIds } } } }]
            : []),
          { rent: rentBand },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: LISTING_INCLUDE,
    });

    const score = (l: (typeof candidates)[number]) =>
      (l.locality.toLowerCase().includes(baseLocality) ? 3 : 0) +
      (l.institutions.some((t) => institutionIds.includes(t.institution.id)) ? 2 : 0) +
      (l.rent >= rentBand.gte && l.rent <= rentBand.lte ? 1 : 0);

    // Array.sort is stable, so equal scores keep the newest-first DB order.
    return candidates
      .map((l) => ({ l, s: score(l) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map(({ l }) => l);
  }

  // ---------------------------------------------------------------------------
  // Owner insights — root CLAUDE.md §2 "Owner insights": per-listing views, inquiries,
  // response behaviour, over data already tracked (events, conversations, messages).
  // No new tables. Days are bucketed in IST, since owners read these as local dates.
  // ---------------------------------------------------------------------------

  async getInsights(userId: string, role: string, id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      select: { ownerId: true, createdAt: true, avgRating: true, reviewCount: true },
    });
    // 404 rather than 403 for someone else's listing — same no-existence-leak rule as
    // findOne().
    if (!listing || (listing.ownerId !== userId && role !== 'admin')) {
      throw new NotFoundException('Listing not found');
    }

    const DAYS = 30;
    const IST_MS = 330 * 60_000;
    const dayKey = (d: Date) => new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);
    const since = new Date(Date.now() - DAYS * 86_400_000);
    const onListing = { path: ['listingId'], equals: id };

    const [totalViews, viewers, contactTaps, recentViews, threads] = await Promise.all([
      this.prisma.event.count({ where: { eventName: 'listing_view', properties: onListing } }),
      this.prisma.event.findMany({
        where: { eventName: 'listing_view', properties: onListing, userId: { not: null } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      this.prisma.event.count({ where: { eventName: 'contact_tap', properties: onListing } }),
      this.prisma.event.findMany({
        where: { eventName: 'listing_view', properties: onListing, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.conversation.findMany({
        where: { listingId: id },
        select: {
          seekerId: true,
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 30,
            select: { senderId: true, createdAt: true },
          },
        },
      }),
    ]);

    // Inquiry = a thread where the seeker actually said something; replied = the owner
    // answered after that first message.
    let inquiries = 0;
    let replied = 0;
    const inquiryDays: string[] = [];
    for (const t of threads) {
      const first = t.messages.find((m) => m.senderId === t.seekerId);
      if (!first) continue;
      inquiries++;
      if (first.createdAt >= since) inquiryDays.push(dayKey(first.createdAt));
      if (t.messages.some((m) => m.senderId === listing.ownerId && m.createdAt > first.createdAt)) {
        replied++;
      }
    }

    const daily: { date: string; views: number; inquiries: number }[] = [];
    const index = new Map<string, (typeof daily)[number]>();
    for (let i = DAYS - 1; i >= 0; i--) {
      const row = { date: dayKey(new Date(Date.now() - i * 86_400_000)), views: 0, inquiries: 0 };
      daily.push(row);
      index.set(row.date, row);
    }
    recentViews.forEach((v) => {
      const row = index.get(dayKey(v.createdAt));
      if (row) row.views++;
    });
    inquiryDays.forEach((d) => {
      const row = index.get(d);
      if (row) row.inquiries++;
    });

    return {
      totals: {
        views: totalViews,
        uniqueViewers: viewers.length,
        contactTaps,
        inquiries,
        replied,
        responseRate: inquiries ? Math.round((replied / inquiries) * 100) : null,
        avgRating: listing.avgRating,
        reviewCount: listing.reviewCount,
      },
      last30: {
        views: recentViews.length,
        inquiries: inquiryDays.length,
      },
      daily,
      // Views before 2026-09-25 exist; contact taps / inquiries-as-events don't (they
      // weren't recorded). Lets the client say "tracking since …" honestly.
      listedAt: listing.createdAt,
    };
  }

  // ---------------------------------------------------------------------------
  // Admin moderation queue — root CLAUDE.md §14.10.
  // ---------------------------------------------------------------------------

  async findPendingQueue() {
    return this.prisma.listing.findMany({
      where: { status: 'pending' },
      orderBy: { updatedAt: 'asc' },
      include: LISTING_INCLUDE,
    });
  }

  async bulkSetStatus(ids: string[], status: 'approved' | 'rejected') {
    // ownerId per listing, fetched before the update, so each owner gets notified —
    // same reasoning as the single-listing update() path above.
    const owners = await this.prisma.listing.findMany({
      where: { id: { in: ids } },
      select: { id: true, ownerId: true, title: true },
    });
    const result = await this.prisma.listing.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });
    owners.forEach((listing) =>
      this.notifyOwner(listing.ownerId, listing.id, status, listing.title),
    );
    return { updated: result.count };
  }

  // ---------------------------------------------------------------------------
  // Update — content fields + the two non-admin status transitions.
  // ---------------------------------------------------------------------------

  async update(userId: string, role: string, id: string, dto: UpdateListingDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        institutions: { select: { institutionId: true } },
        images: {
          orderBy: { position: 'asc' },
          select: { cloudinaryUrl: true },
        },
      },
    });
    if (!listing) throw new NotFoundException('Listing not found');

    const isAdmin = role === 'admin';
    if (listing.ownerId !== userId && !isAdmin) {
      throw new ForbiddenException('Not your listing');
    }

    if (dto.institutionIds !== undefined) {
      await this.assertInstitutionsExist(dto.institutionIds);
    }

    const data: Prisma.ListingUpdateInput = {
      title: dto.title,
      description: dto.description,
      propertyType: dto.propertyType,
      rent: dto.rent,
      deposit: dto.deposit,
      locality: dto.locality,
      city: dto.city,
      availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : undefined,
      amenities: dto.amenities !== undefined ? (dto.amenities as Prisma.InputJsonValue) : undefined,
    };

    if (dto.status !== undefined) {
      data.status = this.resolveStatusTransition(listing.status, dto.status, isAdmin);
      if (data.status === 'pending') {
        // Photos sent in this same request count (save-and-submit from Edit).
        await this.assertPublishReady(id, dto.images?.length);
      }
    }

    // Moderation can't be bypassed by editing after approval (code review 2026-09-26):
    // an owner changing any content on a live (approved) or rented listing sends it back
    // to the admin queue. Otherwise "approve a clean listing, then rewrite it" defeats
    // the pending gate that root CLAUDE.md §7.5 calls the product's core trust feature.
    if (
      !isAdmin &&
      (listing.status === 'approved' || listing.status === 'rented') &&
      this.contentChanged(listing, dto)
    ) {
      data.status = 'pending';
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.images !== undefined) {
        const ordered = [...dto.images].sort((a, b) => a.position - b.position);
        await tx.listingImage.deleteMany({ where: { listingId: id } });
        if (ordered.length) {
          await tx.listingImage.createMany({
            data: ordered.map((img, position) => ({
              listingId: id,
              cloudinaryUrl: img.cloudinaryUrl,
              position,
            })),
          });
        }
      }
      if (dto.institutionIds !== undefined) {
        await tx.listingInstitution.deleteMany({ where: { listingId: id } });
        if (dto.institutionIds.length) {
          await tx.listingInstitution.createMany({
            data: dto.institutionIds.map((institutionId) => ({ listingId: id, institutionId })),
          });
        }
      }
      return tx.listing.update({ where: { id }, data, include: LISTING_INCLUDE });
    });

    if (updated.locality !== listing.locality || updated.city !== listing.city) {
      this.geocodeInBackground(updated.id, updated.locality, updated.city, updated.state);
    }

    // Owner-visible notification on an admin moderation decision — the owner didn't drive
    // this change themselves (unlike their own draft->pending/rented<->approved toggles,
    // which don't need telling them something they just did). Fire-and-forget, same
    // pattern as the listing_view event and chat's new_message notification.
    if (isAdmin && (data.status === 'approved' || data.status === 'rejected')) {
      this.notifyOwner(listing.ownerId, id, data.status, updated.title);
    }

    return updated;
  }

  private notifyOwner(
    ownerId: string,
    listingId: string,
    status: 'approved' | 'rejected',
    listingTitle: string,
  ): void {
    this.prisma.notification
      .create({
        data: {
          userId: ownerId,
          type: status === 'approved' ? 'listing_approved' : 'listing_rejected',
          // Title included so an owner with several listings can tell which one.
          payload: { listingId, listingTitle },
        },
      })
      .catch(() => {});

    this.push
      .sendToUser(ownerId, {
        title: status === 'approved' ? 'Listing approved' : 'Listing rejected',
        body:
          status === 'approved'
            ? 'Your listing is now live and visible to seekers.'
            : 'Your listing was rejected — check it and resubmit.',
        data: { type: `listing_${status}`, listingId },
      })
      .catch(() => {});
  }

  // Admins may set any status. Everyone else may only: publish a draft (draft ->
  // pending), or toggle rented/available on an already-approved listing (approved <->
  // rented). Anything else — including trying to self-approve, un-reject, etc. — is
  // rejected. This is the resolution of an ambiguity between root CLAUDE.md §4 ("owner
  // can mark rented") and §6 ("only admin can change status"): both are true, scoped to
  // different transitions.
  private contentChanged(
    listing: Prisma.ListingGetPayload<{
      include: {
        institutions: { select: { institutionId: true } };
        images: { select: { cloudinaryUrl: true } };
      };
    }>,
    dto: UpdateListingDto,
  ): boolean {
    // New, removed or reordered photos are a content change too — otherwise an approved
    // listing's photos could be swapped without going back through review.
    if (dto.images !== undefined) {
      const next = [...dto.images]
        .sort((a, b) => a.position - b.position)
        .map((i) => i.cloudinaryUrl)
        .join('|');
      const current = listing.images.map((i) => i.cloudinaryUrl).join('|');
      if (next !== current) return true;
    }
    const differs = <T>(next: T | undefined, current: T) =>
      next !== undefined && next !== current;
    if (
      differs(dto.title, listing.title) ||
      differs(dto.description, listing.description ?? undefined) ||
      differs(dto.propertyType, listing.propertyType) ||
      differs(dto.rent, listing.rent) ||
      differs(dto.deposit, listing.deposit ?? undefined) ||
      differs(dto.locality, listing.locality) ||
      differs(dto.city, listing.city)
    ) {
      return true;
    }
    if (dto.availableFrom !== undefined) {
      const next = new Date(dto.availableFrom).toISOString().slice(0, 10);
      const current = listing.availableFrom?.toISOString().slice(0, 10);
      if (next !== current) return true;
    }
    if (
      dto.amenities !== undefined &&
      JSON.stringify(Object.entries(dto.amenities).filter(([, v]) => v).sort()) !==
        JSON.stringify(
          Object.entries((listing.amenities ?? {}) as Record<string, boolean>)
            .filter(([, v]) => v)
            .sort(),
        )
    ) {
      return true;
    }
    if (dto.institutionIds !== undefined) {
      const next = [...dto.institutionIds].sort().join(',');
      const current = listing.institutions.map((i) => i.institutionId).sort().join(',');
      if (next !== current) return true;
    }
    return false;
  }

  private resolveStatusTransition(
    current: string,
    requested: string,
    isAdmin: boolean,
  ): 'pending' | 'approved' | 'rejected' | 'rented' {
    if (isAdmin) {
      return requested as 'pending' | 'approved' | 'rejected' | 'rented';
    }
    const allowed =
      (current === 'draft' && requested === 'pending') ||
      // Resubmit after rejection — the rejection notification tells owners to fix and
      // resubmit, which was impossible before (code review 2026-09-26).
      (current === 'rejected' && requested === 'pending') ||
      (current === 'approved' && requested === 'rented') ||
      (current === 'rented' && requested === 'approved');
    if (!allowed) {
      throw new ForbiddenException(`Cannot change status from ${current} to ${requested}`);
    }
    return requested as 'pending' | 'rented' | 'approved';
  }

  private async assertPublishReady(
    listingId: string,
    incomingImageCount?: number,
  ): Promise<void> {
    const imageCount =
      incomingImageCount ??
      (await this.prisma.listingImage.count({ where: { listingId } }));
    if (imageCount < 3) {
      throw new BadRequestException('At least 3 photos are required to publish a listing');
    }
  }

  private async assertInstitutionsExist(institutionIds: string[]): Promise<void> {
    if (!institutionIds.length) return;
    const count = await this.prisma.institution.count({
      where: { id: { in: institutionIds } },
    });
    if (count !== institutionIds.length) {
      throw new BadRequestException('One or more institutionIds do not exist');
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async remove(userId: string, role: string, id: string): Promise<void> {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.ownerId !== userId && role !== 'admin') {
      throw new ForbiddenException('Not your listing');
    }
    await this.prisma.listing.delete({ where: { id } });
  }
}
