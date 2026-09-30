"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import type { Page } from "@/types/admin";
import { Badge, Card, Empty, ErrorNote, PageHeader, formatDate } from "@/components/primitives";

interface Row {
  id: string;
  fullName: string | null;
  idVerificationStatus: string;
  createdAt: string;
}

// Senior-reviewer capability only (D-47: super admins need an explicit grant). Phase 0 shows
// verification STATUS only — no documents, no evidence, no grant/revoke actions yet.
export default function TrustPage() {
  const { data, error } = useQuery({
    queryKey: ["trust"],
    queryFn: () => api<Page<Row> & { counts: Record<string, number> }>("/trust/verification-statuses?limit=100")
  });
  return (
    <div>
      <PageHeader title="Verification status" subtitle="Read-only in Phase 0. Verification cases and GHOR Verified actions arrive in Phase 1." />
      <ErrorNote error={error} />
      {data && (
        <Card className="mb-4">
          <div className="flex flex-wrap gap-3 text-sm">
            {Object.entries(data.counts).map(([k, n]) => (
              <span key={k}><Badge>{k}</Badge> {n}</span>
            ))}
          </div>
        </Card>
      )}
      {data && !data.items.length && <Empty title="No verification activity yet" />}
      <ul className="space-y-2">
        {data?.items.map((r) => (
          <li key={r.id} className="flex items-center justify-between rounded-xl bg-canvas px-4 py-3 ring-1 ring-hairline">
            <span className="text-ink">{r.fullName ?? "—"}</span>
            <span className="text-sm text-muted"><Badge>{r.idVerificationStatus}</Badge> joined {formatDate(r.createdAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
