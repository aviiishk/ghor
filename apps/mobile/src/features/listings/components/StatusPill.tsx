import { Text, View } from 'react-native';
import type { ListingStatus } from '../api';

// DESIGN.md's shared status-pill grammar — same visual vocabulary the (not-yet-built)
// admin moderation queue will use, so an owner and the founder read the same colors the
// same way.
const STYLES: Record<ListingStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-surface-sunken', text: 'text-muted', label: 'Draft' },
  pending: { bg: 'bg-warning-pale', text: 'text-warning-deep', label: 'Pending' },
  approved: { bg: 'bg-success-pale', text: 'text-success-deep', label: 'Live' },
  rejected: { bg: 'bg-destructive-pale', text: 'text-destructive-pressed', label: 'Rejected' },
  rented: { bg: 'bg-surface-sunken', text: 'text-muted', label: 'Rented' },
};

export function StatusPill({ status }: { status: ListingStatus }) {
  const style = STYLES[status];
  return (
    <View className={`rounded-full px-2.5 py-1 ${style.bg}`}>
      <Text className={`text-xs font-bold ${style.text}`}>{style.label}</Text>
    </View>
  );
}
