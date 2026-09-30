"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, Flag, Inbox, PauseCircle, ShieldAlert, Timer } from "lucide-react";
import { api } from "@/lib/client/api";
import type { AuditRow, Page } from "@/types/admin";
import { useCan } from "@/components/providers";
import { Badge, ErrorNote, PageHeader, formatDate, formatDuration } from "@/components/primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendChart } from "@/components/trend-chart";

interface Dashboard {
  generatedAt: string;
  queues: {
    pendingReview: number;
    held: number;
    approachingAutoApproval: number;
    awaitingPostReview: number;
    paused: number;
    openReports: number;
    oldestPendingAgeSeconds: number | null;
    oldestReportAgeSeconds: number | null;
  };
  ownerTracks: {
    freeOwner: { available: true; pendingReview: number };
    verifiedOwner: { available: false; note: string };
  };
  highRisk: { heldByReason: Record<string, number>; listingsWithOpenReports: number };
  recentModeration: {
    id: string;
    listingId: string;
    listingTitle: string | null;
    decision: string;
    actorType: string;
    reasonCodes: string[];
    createdAt: string;
  }[];
  system: {
    openAlerts: number;
    criticalAlerts: number;
    outboxBacklog: number;
    jobs: { name: string; lastSuccessAt: string | null; consecutiveFailures: number }[];
  };
  autoApproval: { enabled: boolean; lastSuccessAt: string | null };
}

interface Trends {
  days: number;
  series: Record<string, unknown>[];
}

const HOLD_LABEL: Record<string, string> = {
  reports_threshold: "Report threshold reached",
  report_confirmed: "Report confirmed",
  publish_requirements_not_met: "Failed publish checks",
  owner_restricted: "Owner restricted",
  overdue_f04_unresolved: "Overdue backlog (F-04 unresolved)",
  overdue_after_outage: "Overdue after outage",
  manual: "Held by an admin"
};

function Kpi({
  label,
  value,
  href,
  icon: Icon,
  note,
  tone = "neutral"
}: {
  label: string;
  value: number | undefined;
  href: string;
  icon: typeof Inbox;
  note?: string;
  tone?: "neutral" | "warning" | "danger";
}) {
  const accent = tone === "danger" ? "text-destructive-pressed" : tone === "warning" ? "text-warning-deep" : "text-primary";
  return (
    <Link href={href} className="block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring">
      <Card className="h-full rounded-2xl border-hairline shadow-card transition-colors hover:border-primary">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted">{label}</p>
            <Icon size={16} className={accent} aria-hidden />
          </div>
          {value === undefined ? (
            <Skeleton className="mt-2 h-8 w-16 bg-surface-sunken" />
          ) : (
            <p className="mt-1 font-display text-3xl font-bold tabular-nums text-ink">{value}</p>
          )}
          {note && <p className="mt-1 text-xs text-muted">{note}</p>}
          {tone !== "neutral" && value !== undefined && value > 0 && (
            <p className={`mt-1 text-xs font-semibold ${accent}`}>{tone === "danger" ? "Act now" : "Needs attention"}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

// "What needs GHOR's attention right now?" (MPB §26.8). Every number is live API data;
// data that doesn't exist yet (verified-owner track, automated risk flags) is labelled as
// such instead of being shown as zero. Polls every 30 s as a background request so an open
// tab never keeps an idle session alive.
export default function OverviewPage() {
  const can = useCan();
  const dash = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<Dashboard>("/dashboard", {}, { background: true }),
    refetchInterval: 30_000
  });
  const trends = useQuery({
    queryKey: ["trends", 14],
    queryFn: () => api<Trends>("/analytics/trends?days=14", {}, { background: true }),
    refetchInterval: 5 * 60_000
  });
  const activity = useQuery({
    queryKey: ["dashboard-activity"],
    queryFn: () => api<Page<AuditRow> & { scope: string }>("/audit?limit=8&category=admin_action", {}, { background: true }),
    enabled: can("audit.view"),
    refetchInterval: 60_000
  });
  const d = dash.data;
  const q = d?.queues;

  return (
    <div className="space-y-6">
      <PageHeader title="What needs attention" subtitle={d ? `Live · updated ${formatDate(d.generatedAt)}` : "Loading…"} />
      <ErrorNote error={dash.error} />

      <section aria-label="Queues" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Auto-approval in < 2 min"
          value={q?.approachingAutoApproval}
          href="/moderation"
          icon={Timer}
          tone="danger"
          note={d ? (d.autoApproval.enabled ? "Decide or Hold to stop it" : "Auto-approval is OFF") : undefined}
        />
        <Kpi label="Awaiting review" value={q?.pendingReview} href="/moderation" icon={Inbox} note={q ? `Oldest ${formatDuration(q.oldestPendingAgeSeconds)}` : undefined} />
        <Kpi label="Open reports" value={q?.openReports} href="/reports" icon={Flag} tone="warning" note={q ? `Oldest ${formatDuration(q.oldestReportAgeSeconds)}` : undefined} />
        <Kpi label="On hold" value={q?.held} href="/moderation?track=held" icon={ShieldAlert} tone="warning" />
        <Kpi label="Awaiting post-review" value={q?.awaitingPostReview} href="/moderation?track=post_review" icon={Clock} />
        <Kpi label="Paused listings" value={q?.paused} href="/moderation?track=paused" icon={PauseCircle} />
        <Kpi label="System alerts" value={d?.system.openAlerts} href="/system" icon={AlertTriangle} tone={d && d.system.criticalAlerts > 0 ? "danger" : "warning"} note={d ? `${d.system.criticalAlerts} critical` : undefined} />
      </section>

      <section aria-label="Owner tracks and risk" className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl border-hairline shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-ink">Owner tracks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-body">Free owner queue</span>
              <span className="font-semibold tabular-nums text-ink">{d ? d.ownerTracks.freeOwner.pendingReview : "—"}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-body">Verified owner queue</span>
              <Badge>Not available</Badge>
            </div>
            <p className="text-xs text-muted">
              {d?.ownerTracks.verifiedOwner.note ?? "GHOR Verified does not exist yet (Phase 1)."} Every listing today is from a free-tier owner.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-hairline shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-ink">High-risk cases</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!d ? (
              <Skeleton className="h-16 w-full bg-surface-sunken" />
            ) : Object.keys(d.highRisk.heldByReason).length === 0 && d.highRisk.listingsWithOpenReports === 0 ? (
              <p className="text-muted">No holds and no reported listings.</p>
            ) : (
              <>
                {Object.entries(d.highRisk.heldByReason).map(([reason, n]) => (
                  <div key={reason} className="flex justify-between">
                    <Link href="/moderation?track=held" className="text-primary hover:underline">{HOLD_LABEL[reason] ?? reason}</Link>
                    <span className="font-semibold tabular-nums text-ink">{n}</span>
                  </div>
                ))}
                <div className="flex justify-between">
                  <Link href="/reports" className="text-primary hover:underline">Listings with open reports</Link>
                  <span className="font-semibold tabular-nums text-ink">{d.highRisk.listingsWithOpenReports}</span>
                </div>
              </>
            )}
            <p className="text-xs text-muted">Automated risk flags (duplicate media, phone reuse, price outliers) arrive in Phase 1.</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-hairline shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-ink">System</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!d ? (
              <Skeleton className="h-16 w-full bg-surface-sunken" />
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-body">5-minute auto-approval</span>
                  {d.autoApproval.enabled ? <Badge tone="warning">On</Badge> : <Badge>Off</Badge>}
                </div>
                <div className="flex justify-between">
                  <span className="text-body">Notifications waiting</span>
                  <span className="font-semibold tabular-nums text-ink">{d.system.outboxBacklog}</span>
                </div>
                {d.system.jobs.map((j) => (
                  <div key={j.name} className="flex justify-between gap-2">
                    <span className="font-mono text-xs text-body">{j.name}</span>
                    {j.consecutiveFailures > 0 ? (
                      <Badge tone="danger">{j.consecutiveFailures} failures</Badge>
                    ) : (
                      <span className="text-xs text-muted">ok · {formatDate(j.lastSuccessAt)}</span>
                    )}
                  </div>
                ))}
                {d.system.jobs.length === 0 && <p className="text-xs text-muted">No background job has run on this database yet.</p>}
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-label="Trends" className="grid gap-4 xl:grid-cols-2">
        <TrendChart
          title="Moderation, last 14 days"
          description="Decisions per day (IST)"
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
          title="Submissions and reports, last 14 days"
          data={trends.data?.series}
          loading={trends.isLoading}
          kind="area"
          series={[
            { key: "submitted", label: "Submitted for review", color: "var(--chart-1)" },
            { key: "reports", label: "Reports filed", color: "var(--chart-4)" }
          ]}
        />
      </section>

      <section aria-label="Recent activity" className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-hairline shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-ink">Recent moderation</CardTitle>
          </CardHeader>
          <CardContent>
            {!d ? (
              <Skeleton className="h-24 w-full bg-surface-sunken" />
            ) : d.recentModeration.length === 0 ? (
              <p className="text-sm text-muted">No moderation decisions yet.</p>
            ) : (
              <ul className="divide-y divide-hairline text-sm">
                {d.recentModeration.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-2 py-2">
                    <Badge tone={m.decision.includes("reject") ? "danger" : m.decision.includes("approve") ? "success" : "neutral"}>
                      {m.decision.replace(/_/g, " ")}
                    </Badge>
                    <Link href={`/moderation/${m.listingId}`} className="min-w-0 flex-1 truncate text-primary hover:underline">
                      {m.listingTitle ?? "Listing"}
                    </Link>
                    <span className="text-xs text-muted">{m.actorType === "system" ? "system" : "admin"} · {formatDate(m.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-hairline shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-ink">Admin activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.isLoading ? (
              <Skeleton className="h-24 w-full bg-surface-sunken" />
            ) : !activity.data?.items.length ? (
              <p className="text-sm text-muted">No admin actions visible to you yet.</p>
            ) : (
              <ul className="divide-y divide-hairline text-sm">
                {activity.data.items.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
                    <span className="font-mono text-xs text-ink">{a.action}</span>
                    <span className="text-xs text-muted">{a.actorRole ?? a.actorType} · {formatDate(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
            {activity.data && (
              <p className="mt-2 text-xs text-muted">
                Showing {activity.data.scope === "all" ? "all admins’ actions" : "your own actions"}. <Link href="/audit" className="text-primary hover:underline">Full audit log</Link>
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
