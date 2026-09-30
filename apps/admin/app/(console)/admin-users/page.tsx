"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import { useMe, useStepUp } from "@/components/providers";
import { useReasonDialog } from "@/components/reason-dialog";
import { Badge, Button, ErrorNote, Input, PageHeader, formatDate } from "@/components/primitives";

interface AdminAccount {
  id: string;
  name: string | null;
  phone: string | null;
  role: "admin" | "senior_reviewer" | "super_admin";
  seniorCapability: boolean;
  status: "active" | "disabled";
  totpEnrolled: boolean;
  totpLocked: boolean;
  activeSessions: number;
  lastSeenAt: string | null;
}

const ROLES = ["admin", "senior_reviewer", "super_admin"] as const;

// Super admin only. Every change here requires a fresh step-up and a recorded reason; the
// API refuses self-changes, keeps at least one active super admin, and only grants the
// senior-reviewer capability (GHOR Verified authority) to super admins, explicitly.
export default function AdminUsersPage() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { withStepUp } = useStepUp();
  const { data, error } = useQuery({ queryKey: ["admin-users"], queryFn: () => api<AdminAccount[]>("/admin-users") });
  const [phone, setPhone] = useState("+91");
  const [role, setRole] = useState<(typeof ROLES)[number]>("admin");
  const [actionError, setActionError] = useState<unknown>(null);

  const dialog = useReasonDialog();
  // Every admin-account change: reason dialog → (API may require) step-up → refresh.
  function mutate(fn: (reason: string) => Promise<unknown>, title: string, destructive = false) {
    setActionError(null);
    dialog.ask({
      title,
      confirmLabel: "Confirm",
      destructive,
      description: "Requires a fresh authenticator code. The change is recorded in the audit log.",
      onConfirm: async (reason) => {
        await withStepUp(() => fn(reason));
        await qc.invalidateQueries({ queryKey: ["admin-users"] });
      }
    });
  }

  return (
    <div>
      <PageHeader title="Admin users" subtitle="Roles, the senior-reviewer capability, authenticator resets and account status." />
      <form
        className="mb-6 flex flex-wrap items-end gap-2 rounded-2xl bg-canvas p-4 ring-1 ring-hairline"
        onSubmit={(e) => {
          e.preventDefault();
          void mutate((reason) => api("/admin-users", { method: "POST", body: { phone, role, reason } }), `Grant ${role} to ${phone}`);
        }}
      >
        <div>
          <label className="block text-xs font-semibold text-muted" htmlFor="new-phone">Existing GHOR account phone</label>
          <Input id="new-phone" value={phone} onChange={(e) => setPhone(e.target.value.trim())} />
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])} className="h-10 rounded-xl border border-hairline bg-canvas px-2 text-sm">
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <Button type="submit">Add admin</Button>
      </form>
      <ErrorNote error={error ?? actionError} />
      {dialog.element}
      <ul className="space-y-3">
        {data?.map((a) => {
          const self = a.id === me?.adminUserId;
          return (
            <li key={a.id} className="rounded-2xl bg-canvas p-4 shadow-card ring-1 ring-hairline">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink">{a.name ?? "—"}</span>
                <span className="font-mono text-xs text-muted">{a.phone}</span>
                <Badge tone="info">{a.role}{a.seniorCapability ? " + senior" : ""}</Badge>
                {a.status === "disabled" && <Badge tone="danger">disabled</Badge>}
                {!a.totpEnrolled && <Badge tone="warning">no authenticator</Badge>}
                {a.totpLocked && <Badge tone="danger">locked</Badge>}
                <span className="text-xs text-muted">{a.activeSessions} session(s) · last seen {formatDate(a.lastSeenAt)}</span>
                {self && <Badge>you</Badge>}
              </div>
              {!self && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const next = e.target.value;
                      e.target.value = "";
                      if (next) void mutate((reason) => api(`/admin-users/${a.id}/role`, { method: "PUT", body: { role: next, reason } }), `Change role to ${next}`);
                    }}
                    className="h-9 rounded-xl border border-hairline bg-canvas px-2 text-sm"
                    aria-label="Change role"
                  >
                    <option value="">Change role…</option>
                    {ROLES.filter((r) => r !== a.role).map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {a.role === "super_admin" && (
                    <Button
                      variant="secondary"
                      onClick={() => mutate((reason) => api(`/admin-users/${a.id}/senior-capability`, { method: "PUT", body: { enabled: !a.seniorCapability, reason } }), a.seniorCapability ? "Remove GHOR Verified authority" : "Grant GHOR Verified authority")}
                    >
                      {a.seniorCapability ? "Remove senior capability" : "Grant senior capability"}
                    </Button>
                  )}
                  <Button variant="secondary" onClick={() => mutate((reason) => api(`/admin-users/${a.id}/totp-reset`, { method: "POST", body: { reason } }), "Reset authenticator")}>Reset authenticator</Button>
                  <Button variant="secondary" onClick={() => mutate((reason) => api(`/admin-users/${a.id}/sessions/revoke-all`, { method: "POST", body: { reason } }), "Sign out everywhere")}>Sign out everywhere</Button>
                  <Button
                    variant={a.status === "active" ? "danger" : "secondary"}
                    onClick={() => mutate((reason) => api(`/admin-users/${a.id}/status`, { method: "PUT", body: { status: a.status === "active" ? "disabled" : "active", reason } }), a.status === "active" ? "Disable admin" : "Re-enable admin", a.status === "active")}
                  >
                    {a.status === "active" ? "Disable" : "Enable"}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
