// LEGACY admin console client (D-46). Calls apps/api's hardened /legacy-admin/* surface
// (Phase 0, 2026-09-29): authorization is an active admin_users row + the central
// permission map, every mutation is audited, bulk decisions need a reason, and sensitive
// actions (bans, configuration changes, admin roles) are only possible in the new admin
// console (apps/admin), which has TOTP step-up. The layout's role check
// (app/admin/layout.tsx) is a UX convenience, not the authorization boundary.
import { apiRequest } from '@/lib/apiClient';
import type { Listing } from '@/features/listings/api';

export type AdminReport = {
  id: string;
  listingId: string;
  reporterId: string;
  reason: string;
  reasonCategory: 'spam' | 'fake' | 'inappropriate' | 'other';
  status: 'pending' | 'reviewed' | 'dismissed';
  createdAt: string;
  listing: { id: string; title: string; status: string; ownerId: string };
  reporter: { id: string; fullName: string | null };
};

export type AdminUser = {
  id: string;
  fullName: string | null;
  // Masked by the API (e.g. +91******21).
  phone: string | null;
  hasGoogle: boolean;
  isAdmin: boolean;
  role: 'seeker' | 'owner' | 'admin';
  banned: boolean;
  createdAt: string;
  _count: { listings: number };
};

export type AppConfigRow = {
  key: string;
  value: unknown;
  description: string;
  public: boolean;
  isDefault: boolean;
  updatedAt: string | null;
};

export type AdminAnalytics = {
  funnel: {
    signups: number;
    listingViews: number;
    contactTaps: number;
    chatStarted: number;
    listingsCreated: number;
  };
  totals: {
    totalUsers: number;
    totalListings: number;
    pendingListings: number;
    openReports: number;
  };
};

export async function getPendingListings() {
  return apiRequest<Listing[]>('/legacy-admin/listings/queue');
}

export type BulkResult = {
  updated: number;
  failed: number;
  results: { id: string; result: 'ok' | 'conflict' | 'invalid_state' | 'requirements_not_met' | 'not_found' | 'error'; message?: string }[];
};

// Up to 50 listings; only listings still awaiting review are decided, each one audited.
export async function bulkSetListingStatus(ids: string[], status: 'approved' | 'rejected', reason: string) {
  return apiRequest<BulkResult>('/legacy-admin/listings/bulk-status', {
    method: 'POST',
    body: JSON.stringify({ ids, status, reason }),
  });
}

export async function getOpenReports() {
  return apiRequest<AdminReport[]>('/legacy-admin/reports');
}

export async function resolveReport(id: string, action: 'dismiss' | 'confirm') {
  return apiRequest<AdminReport>(`/legacy-admin/reports/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ action }),
  });
}

export async function getUsers() {
  return apiRequest<AdminUser[]>('/legacy-admin/users');
}

// Marketplace side only — granting admin power is not possible from the legacy console.
export async function setUserRole(id: string, role: 'seeker' | 'owner') {
  return apiRequest<AdminUser>(`/legacy-admin/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

// Read-only here: configuration changes require TOTP step-up in the new admin console.
export async function getConfig() {
  return apiRequest<AppConfigRow[]>('/legacy-admin/config');
}

export async function getAnalytics() {
  return apiRequest<AdminAnalytics>('/legacy-admin/analytics');
}
