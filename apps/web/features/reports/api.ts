// Calls apps/api's reports module via /api/gateway — built and verified live since the
// reports/admin pass; this is the first client to actually call it. Mirrors
// apps/mobile/src/features/reports/api.ts.
import { apiRequest } from '@/lib/apiClient';

export type ReportReasonCategory = 'spam' | 'fake' | 'inappropriate' | 'other';

export async function createReport(input: {
  listingId: string;
  reason: string;
  reasonCategory: ReportReasonCategory;
}) {
  return apiRequest<{ id: string }>('/reports', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
