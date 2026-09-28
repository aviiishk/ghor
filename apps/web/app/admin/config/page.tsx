'use client';

import { useState } from 'react';
import { useAppConfig, useSetConfig } from '@/features/admin/hooks';

export default function AdminConfigPage() {
  const { data: config, isLoading, isError } = useAppConfig();
  const setConfig = useSetConfig();
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  async function handleAdd() {
    if (!newKey.trim()) return;
    await setConfig.mutateAsync({ key: newKey.trim(), value: parseValue(newValue) });
    setNewKey('');
    setNewValue('');
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-6">App config</h1>
      <p className="text-muted text-sm mb-6">
        Tunables like ad frequency, feed page size, and the report-revert threshold — editable
        here without a new deploy or app-store release.
      </p>

      {isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : isError ? (
        <p className="text-muted">Couldn&apos;t load config.</p>
      ) : (
        <div className="flex flex-col gap-3 mb-6">
          {config?.map((row) => (
            <ConfigRow
              key={row.key}
              configKey={row.key}
              value={row.value}
              onSave={(v) => setConfig.mutate({ key: row.key, value: v })}
            />
          ))}
          {(!config || config.length === 0) && <p className="text-muted">No config rows yet.</p>}
        </div>
      )}

      <div className="bg-white rounded-2xl p-4 shadow-card">
        <p className="text-sm font-semibold text-ink mb-3">Add / set a key</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="key (e.g. ad_frequency)"
            className="flex-1 border border-hairline rounded-xl px-3 py-2 text-sm"
          />
          <input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder='value — JSON: 3, true, "text"'
            className="flex-1 border border-hairline rounded-xl px-3 py-2 text-sm"
          />
          <button
            onClick={handleAdd}
            className="bg-primary text-white text-sm font-semibold rounded-xl px-4 py-2 shrink-0"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function ConfigRow({
  configKey,
  value,
  onSave,
}: {
  configKey: string;
  value: unknown;
  onSave: (v: unknown) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(JSON.stringify(value));

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white rounded-2xl p-4 shadow-card">
      <span className="font-mono text-sm text-ink sm:w-48 shrink-0">{configKey}</span>
      {editing ? (
        <>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1 border border-hairline rounded-xl px-3 py-1.5 text-sm font-mono"
          />
          <button
            onClick={() => {
              onSave(parseValue(draft));
              setEditing(false);
            }}
            className="text-primary text-sm font-semibold shrink-0"
          >
            Save
          </button>
        </>
      ) : (
        <>
          <span className="flex-1 text-muted text-sm font-mono truncate">{JSON.stringify(value)}</span>
          <button onClick={() => setEditing(true)} className="text-primary text-sm font-semibold shrink-0">
            Edit
          </button>
        </>
      )}
    </div>
  );
}
