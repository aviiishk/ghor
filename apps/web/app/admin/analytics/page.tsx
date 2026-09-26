'use client';

import { useAdminAnalytics } from '@/features/admin/hooks';

export default function AdminAnalyticsPage() {
  const { data, isLoading, isError } = useAdminAnalytics();

  if (isLoading) return <p className="text-muted">Loading…</p>;
  if (isError || !data) return <p className="text-muted">Couldn&apos;t load analytics.</p>;

  const funnelStats = [
    { label: 'Signups', value: data.funnel.signups },
    { label: 'Listing Views', value: data.funnel.listingViews },
    { label: 'Contact Taps', value: data.funnel.contactTaps },
    { label: 'Chats Started', value: data.funnel.chatStarted },
    { label: 'Listings Created', value: data.funnel.listingsCreated },
  ];
  const totalStats = [
    { label: 'Total Users', value: data.totals.totalUsers },
    { label: 'Total Listings', value: data.totals.totalListings },
    { label: 'Pending Review', value: data.totals.pendingListings },
    { label: 'Open Reports', value: data.totals.openReports },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-6">Analytics</h1>

      <p className="text-sm font-semibold text-muted mb-3">Funnel (all-time event counts)</p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        {funnelStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <p className="text-sm font-semibold text-muted mb-3">Current totals</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {totalStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <p className="text-xs text-muted-soft mt-6">
        Signups, contact taps, and chats-started currently read 0 — those events aren&apos;t
        written to this backend&apos;s events table yet (apps/mobile still tracks them via the
        old Supabase-direct path, see STATUS.md). Listing views are live.
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-card">
      <p className="text-2xl font-bold text-ink">{value.toLocaleString('en-IN')}</p>
      <p className="text-muted text-xs mt-1">{label}</p>
    </div>
  );
}
