"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import { useCan } from "@/components/providers";
import { Badge, Button, Card, ErrorNote, PageHeader, formatDate } from "@/components/primitives";

interface Health {
  checkedAt: string;
  database: { ok: boolean; latencyMs: number | null };
  jobsEnabled: boolean;
  jobs: { name: string; lastRunAt: string | null; lastSuccessAt: string | null; consecutiveFailures: number; lastError: string | null; stale: boolean }[];
  outbox: { backlog: number; oldestAgeSeconds: number | null; deadLetters: number };
  alerts: { id: string; kind: string; severity: string; message: string; createdAt: string }[];
}

export default function SystemPage() {
  const qc = useQueryClient();
  const can = useCan();
  const { data, error } = useQuery({
    queryKey: ["health"],
    queryFn: () => api<Health>("/system/health", {}, { background: true }),
    refetchInterval: 30_000
  });

  async function ack(id: string) {
    await api(`/system/alerts/${id}/ack`, { method: "POST", body: {} });
    await qc.invalidateQueries({ queryKey: ["health"] });
  }

  return (
    <div>
      <PageHeader title="System health" subtitle={data ? `Checked ${formatDate(data.checkedAt)}` : undefined} />
      <ErrorNote error={error} />
      {data && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <p className="text-sm text-muted">Database</p>
            <p className="mt-1 font-semibold text-ink">
              {data.database.ok ? <Badge tone="success">Connected</Badge> : <Badge tone="danger">Unreachable</Badge>} {data.database.latencyMs ?? "—"} ms
            </p>
          </Card>
          <Card>
            <p className="text-sm text-muted">Notification outbox</p>
            <p className="mt-1 text-ink">
              {data.outbox.backlog} waiting · {data.outbox.deadLetters} abandoned
            </p>
          </Card>
          <Card>
            <p className="text-sm text-muted">Background jobs</p>
            <p className="mt-1 text-ink">{data.jobsEnabled ? "Enabled on this instance" : "Disabled on this instance"}</p>
          </Card>
          <Card className="lg:col-span-3">
            <p className="font-semibold text-ink">Jobs</p>
            <ul className="mt-2 space-y-1 text-sm">
              {data.jobs.length === 0 && <li className="text-muted">No job has run yet.</li>}
              {data.jobs.map((j) => (
                <li key={j.name} className="flex flex-wrap gap-2">
                  <span className="font-mono text-ink">{j.name}</span>
                  {j.stale ? <Badge tone="warning">Stale</Badge> : <Badge tone="success">Healthy</Badge>}
                  <span className="text-muted">last success {formatDate(j.lastSuccessAt)}</span>
                  {j.consecutiveFailures > 0 && <Badge tone="danger">{j.consecutiveFailures} failures</Badge>}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="lg:col-span-3">
            <p className="font-semibold text-ink">Open alerts</p>
            <ul className="mt-2 space-y-2 text-sm">
              {data.alerts.length === 0 && <li className="text-muted">None.</li>}
              {data.alerts.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2">
                  <Badge tone={a.severity === "critical" ? "danger" : a.severity === "warning" ? "warning" : "neutral"}>{a.severity}</Badge>
                  <span className="text-body">{a.message}</span>
                  <span className="text-xs text-muted">{formatDate(a.createdAt)}</span>
                  {can("system.health.ack") && <Button variant="ghost" onClick={() => ack(a.id)}>Acknowledge</Button>}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
