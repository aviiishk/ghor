// Calls apps/api's owners module (apps/api/src/owners/) via /api/gateway. Mirrors
// apps/mobile/src/features/owners/api.ts.
import { apiRequest } from '@/lib/apiClient';
import type { Listing } from '@/features/listings/api';

export type OwnerProfile = {
  id: string;
  fullName: string | null;
  createdAt: string;
  phoneVerified: boolean;
  lastActiveAt: string | null;
  idVerificationStatus: 'none' | 'pending' | 'verified' | 'rejected';
  // Aggregate across the owner's listings' reviews; null when there are none.
  avgRating: number | null;
  reviewCount: number;
  // Both null until the owner has enough recent inquiries to be meaningful (server-side
  // threshold) — render nothing rather than a misleading 0%.
  responseRate: number | null;
  responseTimeMinutes: number | null;
  listings: Listing[];
};

export async function getOwner(id: string): Promise<OwnerProfile> {
  return apiRequest<OwnerProfile>(`/owners/${id}`);
}

// "usually replies within an hour" — deliberately coarse buckets, like Airbnb's.
export function describeResponseTime(minutes: number | null): string | null {
  if (minutes == null) return null;
  if (minutes <= 60) return 'Usually replies within an hour';
  if (minutes <= 60 * 6) return 'Usually replies within a few hours';
  if (minutes <= 60 * 24) return 'Usually replies within a day';
  return 'Usually replies within a few days';
}

export function describeLastActive(iso: string | null): string | null {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return 'Active today';
  if (days === 1) return 'Active yesterday';
  if (days < 30) return `Active ${days} days ago`;
  return 'Active over a month ago';
}
