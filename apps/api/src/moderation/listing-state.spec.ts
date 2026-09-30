import type { ListingStatus } from '@prisma/client';
import { isOwnerTransitionAllowed, submissionFields } from './listing-state';

const ALL: ListingStatus[] = [
  'draft',
  'pending',
  'approved',
  'rejected',
  'rented',
];

describe('owner status transitions', () => {
  const allowed = new Set([
    'draft>pending',
    'rejected>pending',
    'approved>rented',
    'rented>approved',
  ]);

  it.each(ALL.flatMap((from) => ALL.map((to) => [from, to] as const)))(
    '%s → %s',
    (from, to) => {
      expect(isOwnerTransitionAllowed(from, to)).toBe(
        allowed.has(`${from}>${to}`),
      );
    },
  );

  it('owners can never approve their own listing or leave review', () => {
    expect(isOwnerTransitionAllowed('pending', 'approved')).toBe(false);
    expect(isOwnerTransitionAllowed('draft', 'approved')).toBe(false);
    expect(isOwnerTransitionAllowed('rejected', 'approved')).toBe(false);
  });
});

describe('submissionFields', () => {
  it('starts the auto-approval window and clears approval metadata', () => {
    const now = new Date('2026-09-29T10:00:00Z');
    const f = submissionFields(now, 300, {
      heldAt: null,
      heldById: null,
      holdReason: null,
    });
    expect(f.submittedAt).toEqual(now);
    expect(f.autoApproveAt).toEqual(new Date('2026-09-29T10:05:00Z'));
    expect(f.approvalSource).toBeNull();
    expect(f.approvedAt).toBeNull();
  });

  it('preserves an existing hold (an edit must not escape a trust hold)', () => {
    const heldAt = new Date('2026-09-29T09:00:00Z');
    const f = submissionFields(new Date(), 300, {
      heldAt,
      heldById: null,
      holdReason: 'reports_threshold',
    });
    expect(f.heldAt).toEqual(heldAt);
    expect(f.holdReason).toBe('reports_threshold');
  });
});
