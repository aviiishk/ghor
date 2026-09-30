"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import type { Page } from "@/types/admin";
import { useCan, useStepUp } from "@/components/providers";
import { useReasonDialog } from "@/components/reason-dialog";
import { Badge, Button, ErrorNote, Input, PageHeader, formatDate } from "@/components/primitives";

interface User {
  id: string;
  fullName: string | null;
  phone: string | null;
  role: string;
  banned: boolean;
  createdAt: string;
  isAdmin: boolean;
  hasGoogle: boolean;
  _count: { listings: number };
}

// Marketplace accounts. Phone numbers arrive masked from the API. Suspension needs a
// senior reviewer / super admin and a fresh step-up; admin accounts can't be suspended here.
export default function UsersPage() {
  const qc = useQueryClient();
  const can = useCan();
  const { withStepUp } = useStepUp();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const { data, error } = useQuery({
    queryKey: ["users", search],
    queryFn: () => api<Page<User>>(`/users?limit=50${search ? `&q=${encodeURIComponent(search)}` : ""}`)
  });
  const [actionError, setActionError] = useState<unknown>(null);

  const dialog = useReasonDialog();
  function toggleBan(u: User) {
    setActionError(null);
    dialog.ask({
      title: `${u.banned ? "Unban" : "Ban"} ${u.fullName ?? "this user"}?`,
      description: u.banned
        ? "They will be able to sign in again."
        : "They are signed out everywhere and can’t sign in. Requires a fresh authenticator code.",
      confirmLabel: u.banned ? "Unban" : "Ban",
      destructive: !u.banned,
      onConfirm: async (reason) => {
        await withStepUp(() => api(`/users/${u.id}/${u.banned ? "unban" : "ban"}`, { method: "POST", body: { reason } }));
        await qc.invalidateQueries({ queryKey: ["users"] });
      }
    });
  }

  return (
    <div>
      <PageHeader title="Users" subtitle="Renters and owners. Search by name or the last digits of a phone number." />
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.trim());
        }}
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or last 4+ digits" className="max-w-sm" />
        <Button type="submit" variant="secondary">Search</Button>
      </form>
      <ErrorNote error={error ?? actionError} />
      {dialog.element}
      <div className="overflow-x-auto rounded-2xl bg-canvas shadow-card ring-1 ring-hairline">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-4 py-2 font-semibold">Name</th>
              <th className="px-4 py-2 font-semibold">Phone</th>
              <th className="px-4 py-2 font-semibold">Role</th>
              <th className="px-4 py-2 font-semibold">Listings</th>
              <th className="px-4 py-2 font-semibold">Joined</th>
              <th className="px-4 py-2 font-semibold">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((u) => (
              <tr key={u.id} className="border-t border-hairline">
                <td className="px-4 py-2 font-medium text-ink">{u.fullName ?? "—"}</td>
                <td className="px-4 py-2 font-mono text-muted">{u.phone ?? (u.hasGoogle ? "Google" : "—")}</td>
                <td className="px-4 py-2">{u.isAdmin ? <Badge tone="info">admin</Badge> : u.role}</td>
                <td className="px-4 py-2 text-muted">{u._count.listings}</td>
                <td className="px-4 py-2 text-muted">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-2">{u.banned ? <Badge tone="danger">Banned</Badge> : <Badge tone="success">Active</Badge>}</td>
                <td className="px-4 py-2 text-right">
                  {can("users.suspend") && !u.isAdmin && (
                    <Button variant={u.banned ? "secondary" : "danger"} onClick={() => toggleBan(u)}>{u.banned ? "Unban" : "Ban"}</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
