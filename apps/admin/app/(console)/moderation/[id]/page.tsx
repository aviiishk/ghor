"use client";

import { use, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "@/lib/client/api";
import type { ListingDetail } from "@/types/admin";
import { useCan } from "@/components/providers";
import { Skeleton } from "@/components/ui/skeleton";
import { ChangesPanel, MediaPanel, OwnerPlanPanel, ResponsePanel, RiskPanel } from "@/components/review-context-panels";
import { Badge, Button, Card, ErrorNote, Input, PageHeader, Textarea, formatDate, formatDuration } from "@/components/primitives";

type Action = "approve" | "reject" | "request_changes" | "hold" | "release_hold" | "pause" | "restore" | "confirm_post" | "reject_post";

// Review workspace (MPB §26.10, Phase 0 subset). Every action sends the version the admin
// is looking at; if anything changed meanwhile (another admin, the owner, the auto-approval
// job) the API answers 409 and the page reloads instead of overwriting.
export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const can = useCan();
  const { data: l, error, refetch } = useQuery({ queryKey: ["listing", id], queryFn: () => api<ListingDetail>(`/listings/${id}`) });
  const [reasonCodes, setReasonCodes] = useState("");
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(done);
      setReasonCodes("");
      setMessage("");
      await qc.invalidateQueries({ queryKey: ["queue"] });
    } catch (e) {
      setActionError(e);
      if (e instanceof ApiError && e.code === "LISTING_VERSION_CONFLICT") {
        setNotice("This listing changed while you were reviewing it — reloaded the latest version. Check it again before deciding.");
      }
    } finally {
      setBusy(false);
      await refetch();
    }
  }

  if (error) return <ErrorNote error={error} />;
  if (!l)
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading listing">
        <Skeleton className="h-8 w-2/3 bg-surface-sunken" />
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <Skeleton className="h-72 w-full rounded-2xl bg-surface-sunken" />
          <Skeleton className="h-72 w-full rounded-2xl bg-surface-sunken" />
        </div>
      </div>
    );

  const codes = reasonCodes.split(",").map((c) => c.trim().toLowerCase().replace(/\s+/g, "_")).filter(Boolean);
  const reason = message.trim() || codes.join(", ");
  const v = l.version;

  const act = (a: Action) => {
    switch (a) {
      case "approve":
      case "reject":
      case "request_changes":
        return run(
          () => api(`/listings/${id}/decision`, { method: "POST", body: { expectedVersion: v, decision: a, reasonCodes: codes, ...(message.trim() ? { ownerMessage: message.trim() } : {}) } }),
          a === "approve" ? "Approved — the owner will be notified." : "Decision saved — the owner will be notified."
        );
      case "hold":
        return run(() => api(`/listings/${id}/hold`, { method: "POST", body: { expectedVersion: v, reason } }), "Held — auto-approval is stopped until a decision.");
      case "release_hold":
        return run(() => api(`/listings/${id}/hold`, { method: "DELETE", body: { expectedVersion: v, reason } }), "Hold released — the 5-minute window restarted.");
      case "pause":
        return run(() => api(`/listings/${id}/pause`, { method: "POST", body: { expectedVersion: v, reason } }), "Paused — hidden from renters.");
      case "restore":
        return run(() => api(`/listings/${id}/restore`, { method: "POST", body: { expectedVersion: v, reason } }), "Restored — visible again.");
      case "confirm_post":
        return run(() => api(`/listings/${id}/post-review`, { method: "POST", body: { expectedVersion: v, outcome: "confirm" } }), "Post-review confirmed.");
      case "reject_post":
        return run(() => api(`/listings/${id}/post-review`, { method: "POST", body: { expectedVersion: v, outcome: "reject", reasonCodes: codes, ...(message.trim() ? { ownerMessage: message.trim() } : {}) } }), "Rejected after post-review.");
    }
  };

  const pending = l.status === "pending";
  const needsReason = codes.length === 0;
  const needsText = reason.length < 3;

  return (
    <div>
      <PageHeader
        title={l.title}
        subtitle={`${l.locality}, ${l.city} · ₹${l.rent.toLocaleString("en-IN")}/month · version ${l.version}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge tone={l.status === "approved" ? "success" : l.status === "rejected" ? "danger" : "info"}>{l.status}</Badge>
            {l.heldAt && <Badge tone="info">Held · {l.holdReason}</Badge>}
            {l.pausedAt && <Badge tone="danger">Paused</Badge>}
            {l.approvalSource && <Badge>{l.approvalSource === "manual" ? "Manually approved" : "Automatically approved"}</Badge>}
            {pending && !l.heldAt && l.secondsUntilAutoApproval !== null && (
              <Badge tone="warning">Auto-approves in {formatDuration(l.secondsUntilAutoApproval)}</Badge>
            )}
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {l.images.map((img) => (
                <a key={img.id} href={img.cloudinaryUrl} target="_blank" rel="noreferrer noopener">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.cloudinaryUrl} alt={`Photo ${img.position + 1}`} className="aspect-[4/3] w-full rounded-xl object-cover" />
                </a>
              ))}
            </div>
            {l.images.length < 3 && <p className="mt-2 text-sm text-destructive-pressed">Only {l.images.length} photo(s) — at least 3 are required to approve.</p>}
            {/* Owner-supplied text is rendered as text, never as HTML. */}
            <p className="mt-4 whitespace-pre-line text-sm text-body">{l.description ?? "No description."}</p>
            <p className="mt-3 text-sm text-muted">
              Deposit {l.deposit ? `₹${l.deposit.toLocaleString("en-IN")}` : "—"} · Amenities:{" "}
              {Object.entries(l.amenities ?? {}).filter(([, on]) => on).map(([k]) => k).join(", ") || "—"}
            </p>
          </Card>

          <MediaPanel media={l.context.media} />
          <ChangesPanel changes={l.context.changesSinceApproval} />

          <Card>
            <p className="font-semibold text-ink">Moderation history</p>
            <ul className="mt-3 space-y-2 text-sm">
              {l.decisions.length === 0 && <li className="text-muted">No decisions yet.</li>}
              {l.decisions.map((d) => (
                <li key={d.id} className="flex flex-wrap gap-2">
                  <span className="text-muted">{formatDate(d.createdAt)}</span>
                  <Badge>{d.decision.replace(/_/g, " ")}</Badge>
                  <span className="text-muted">v{d.listingVersion}→v{d.resultingVersion} · {d.actorType === "system" ? "system" : "admin"}</span>
                  {d.reasonCodes.length > 0 && <span className="font-mono text-xs text-body">{d.reasonCodes.join(", ")}</span>}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <p className="font-semibold text-ink">Reports on this listing</p>
            <ul className="mt-3 space-y-2 text-sm">
              {l.reports.length === 0 && <li className="text-muted">None.</li>}
              {l.reports.map((r) => (
                <li key={r.id}>
                  <Badge tone={r.status === "pending" ? "warning" : "neutral"}>{r.reasonCategory}</Badge>{" "}
                  <span className="text-body">{r.reason}</span> <span className="text-muted">— {r.reporter.fullName ?? "a user"}, {formatDate(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <p className="font-semibold text-ink">Owner</p>
            <p className="mt-1 text-sm text-body">{l.owner.fullName ?? "—"} · {l.owner.phone ?? "no phone"}</p>
            <p className="text-sm text-muted">
              Joined {formatDate(l.owner.createdAt)} · {l.owner._count.listings} listing(s) · phone {l.owner.phoneVerified ? "verified" : "not verified"}
              {l.owner.banned && " · BANNED"}
            </p>
          </Card>
          <OwnerPlanPanel plan={l.context.ownerPlan} />
          <RiskPanel risk={l.context.risk} />
          <ResponsePanel r={l.context.responseBehaviour} />

          <Card>
            <p className="font-semibold text-ink">Decide</p>
            <label className="mt-3 block text-xs font-semibold text-muted" htmlFor="codes">Reason codes (comma separated)</label>
            <Input id="codes" value={reasonCodes} onChange={(e) => setReasonCodes(e.target.value)} placeholder="e.g. photos_not_of_room" />
            <label className="mt-3 block text-xs font-semibold text-muted" htmlFor="msg">Message to the owner / reason</label>
            <Textarea id="msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} />
            <div className="mt-3 space-y-2">
              <ErrorNote error={actionError} />
              {notice && <p className="rounded-xl bg-primary-light px-3 py-2 text-sm text-primary-pressed">{notice}</p>}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {pending && can("listings.approve") && <Button disabled={busy} onClick={() => act("approve")}>Approve</Button>}
              {pending && can("listings.reject") && (
                <>
                  <Button variant="secondary" disabled={busy || needsReason} onClick={() => act("request_changes")}>Request changes</Button>
                  <Button variant="danger" disabled={busy || needsReason} onClick={() => act("reject")}>Reject</Button>
                </>
              )}
              {pending && !l.heldAt && can("listings.hold") && <Button variant="secondary" disabled={busy || needsText} onClick={() => act("hold")}>Hold</Button>}
              {pending && l.heldAt && can("listings.hold") && <Button variant="secondary" disabled={busy || needsText} onClick={() => act("release_hold")}>Release hold</Button>}
              {l.status === "approved" && !l.pausedAt && can("listings.pause") && <Button variant="danger" disabled={busy || needsText} onClick={() => act("pause")}>Pause</Button>}
              {l.pausedAt && can("listings.restore") && <Button variant="secondary" disabled={busy || needsText} onClick={() => act("restore")}>Restore</Button>}
              {l.status === "approved" && l.postReviewStatus && l.postReviewStatus !== "confirmed" && (
                <>
                  {can("listings.approve") && <Button disabled={busy} onClick={() => act("confirm_post")}>Confirm (post-review)</Button>}
                  {can("listings.reject") && <Button variant="danger" disabled={busy || needsReason} onClick={() => act("reject_post")}>Reject (post-review)</Button>}
                </>
              )}
            </div>
            <div className="mt-4 flex gap-2 border-t border-hairline pt-4">
              <Button variant="ghost" disabled={busy} onClick={() => run(() => api(`/listings/${id}/claim`, { method: "POST" }), "Claimed — teammates can see you're reviewing this.")}>
                {l.claimActive ? "Renew claim" : "Claim"}
              </Button>
              {l.claimActive && (
                <Button variant="ghost" disabled={busy} onClick={() => run(() => api(`/listings/${id}/claim`, { method: "DELETE" }), "Claim released.")}>Release claim</Button>
              )}
            </div>
          </Card>

          <Card>
            <p className="font-semibold text-ink">Internal notes</p>
            <p className="text-xs text-muted">Never shown to the owner.</p>
            <ul className="mt-3 space-y-2 text-sm">
              {l.notes.map((n) => (
                <li key={n.id}><span className="text-muted">{formatDate(n.createdAt)}:</span> <span className="whitespace-pre-line text-body">{n.body}</span></li>
              ))}
            </ul>
            <Textarea className="mt-3" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} />
            <Button
              variant="secondary"
              className="mt-2"
              disabled={busy || !note.trim()}
              onClick={() => run(async () => { await api(`/listings/${id}/note`, { method: "POST", body: { body: note.trim() } }); setNote(""); }, "Note added.")}
            >
              Add note
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
