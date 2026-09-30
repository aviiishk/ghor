// P0-11 approval-source labels — mirrors apps/web/features/listings/approval.ts (the two
// apps share rules, not code). "Verified" is never used for ordinary approval; "GHOR
// Verified" is reserved for the future paid owner-trust programme.
//   manual (or null, for listings approved before approval sources existed) → "Approved by GHOR"
//   automatic_5min / automatic_verified, not yet confirmed by a reviewer → "Automatically approved by GHOR"

export type ApprovalSource = 'manual' | 'automatic_5min' | 'automatic_verified';

export interface ApprovalInfo {
  label: string;
  shortLabel: string;
  automatic: boolean;
}

export function approvalInfo(listing: {
  status: string;
  approvalSource?: ApprovalSource | null;
  postReviewStatus?: string | null;
}): ApprovalInfo | null {
  if (listing.status !== 'approved' && listing.status !== 'rented') return null;
  const automatic =
    (listing.approvalSource === 'automatic_5min' || listing.approvalSource === 'automatic_verified') &&
    listing.postReviewStatus !== 'confirmed';
  return automatic
    ? { label: 'Automatically approved by GHOR', shortLabel: 'Auto-approved', automatic: true }
    : { label: 'Approved by GHOR', shortLabel: 'Approved', automatic: false };
}
