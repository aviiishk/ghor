// Calls apps/api's admin-guarded surface: ListingsController's admin/* routes,
// ReportsController, and AdminController (users/config/analytics) — root CLAUDE.md
// §14.10. Every call here 403s server-side for a non-admin caller regardless of what
// this app's UI shows; the layout's role check (app/admin/layout.tsx) is a UX
// convenience, not the actual authorization boundary.
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
  reporter: { id: string; fullName: string | null; phone: string | null };
};

export type AdminUser = {
  id: string;
  fullName: string | null;
  phone: string | null;
  googleId: string | null;
  role: 'seeker' | 'owner' | 'admin';
  banned: boolean;
  createdAt: string;
  _count: { listings: number };
};

export type AppConfigRow = { key: string; value: unknown; updatedAt: string };

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
  return apiRequest<Listing[]>('/listings/admin/queue');
}

export async function bulkSetListingStatus(ids: string[], status: 'approved' | 'rejected') {
  return apiRequest<{ updated: number }>('/listings/admin/bulk-status', {
    method: 'POST',
    body: JSON.stringify({ ids, status }),
  });
}

export async function getOpenReports() {
  return apiRequest<AdminReport[]>('/reports');
}

export async function resolveReport(id: string, action: 'dismiss' | 'confirm') {
  return apiRequest<AdminReport>(`/reports/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ action }),
  });
}

export async function getUsers() {
  return apiRequest<AdminUser[]>('/admin/users');
}

export async function setUserBanned(id: string, banned: boolean) {
  return apiRequest<AdminUser>(`/admin/users/${id}/ban`, {
    method: 'PATCH',
    body: JSON.stringify({ banned }),
  });
}

export async function setUserRole(id: string, role: 'seeker' | 'owner' | 'admin') {
  return apiRequest<AdminUser>(`/admin/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function getConfig() {
  return apiRequest<AppConfigRow[]>('/admin/config');
}

export async function setConfig(key: string, value: unknown) {
  return apiRequest<AppConfigRow>(`/admin/config/${key}`, {
    method: 'PATCH',
    body: JSON.stringify({ value }),
  });
}

export async function getAnalytics() {
  return apiRequest<AdminAnalytics>('/admin/analytics');
}
