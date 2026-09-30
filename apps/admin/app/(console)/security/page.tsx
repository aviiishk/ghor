"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import { useMe, useStepUp } from "@/components/providers";
import { useReasonDialog } from "@/components/reason-dialog";
import { Badge, Button, Card, ErrorNote, PageHeader, formatDate } from "@/components/primitives";

interface SessionRow {
  id: string;
  method: string;
  createdAt: string;
  lastSeenAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  userAgent: string | null;
  current: boolean;
}

export default function SecurityPage() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { withStepUp } = useStepUp();
  const { data: sessions, error } = useQuery({ queryKey: ["sessions"], queryFn: () => api<SessionRow[]>("/api/auth/sessions") });
  const [codes, setCodes] = useState<string[] | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  const dialog = useReasonDialog();
  function regenerate() {
    setActionError(null);
    dialog.ask({
      title: "Generate 10 new recovery codes?",
      description: "All your current codes stop working immediately. Requires a fresh authenticator code.",
      confirmLabel: "Generate new codes",
      requireReason: false,
      onConfirm: async () => {
        const res = await withStepUp(() => api<{ recoveryCodes: string[] }>("/api/auth/recovery/regenerate", { method: "POST" }));
        setCodes(res.recoveryCodes);
        await qc.invalidateQueries({ queryKey: ["me"] });
      }
    });
  }

  async function revoke(id: string) {
    await api(`/api/auth/sessions/${id}`, { method: "DELETE" }).catch(setActionError);
    await qc.invalidateQueries({ queryKey: ["sessions"] });
  }

  return (
    <div>
      <PageHeader title="My security" subtitle="Sessions end after 30 minutes idle and 12 hours at most." />
      <ErrorNote error={error ?? actionError} />
      {dialog.element}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <p className="font-semibold text-ink">Recovery codes</p>
          <p className="mt-1 text-sm text-muted">
            {me ? `${me.recoveryCodesRemaining} of 10 unused.` : ""} {me && me.recoveryCodesRemaining <= 2 && <Badge tone="warning">Regenerate soon</Badge>}
          </p>
          {codes ? (
            <>
              <p className="mt-3 text-sm font-semibold text-destructive-pressed">Shown once — save them now.</p>
              <ol className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-surface p-3 font-mono text-sm text-ink">
                {codes.map((c) => <li key={c}>{c}</li>)}
              </ol>
              <Button variant="secondary" className="mt-3" onClick={() => setCodes(null)}>I’ve saved them</Button>
            </>
          ) : (
            <Button variant="secondary" className="mt-3" onClick={regenerate}>Generate new codes</Button>
          )}
        </Card>
        <Card>
          <p className="font-semibold text-ink">Active sessions</p>
          <ul className="mt-3 space-y-2 text-sm">
            {sessions?.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2">
                {s.current && <Badge tone="info">this device</Badge>}
                <span className="text-body">Started {formatDate(s.createdAt)}</span>
                <span className="text-muted">· last active {formatDate(s.lastSeenAt)}</span>
                {!s.current && <Button variant="ghost" onClick={() => revoke(s.id)}>Sign out</Button>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
