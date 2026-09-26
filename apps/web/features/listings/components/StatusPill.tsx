import type { ListingStatus } from '../api';

// DESIGN.md's shared status-pill grammar — same colors/labels as
// apps/mobile/src/features/listings/components/StatusPill.tsx.
const STYLES: Record<ListingStatus, { className: string; label: string }> = {
  draft: { className: 'bg-surface-sunken text-muted', label: 'Draft' },
  pending: { className: 'bg-warning-pale text-warning-deep', label: 'Pending' },
  approved: { className: 'bg-success-pale text-success-deep', label: 'Live' },
  rejected: { className: 'bg-destructive-pale text-destructive-pressed', label: 'Rejected' },
  rented: { className: 'bg-surface-sunken text-muted', label: 'Rented' },
};

export function StatusPill({ status }: { status: ListingStatus }) {
  const style = STYLES[status];
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${style.className}`}>
      {style.label}
    </span>
  );
}
