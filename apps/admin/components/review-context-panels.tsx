import Link from "next/link";
import type { ReviewContext, Unavailable } from "@/types/admin";
import { Badge, Card, formatDate } from "@/components/primitives";

// Review-workspace panels (MPB §26.10 / ADM-10), rendered only from data the API really
// has. Anything that needs data GHOR doesn't collect yet is shown as "Phase 1", never
// estimated.

function Later({ what }: { what: Unavailable }) {
  return (
    <p className="text-xs text-muted">
      <Badge>{what.phase.split(" ")[0]} {what.phase.split(" ")[1]}</Badge> {what.phase.replace(/^Phase \d+ /, "")}
    </p>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right text-ink">{children}</span>
    </div>
  );
}

const counts = (r: Record<string, number>) =>
  Object.keys(r).length ? Object.entries(r).map(([k, n]) => `${n} ${k}`).join(", ") : "none";

export function MediaPanel({ media }: { media: ReviewContext["media"] }) {
  return (
    <Card>
      <p className="font-semibold text-ink">Media</p>
      <Row label="Photos">{media.photoCount}</Row>
      <Row label="Formats">{[...new Set(media.photos.map((p) => p.format ?? "unknown"))].join(", ") || "—"}</Row>
      <div className="mt-2">
        <p className="text-sm font-medium text-ink">Same photo used on other listings</p>
        {media.exactDuplicates.length === 0 ? (
          <p className="text-sm text-muted">No exact reuse found.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm">
            {media.exactDuplicates.slice(0, 8).map((d) => (
              <li key={`${d.listingId}-${d.url}`} className="flex flex-wrap items-center gap-2">
                <Badge tone={d.sameOwner ? "neutral" : "warning"}>{d.sameOwner ? "same owner" : "different owner"}</Badge>
                <Link href={`/moderation/${d.listingId}`} className="text-primary hover:underline">{d.listingTitle}</Link>
                <span className="text-xs text-muted">{d.listingStatus}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-3 space-y-1">
        <Later what={media.visualSimilarity} />
        <Later what={media.video} />
      </div>
    </Card>
  );
}

export function ChangesPanel({ changes }: { changes: ReviewContext["changesSinceApproval"] }) {
  return (
    <Card>
      <p className="font-semibold text-ink">Changes since last approval</p>
      {!changes ? (
        <p className="mt-1 text-sm text-muted">Never approved — nothing to compare yet.</p>
      ) : changes.changedFields.length === 0 ? (
        <p className="mt-1 text-sm text-muted">
          No content changes since approval (v{changes.approvedVersion}, {formatDate(changes.approvedAt)}).
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            v{changes.approvedVersion} (approved {formatDate(changes.approvedAt)}) → v{changes.latestVersion}
          </p>
          <dl className="mt-2 space-y-2 text-sm">
            {changes.changedFields.map((f) => (
              <div key={f}>
                <dt className="font-medium text-ink">{f}</dt>
                <dd className="text-xs text-muted">
                  <span className="line-through">{JSON.stringify(changes.before[f])?.slice(0, 200)}</span>
                  <br />
                  <span className="text-body">{JSON.stringify(changes.after[f])?.slice(0, 200)}</span>
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </Card>
  );
}

export function RiskPanel({ risk }: { risk: ReviewContext["risk"] }) {
  const r = risk.rentVsLocality;
  return (
    <Card>
      <p className="font-semibold text-ink">Risk information</p>
      <p className="text-xs text-muted">Facts for the reviewer — not a score.</p>
      <Row label="Owner account age">{risk.ownerAccountAgeDays} days</Row>
      <Row label="Owner phone">{risk.ownerPhoneVerified ? "verified" : <Badge tone="warning">not verified</Badge>}</Row>
      <Row label="Owner banned">{risk.ownerBanned ? <Badge tone="danger">yes</Badge> : "no"}</Row>
      <Row label="Reports against owner">{counts(risk.reportsAgainstOwner)}</Row>
      <Row label="Past rejections (owner)">{risk.previousRejectionsForOwner}</Row>
      <Row label="Owner’s other listings">{counts(risk.ownerOtherListings)}</Row>
      <Row label="Rent vs locality median">
        {r.medianRent === null
          ? `no comparable approved listings`
          : `₹${r.medianRent.toLocaleString("en-IN")} median of ${r.comparableApprovedListings} · ${r.differencePercent! > 0 ? "+" : ""}${r.differencePercent}%`}
      </Row>
      <div className="mt-2">
        <Later what={risk.automatedFlags} />
      </div>
    </Card>
  );
}

export function OwnerPlanPanel({ plan }: { plan: ReviewContext["ownerPlan"] }) {
  return (
    <Card>
      <p className="font-semibold text-ink">Owner plan</p>
      <Row label="Plan">
        <Badge>{plan.plan === "free" ? "Free" : plan.plan}</Badge>
      </Row>
      <Row label="GHOR Verified">{plan.ghorVerified ? "yes" : "no"}</Row>
      <p className="mt-1 text-xs text-muted">{plan.note}</p>
    </Card>
  );
}

export function ResponsePanel({ r }: { r: ReviewContext["responseBehaviour"] }) {
  return (
    <Card>
      <p className="font-semibold text-ink">Response behaviour</p>
      <p className="text-xs text-muted">Counts only — no chat content is ever shown here.</p>
      <Row label="Views (unique)">{r.views} ({r.uniqueViewers})</Row>
      <Row label="Contact taps">{r.contactTaps}</Row>
      <Row label="Inquiries">{r.inquiries}</Row>
      <Row label="Owner replied">{r.replied}</Row>
      <Row label="Response rate">{r.responseRate === null ? "—" : `${r.responseRate}%`}</Row>
    </Card>
  );
}
