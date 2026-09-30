import { Prisma } from '@prisma/client';

// Explicit response shapes for listings (Phase 0 pre-merge fix). A Prisma `include` returns
// every scalar column, which since the moderation columns were added meant renters saw
// who approved a listing, hold/pause reasons, claim metadata, the auto-approval clock and
// the concurrency version. Marketplace responses now use a `select` that names each field,
// so a column added later is private until someone deliberately adds it here.
//
//   PUBLIC  — browse feed, similar listings, owner-profile grid (any signed-in user)
//   RENTER  — listing detail for someone who is not the owner (PUBLIC + owner phone for Call)
//   OWNER   — the owner's own listings (create, update, "my listings", own detail)
//   ADMIN   — ADMIN_LISTING_INCLUDE, admin-only endpoints (full row, incl. moderation data)
//
// Never exposed to the marketplace: approvedById, claimedById/claimedAt/claimExpiresAt,
// heldById/heldAt/holdReason, pausedById/pausedAt/pauseReason, autoApproveAt, version,
// submittedAt, approvedAt, deletedAt.

export const OWNER_CARD_SELECT = {
  id: true,
  fullName: true,
  phoneVerified: true,
  lastActiveAt: true,
  idVerificationStatus: true,
} satisfies Prisma.ProfileSelect;

const PUBLIC_SCALARS = {
  id: true,
  ownerId: true,
  title: true,
  description: true,
  propertyType: true,
  rent: true,
  deposit: true,
  locality: true,
  city: true,
  state: true,
  availableFrom: true,
  amenities: true,
  status: true,
  propertyVerified: true,
  latitude: true,
  longitude: true,
  avgRating: true,
  reviewCount: true,
  createdAt: true,
  updatedAt: true,
  // P0-11 label inputs ("Approved by GHOR" / "Automatically approved by GHOR").
  // postReviewStatus is reduced to confirmed-or-null by presentListing().
  approvalSource: true,
  postReviewStatus: true,
} satisfies Prisma.ListingSelect;

const RELATIONS = {
  images: { orderBy: { position: 'asc' as const } },
  institutions: { include: { institution: true } },
} satisfies Prisma.ListingSelect;

export const PUBLIC_LISTING_SELECT = {
  ...PUBLIC_SCALARS,
  ...RELATIONS,
  owner: { select: OWNER_CARD_SELECT },
} satisfies Prisma.ListingSelect;

export const RENTER_LISTING_SELECT = {
  ...PUBLIC_SCALARS,
  ...RELATIONS,
  owner: { select: { ...OWNER_CARD_SELECT, phone: true } },
} satisfies Prisma.ListingSelect;

// Owners manage status (draft → pending, approved ↔ rented, resubmit after rejection);
// nothing else in the moderation metadata is needed for that, so the owner shape is the
// public field set. Kept as its own constant so owner-only fields can be added
// deliberately later.
export const OWNER_LISTING_SELECT = {
  ...PUBLIC_SCALARS,
  ...RELATIONS,
  owner: { select: OWNER_CARD_SELECT },
} satisfies Prisma.ListingSelect;

// Admin-only (e.g. /legacy-admin/listings/queue): the full row including moderation data.
export const ADMIN_LISTING_INCLUDE = {
  images: { orderBy: { position: 'asc' as const } },
  institutions: { include: { institution: true } },
  owner: { select: OWNER_CARD_SELECT },
} satisfies Prisma.ListingInclude;

// Final pass for every marketplace listing response. postReviewStatus other than
// `confirmed` (pending / escalated) is internal review state, so renters and owners only
// ever see `confirmed` or null — exactly what the client label logic distinguishes.
export function presentListing<
  T extends { postReviewStatus?: string | null },
>(row: T): T {
  return {
    ...row,
    postReviewStatus: row.postReviewStatus === 'confirmed' ? 'confirmed' : null,
  };
}
