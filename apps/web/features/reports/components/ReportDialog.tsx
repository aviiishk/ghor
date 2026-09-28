'use client';

import { useState } from 'react';
import { useCreateReport } from '../hooks';
import type { ReportReasonCategory } from '../api';
import { Dialog, useToast } from '@/components/ui/overlay';
import { buttonClass, cx, inputBase } from '@/components/ui';
import { friendlyError } from '@/lib/errors';

const CATEGORIES: { value: ReportReasonCategory; label: string; hint: string }[] = [
  { value: 'fake', label: 'Fake or misleading', hint: 'Photos or details don’t match the place' },
  { value: 'spam', label: 'Spam or broker', hint: 'Not the owner, or charging a fee' },
  { value: 'inappropriate', label: 'Inappropriate', hint: 'Offensive or unsafe content' },
  { value: 'other', label: 'Something else', hint: 'Tell us below' },
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
  const [category, setCategory] = useState<ReportReasonCategory>('fake');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const createReport = useCreateReport();
  const toast = useToast();

  async function handleSubmit() {
    setError(null);
    setFieldError(null);
    if (reason.trim().length < 5) {
      setFieldError('Add a short description of what’s wrong (at least 5 characters).');
      return;
    }
    try {
      await createReport.mutateAsync({ listingId, reason: reason.trim(), reasonCategory: category });
      setReason('');
      onClose();
      toast('Thanks — GHOR will review this listing.');
    } catch (e: unknown) {
      setError(friendlyError(e, 'We couldn’t send your report. Please try again.'));
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Report this listing"
      description="Reports are private. A person at GHOR reviews every one."
      footer={
        <>
          <button type="button" onClick={onClose} className={buttonClass('ghost')}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={createReport.isPending} className={buttonClass('navy')}>
            {createReport.isPending ? 'Sending…' : 'Send report'}
          </button>
        </>
      }
    >
      <fieldset>
        <legend className="text-sm font-semibold text-navy">What’s the problem?</legend>
        <div className="mt-3 grid gap-2">
          {CATEGORIES.map((c) => {
            const active = category === c.value;
            return (
              <label
                key={c.value}
                className={cx(
                  'flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-inset transition-colors',
                  active ? 'bg-primary-light ring-2 ring-primary' : 'ring-1 ring-hairline hover:ring-ink/30',
                )}
              >
                <input
                  type="radio"
                  name="report-category"
                  value={c.value}
                  checked={active}
                  onChange={() => setCategory(c.value)}
                  className="mt-1 accent-[#2563EB]"
                />
                <span>
                  <span className="block font-semibold text-ink">{c.label}</span>
                  <span className="block text-sm text-muted">{c.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label htmlFor="report-reason" className="mt-5 block text-sm font-semibold text-navy">
        Details
      </label>
      <textarea
        id="report-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. The photos are of a different building."
        rows={3}
        maxLength={1000}
        aria-invalid={!!fieldError}
        aria-describedby={fieldError ? 'report-reason-error' : undefined}
        className={cx(inputBase, 'mt-2 resize-none py-3', fieldError && 'ring-2 ring-destructive')}
      />
      {fieldError && (
        <p id="report-reason-error" className="mt-1.5 text-sm text-destructive-pressed">
          {fieldError}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-destructive-pale px-3 py-2.5 text-sm text-destructive-pressed">
          {error}
        </p>
      )}
    </Dialog>
  );
}
