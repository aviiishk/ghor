import type { ListingStatus } from '@prisma/client';

// Pure lifecycle rules, unit-tested in listing-state.spec.ts.
//
// Owners (the only non-admin actor that changes status) may:
//   draft → pending        publish
//   rejected → pending     resubmit after rejection / requested changes
//   approved → rented      mark rented
//   rented → approved      mark available again
// Everything else is an admin moderation action and goes through ModerationService —
// never through the owner's PATCH /listings/:id.
export function isOwnerTransitionAllowed(
  current: ListingStatus,
  requested: ListingStatus,
): boolean {
  return (
    (current === 'draft' && requested === 'pending') ||
    (current === 'rejected' && requested === 'pending') ||
    (current === 'approved' && requested === 'rented') ||
    (current === 'rented' && requested === 'approved')
  );
}

// Fields reset whenever a listing (re-)enters `pending` for review. The 5-minute
// auto-approval clock (D-17) starts here. An existing hold is preserved on purpose: an
// owner must not be able to escape a trust hold by editing the listing.
export function submissionFields(
  now: Date,
  windowSeconds: number,
  existingHold: {
    heldAt: Date | null;
    heldById: string | null;
    holdReason: string | null;
  },
) {
  return {
    submittedAt: now,
    autoApproveAt: new Date(now.getTime() + windowSeconds * 1000),
    approvalSource: null,
    approvedAt: null,
    approvedById: null,
    postReviewStatus: null,
    heldAt: existingHold.heldAt,
    heldById: existingHold.heldById,
    holdReason: existingHold.holdReason,
  };
}

// Common "the listing left the review queue" reset (decision, auto-approval).
export const CLEARED_REVIEW_STATE = {
  autoApproveAt: null,
  heldAt: null,
  heldById: null,
  holdReason: null,
  claimedById: null,
  claimedAt: null,
  claimExpiresAt: null,
} as const;

// Reason codes are free-form until the founder fixes the taxonomy (audit F-14): a short
// machine-friendly token, so they can be charted later without text parsing.
export const REASON_CODE_PATTERN = /^[a-z0-9_]{2,40}$/;
