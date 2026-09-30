// P0-11 approval-source labels (MPB §13.4, D-17/D-18). Three things must never be confused:
//   - MANUAL APPROVAL      "Approved by GHOR"               a GHOR reviewer approved it
//   - AUTOMATIC APPROVAL   "Automatically approved by GHOR" live after automatic checks only
//   - GHOR VERIFIED        reserved for the future paid owner-trust programme — not used here
// "Verified" is never used for ordinary approval. Listings approved before approval sources
// existed have approvalSource 'manual' (backfilled) or null, and every one of them was
// approved by a person — both read as "Approved by GHOR".

export type ApprovalSource = 'manual' | 'automatic_5min' | 'automatic_verified';

export interface ApprovalInfo {
  label: string;
  automatic: boolean;
  description: string;
}

export function approvalInfo(listing: {
  status: string;
  approvalSource?: ApprovalSource | null;
  postReviewStatus?: string | null;
}): ApprovalInfo | null {
  if (listing.status !== 'approved' && listing.status !== 'rented') return null;
  const automatic =
    (listing.approvalSource === 'automatic_5min' || listing.approvalSource === 'automatic_verified') &&
    // A GHOR reviewer confirmed it afterwards → it has now been reviewed by a person.
    listing.postReviewStatus !== 'confirmed';
  return automatic
    ? {
        label: 'Automatically approved by GHOR',
        automatic: true,
        description:
          'This listing went live automatically after basic checks. Our team may review it later. Always verify before paying.',
      }
    : {
        label: 'Approved by GHOR',
        automatic: false,
        description: 'A GHOR reviewer checked and approved this listing before it went live.',
      };
}
