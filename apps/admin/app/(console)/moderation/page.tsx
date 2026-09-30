"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import type { Page, QueueItem } from "@/types/admin";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge, Empty, ErrorNote, PageHeader, formatDate, formatDuration } from "@/components/primitives";

const TRACKS = [
  { id: "pending", label: "Awaiting review" },
  { id: "held", label: "On hold" },
  { id: "post_review", label: "Post-review" },
  { id: "paused", label: "Paused" }
] as const;

function Queue() {
  const params = useSearchParams();
  const router = useRouter();
  const track = (params.get("track") ?? "pending") as (typeof TRACKS)[number]["id"];
  const { data, error, isLoading } = useQuery({
    queryKey: ["queue", track],
    queryFn: () => api<Page<QueueItem> & { track: string }>(`/listings/queue?track=${track}&limit=50`, {}, { background: true }),
    refetchInterval: 30_000
  });

  return (
    <div>
      <PageHeader title="Moderation" subtitle="Oldest first. Claiming shows teammates you're on it — it does not stop the 5-minute timer; only a decision or Hold does." />
      <div role="tablist" aria-label="Queues" className="mb-4 flex flex-wrap gap-2">
        {TRACKS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={track === t.id}
            onClick={() => router.replace(`/moderation?track=${t.id}`)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${track === t.id ? "bg-primary text-on-primary" : "bg-canvas text-body ring-1 ring-hairline"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <ErrorNote error={error} />
      {isLoading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading queue">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl bg-surface-sunken" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <Empty title="Nothing here" body="New submissions appear as soon as owners send them for review." />
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-2xl bg-canvas shadow-card ring-1 ring-hairline">
          {data.items.map((l) => (
            <li key={l.id}>
              <Link href={`/moderation/${l.id}`} className="flex flex-wrap items-center gap-4 px-4 py-3 hover:bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {l.images[0] ? <img src={l.images[0].cloudinaryUrl} alt="" className="h-14 w-20 rounded-lg object-cover" /> : <div className="h-14 w-20 rounded-lg bg-surface-sunken" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{l.title}</p>
                  <p className="text-sm text-muted">
                    ₹{l.rent.toLocaleString("en-IN")} · {l.locality} · {l.owner.fullName ?? "Owner"} · {l._count.images} photos
                    {l._count.reports > 0 && ` · ${l._count.reports} open reports`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {track === "pending" && l.secondsUntilAutoApproval !== null && (
                    <Badge tone={l.secondsUntilAutoApproval < 120 ? "warning" : "neutral"}>
                      Auto-approves in {formatDuration(l.secondsUntilAutoApproval)}
                    </Badge>
                  )}
                  {l.heldAt && <Badge tone="info">Held · {l.holdReason}</Badge>}
                  {l.pausedAt && <Badge tone="danger">Paused</Badge>}
                  {l.claimActive && <Badge>Claimed</Badge>}
                  <span className="text-muted">Submitted {formatDate(l.submittedAt)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ModerationPage() {
  return (
    <Suspense>
      <Queue />
    </Suspense>
  );
}
