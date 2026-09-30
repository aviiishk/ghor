"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import { useCan } from "@/components/providers";
import { ErrorNote, PageHeader } from "@/components/primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendChart } from "@/components/trend-chart";

interface Analytics {
  funnel: { signups: number; listingViews: number; contactTaps: number; chatStarted: number; listingsCreated: number };
  totals: { totalUsers: number; totalListings: number; pendingListings: number; openReports: number };
  moderation: Record<string, number>;
}

interface Trends {
  days: number;
  series: Record<string, unknown>[];
}

// Approval time is only defined on days that had approvals, so it is listed per day rather
// than drawn as a continuous line (a line would invent values for the empty days).
function ApprovalTiming({ series, loading, days }: { series?: Record<string, unknown>[]; loading: boolean; days: number }) {
  const withData = (series ?? [])
    .filter((d) => typeof d.medianApprovalMinutes === "number")
    .map((d) => ({ date: String(d.date), minutes: d.medianApprovalMinutes as number }))
    .reverse();
  const sorted = withData.map((d) => d.minutes).sort((a, b) => a - b);
  const mid = sorted.length
    ? sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : null;
  const fmt = (m: number) => (m < 60 ? `${Math.round(m * 10) / 10} min` : `${Math.round((m / 60) * 10) / 10} h`);
  return (
    <Card className="rounded-2xl border-hairline shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-ink">Approval time</CardTitle>
        <p className="text-sm text-muted">Median time from (last) submission to approval, by day of approval.</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-24 w-full bg-surface-sunken" />
        ) : withData.length === 0 ? (
          <p className="text-sm text-muted">No approvals in the last {days} days.</p>
        ) : (
          <>
            <p className="text-sm text-body">
              Typical day: <span className="font-display text-2xl font-bold tabular-nums text-ink">{fmt(mid!)}</span>{" "}
              <span className="text-xs text-muted">(median of {withData.length} day{withData.length === 1 ? "" : "s"} with approvals)</span>
            </p>
            <table className="mt-3 w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="py-1 font-semibold">Day</th>
                  <th className="py-1 font-semibold">Median</th>
                </tr>
              </thead>
              <tbody>
                {withData.slice(0, 10).map((d) => (
                  <tr key={d.date} className="border-t border-hairline">
                    <td className="py-1 text-body">{d.date}</td>
                    <td className="py-1 tabular-nums text-ink">{fmt(d.minutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const FUNNEL: { key: keyof Analytics["funnel"]; label: string }[] = [
  { key: "signups", label: "Sign-ups" },
  { key: "listingViews", label: "Listing views" },
  { key: "contactTaps", label: "Contact taps" },
  { key: "chatStarted", label: "Chats started" },
  { key: "listingsCreated", label: "Listings created" }
];

// Phase 0 analytics: a read-only view of data GHOR already records (events funnel,
// totals, moderation decisions, reports, submission→approval time). The full analytics
// area (owners, renters, verification, revenue) is Phase 1+.
export default function AnalyticsPage() {
  const can = useCan();
  const [days, setDays] = useState(30);
  const overview = useQuery({
    queryKey: ["analytics"],
    queryFn: () => api<Analytics>("/analytics"),
    enabled: can("users.view")
  });
  const trends = useQuery({
    queryKey: ["trends", days],
    queryFn: () => api<Trends>(`/analytics/trends?days=${days}`)
  });
  const f = overview.data?.funnel;
  const t = overview.data?.totals;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        subtitle="Real counts only. Days are IST calendar days."
        actions={
          <div role="group" aria-label="Period" className="flex gap-1 rounded-xl bg-canvas p-1 ring-1 ring-hairline">
            {[7, 30, 90].map((n) => (
              <button
                key={n}
                aria-pressed={days === n}
                onClick={() => setDays(n)}
                className={`rounded-lg px-3 py-1 text-sm font-semibold ${days === n ? "bg-primary text-on-primary" : "text-body hover:bg-surface"}`}
              >
                {n} days
              </button>
            ))}
          </div>
        }
      />
      <ErrorNote error={overview.error ?? trends.error} />

      {can("users.view") && (
        <section aria-label="Totals and funnel" className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-2xl border-hairline shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-ink">Marketplace totals</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              {(
                [
                  ["Users", t?.totalUsers],
                  ["Listings", t?.totalListings],
                  ["Awaiting review", t?.pendingListings],
                  ["Open reports", t?.openReports]
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <p className="text-sm text-muted">{label}</p>
                  {value === undefined ? <Skeleton className="mt-1 h-7 w-14 bg-surface-sunken" /> : <p className="font-display text-2xl font-bold tabular-nums text-ink">{value}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-hairline shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-ink">Funnel (all time)</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {FUNNEL.map((s) => {
                  const v = f?.[s.key];
                  const max = f ? Math.max(1, ...Object.values(f)) : 1;
                  return (
                    <li key={s.key} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm">
                      <span className="text-body">{s.label}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${v ? (v / max) * 100 : 0}%` }} />
                      </span>
                      <span className="text-right font-semibold tabular-nums text-ink">{v ?? "—"}</span>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-3 text-xs text-muted">Counts from the events table; events before 2026-09-25 were not recorded for every step.</p>
            </CardContent>
          </Card>
        </section>
      )}

      <section aria-label="Trends" className="grid gap-4 xl:grid-cols-2">
        <TrendChart
          title="Moderation decisions"
          data={trends.data?.series}
          loading={trends.isLoading}
          series={[
            { key: "approved", label: "Approved", color: "var(--chart-1)" },
            { key: "autoApproved", label: "Auto-approved", color: "var(--chart-5)" },
            { key: "rejected", label: "Rejected / changes", color: "var(--chart-4)" },
            { key: "held", label: "Held", color: "var(--chart-3)" }
          ]}
        />
        <TrendChart
          title="Submissions and reports"
          data={trends.data?.series}
          loading={trends.isLoading}
          kind="area"
          series={[
            { key: "submitted", label: "Submitted for review", color: "var(--chart-1)" },
            { key: "reports", label: "Reports filed", color: "var(--chart-4)" }
          ]}
        />
        <ApprovalTiming series={trends.data?.series} loading={trends.isLoading} days={days} />
      </section>
    </div>
  );
}
