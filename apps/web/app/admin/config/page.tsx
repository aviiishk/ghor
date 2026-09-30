'use client';

import { useAppConfig } from '@/features/admin/hooks';

// Read-only in the legacy console (Phase 0, 2026-09-29): configuration changes need a
// super admin with a TOTP step-up, so they are made in the new admin console. Only keys
// in the API's allowlist exist; public ones are what the apps read.
export default function AdminConfigPage() {
  const { data: config, isLoading, isError } = useAppConfig();

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-6">App config</h1>
      <p className="text-muted text-sm mb-6">
        Current tunables (ad frequency, feed page size, report threshold, moderation settings).
        Changes are made in the GHOR admin console, where they need a super admin and an
        authenticator re-check, and are recorded in the audit log.
      </p>

      {isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : isError ? (
        <p className="text-muted">Couldn&apos;t load config (super admins only).</p>
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-muted text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Key</th>
                <th className="px-4 py-3 font-semibold">Value</th>
                <th className="px-4 py-3 font-semibold">Visible to apps</th>
              </tr>
            </thead>
            <tbody>
              {config?.map((row) => (
                <tr key={row.key} className="border-t border-hairline align-top">
                  <td className="px-4 py-3">
                    <p className="font-mono text-ink">{row.key}</p>
                    <p className="mt-1 text-xs text-muted">{row.description}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-ink whitespace-nowrap">
                    {JSON.stringify(row.value)}
                    {row.isDefault && <span className="ml-2 text-xs font-sans text-muted">(default)</span>}
                  </td>
                  <td className="px-4 py-3 text-muted">{row.public ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
