"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import type { AuditRow, Page } from "@/types/admin";
import { useCan, useStepUp } from "@/components/providers";
import { useReasonDialog } from "@/components/reason-dialog";
import { Badge, Button, ErrorNote, Input, PageHeader, formatDate } from "@/components/primitives";

// Read-only by design: the API has no endpoint to edit or delete audit rows, and the
// table rejects UPDATE/DELETE at the database level. Visibility is scoped by role on the
// server (admin: own actions; senior: own + trust; super admin: everything).
export default function AuditPage() {
  const can = useCan();
  const { withStepUp } = useStepUp();
  const [action, setAction] = useState("");
  const [filter, setFilter] = useState("");
  const [exportError, setExportError] = useState<unknown>(null);
  const q = useInfiniteQuery({
    queryKey: ["audit", filter],
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      api<Page<AuditRow> & { scope: string }>(
        `/audit?limit=50${pageParam ? `&cursor=${pageParam}` : ""}${filter ? `&action=${encodeURIComponent(filter)}` : ""}`
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined
  });
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  const scope = q.data?.pages[0]?.scope;

  const dialog = useReasonDialog();
  function exportLast30Days() {
    setExportError(null);
    dialog.ask({
      title: "Export the last 30 days of the audit log?",
      description: "Exports are themselves recorded. Requires a fresh authenticator code.",
      confirmLabel: "Export",
      onConfirm: async (reason) => {
        const to = new Date();
        const from = new Date(to.getTime() - 30 * 86400_000);
        const data = await withStepUp(() =>
          api<{ rows: AuditRow[] }>("/audit/export", { method: "POST", body: { from: from.toISOString(), to: to.toISOString(), reason } })
        );
        const blob = new Blob([JSON.stringify(data.rows, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ghor-audit-${to.toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  }

  return (
    <div>
      <PageHeader
        title="Audit log"
        subtitle={scope ? `Showing: ${scope === "all" ? "all actions" : scope === "own" ? "your own actions" : "your actions + trust actions"}` : undefined}
        actions={can("audit.export") ? <Button variant="secondary" onClick={exportLast30Days}>Export last 30 days</Button> : undefined}
      />
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setFilter(action.trim());
        }}
      >
        <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="Action prefix, e.g. listing. or admin.totp" className="max-w-sm" />
        <Button type="submit" variant="secondary">Filter</Button>
      </form>
      <ErrorNote error={q.error ?? exportError} />
      {dialog.element}
      <div className="overflow-x-auto rounded-2xl bg-canvas shadow-card ring-1 ring-hairline">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-4 py-2 font-semibold">When</th>
              <th className="px-4 py-2 font-semibold">Action</th>
              <th className="px-4 py-2 font-semibold">Actor</th>
              <th className="px-4 py-2 font-semibold">Target</th>
              <th className="px-4 py-2 font-semibold">Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-hairline align-top">
                <td className="whitespace-nowrap px-4 py-2 text-muted">{formatDate(r.createdAt)}</td>
                <td className="px-4 py-2">
                  <Badge tone={r.category === "security" ? "warning" : "neutral"}>{r.category}</Badge>{" "}
                  <span className="font-mono text-xs text-ink">{r.action}</span>
                </td>
                <td className="px-4 py-2 text-xs text-muted">{r.actorType}{r.actorRole ? ` · ${r.actorRole}` : ""}<br /><span className="font-mono">{r.actorId?.slice(0, 8) ?? ""}</span></td>
                <td className="px-4 py-2 font-mono text-xs text-muted">{r.targetType ? `${r.targetType}:${r.targetId?.slice(0, 8)}` : "—"}</td>
                <td className="px-4 py-2 text-xs text-body">{r.reason ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {q.hasNextPage && (
        <Button variant="secondary" className="mt-4" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
          Load more
        </Button>
      )}
    </div>
  );
}
