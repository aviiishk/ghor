"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import { useStepUp } from "@/components/providers";
import { useReasonDialog } from "@/components/reason-dialog";
import { Badge, Button, ErrorNote, Input, PageHeader, formatDate } from "@/components/primitives";

interface ConfigKey {
  key: string;
  description: string;
  public: boolean;
  value: unknown;
  isDefault: boolean;
  valid: boolean;
  version: number;
  updatedAt: string | null;
}

// Only allowlisted keys exist; each value is validated per key by the API, every save
// carries the version the editor saw (a concurrent change → 409, reload), needs a step-up
// and a reason, and is audited with before/after.
export default function ConfigPage() {
  const qc = useQueryClient();
  const { withStepUp } = useStepUp();
  const { data, error } = useQuery({
    queryKey: ["config"],
    queryFn: () => api<{ keys: ConfigKey[]; unknownKeys: { key: string }[] }>("/config")
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<unknown>(null);

  const dialog = useReasonDialog();
  function save(row: ConfigKey) {
    let value: unknown;
    try {
      value = JSON.parse(drafts[row.key] ?? JSON.stringify(row.value));
    } catch {
      setActionError(new Error("Value must be JSON: a number, true/false, or null"));
      return;
    }
    setActionError(null);
    dialog.ask({
      title: `Change ${row.key}?`,
      description: `New value: ${JSON.stringify(value)}. Requires a fresh authenticator code; the old and new values are audited.`,
      confirmLabel: "Save setting",
      onConfirm: async (reason) => {
        try {
          await withStepUp(() => api(`/config/${row.key}`, { method: "PATCH", body: { value, expectedVersion: row.version, reason } }));
          setDrafts(({ [row.key]: _discard, ...rest }) => rest);
        } finally {
          await qc.invalidateQueries({ queryKey: ["config"] });
        }
      }
    });
  }

  return (
    <div>
      <PageHeader title="Configuration" subtitle="Allowlisted settings only. Public ones are read by the apps." />
      <ErrorNote error={error ?? actionError} />
      {dialog.element}
      <ul className="space-y-3">
        {data?.keys.map((row) => (
          <li key={row.key} className="rounded-2xl bg-canvas p-4 shadow-card ring-1 ring-hairline">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-semibold text-ink">{row.key}</span>
              {row.public ? <Badge tone="info">public</Badge> : <Badge>server only</Badge>}
              {row.isDefault && <Badge>default</Badge>}
              {!row.valid && <Badge tone="danger">stored value invalid — default in use</Badge>}
              <span className="text-xs text-muted">v{row.version} · {formatDate(row.updatedAt)}</span>
            </div>
            <p className="mt-1 text-sm text-muted">{row.description}</p>
            <div className="mt-3 flex gap-2">
              <Input
                className="max-w-xs font-mono"
                value={drafts[row.key] ?? JSON.stringify(row.value)}
                onChange={(e) => setDrafts({ ...drafts, [row.key]: e.target.value })}
              />
              <Button variant="secondary" disabled={drafts[row.key] === undefined} onClick={() => save(row)}>Save</Button>
            </div>
          </li>
        ))}
      </ul>
      {!!data?.unknownKeys.length && (
        <p className="mt-6 text-sm text-muted">
          Unrecognised keys in the database (never served, not editable): {data.unknownKeys.map((k) => k.key).join(", ")}
        </p>
      )}
    </div>
  );
}
