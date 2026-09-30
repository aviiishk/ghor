"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import type { Page } from "@/types/admin";
import { Badge, Button, Empty, ErrorNote, Input, PageHeader, formatDate } from "@/components/primitives";

interface Report {
  id: string;
  reason: string;
  reasonCategory: string;
  status: string;
  createdAt: string;
  listing: { id: string; title: string; status: string; pausedAt: string | null; heldAt: string | null };
  reporter: { id: string; fullName: string | null };
}

// Confirming a report holds a live (or pending) listing for re-review; a rejected, rented
// or paused listing is never moved back to review (enforced by the API).
export default function ReportsPage() {
  const qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["reports"], queryFn: () => api<Page<Report>>("/reports?limit=100") });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<unknown>(null);

  async function resolve(id: string, action: "dismiss" | "confirm") {
    setActionError(null);
    try {
      await api(`/reports/${id}/resolve`, { method: "POST", body: { action, note: notes[id] ?? "" } });
      await qc.invalidateQueries({ queryKey: ["reports"] });
    } catch (e) {
      setActionError(e);
    }
  }

  return (
    <div>
      <PageHeader title="Reports" subtitle="Open reports, oldest first. A resolution note is required and recorded." />
      <ErrorNote error={error ?? actionError} />
      {data && !data.items.length && <Empty title="No open reports" />}
      <ul className="space-y-3">
        {data?.items.map((r) => (
          <li key={r.id} className="rounded-2xl bg-canvas p-4 shadow-card ring-1 ring-hairline">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="warning">{r.reasonCategory}</Badge>
              <Link href={`/moderation/${r.listing.id}`} className="font-semibold text-primary hover:underline">{r.listing.title}</Link>
              <Badge>{r.listing.status}</Badge>
              <span className="text-xs text-muted">{formatDate(r.createdAt)} · by {r.reporter.fullName ?? "a user"}</span>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-body">{r.reason}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Input
                placeholder="Resolution note (required)"
                value={notes[r.id] ?? ""}
                onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                className="max-w-md"
              />
              <Button variant="secondary" disabled={(notes[r.id] ?? "").trim().length < 3} onClick={() => resolve(r.id, "dismiss")}>Dismiss</Button>
              <Button variant="danger" disabled={(notes[r.id] ?? "").trim().length < 3} onClick={() => resolve(r.id, "confirm")}>Confirm & hold listing</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
