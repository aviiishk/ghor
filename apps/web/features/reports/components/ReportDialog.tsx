'use client';

import { useState } from 'react';
import { useCreateReport } from '../hooks';
import type { ReportReasonCategory } from '../api';

const CATEGORIES: { value: ReportReasonCategory; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'fake', label: 'Fake' },
  { value: 'inappropriate', label: 'Inappropriate' },
  { value: 'other', label: 'Other' },
];

export function ReportDialog({
  open,
  onClose,
  listingId,
}: {
  open: boolean;
  onClose: () => void;
  listingId: string;
}) {
  const [category, setCategory] = useState<ReportReasonCategory>('spam');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const createReport = useCreateReport();

  if (!open) return null;

  async function handleSubmit() {
    setError(null);
    if (!reason.trim()) {
      setError('Tell us briefly what looks wrong with this listing.');
      return;
    }
    try {
      await createReport.mutateAsync({ listingId, reason: reason.trim(), reasonCategory: category });
      setReason('');
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-lg font-bold text-ink mb-1">Report this listing</h2>
        <p className="text-muted text-sm mb-4">
          Let us know if something looks off — spam, fake, or otherwise inappropriate.
        </p>

        {error && (
          <div className="bg-destructive-pale text-destructive-pressed rounded-xl px-3 py-2 mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          {CATEGORIES.map((c) => {
            const active = category === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  active ? 'bg-primary text-white' : 'bg-surface text-ink'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="What's wrong with this listing?"
          rows={3}
          className="w-full border border-hairline rounded-2xl px-4 py-3 text-ink mb-4"
        />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={createReport.isPending}
          className="w-full bg-destructive text-white font-semibold rounded-full py-3.5 mb-2 disabled:opacity-70"
        >
          Submit Report
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full text-muted font-semibold py-2.5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
