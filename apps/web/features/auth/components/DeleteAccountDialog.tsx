'use client';

import { useState } from 'react';

const CONFIRM_WORD = 'DELETE';

// Typed confirmation, not a one-tap "Are you sure?" — this is irreversible and takes the
// user's listings and every conversation (both sides) with it. See apps/api's
// AuthService.deleteAccount() for exactly what's removed.
export function DeleteAccountDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [typed, setTyped] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleConfirm() {
    setError(null);
    setPending(true);
    try {
      await onConfirm();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setPending(false);
    }
  }

  function handleClose() {
    setTyped('');
    setError(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-lg font-bold text-ink mb-1">Delete your account?</h2>
        <p className="text-muted text-sm mb-3">This can&rsquo;t be undone. It permanently deletes:</p>
        <ul className="text-sm text-ink list-disc pl-5 mb-4 space-y-1">
          <li>your profile and login</li>
          <li>all your listings and their photos</li>
          <li>all your conversations and messages</li>
          <li>your reviews, reports and notifications</li>
        </ul>

        {error && (
          <div className="bg-destructive-pale text-destructive-pressed rounded-xl px-3 py-2 mb-4 text-sm">
            {error}
          </div>
        )}

        <label htmlFor="confirm-delete" className="block text-sm font-semibold text-ink mb-2">
          Type {CONFIRM_WORD} to confirm
        </label>
        <input
          id="confirm-delete"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className="w-full border border-hairline rounded-2xl px-4 py-3 text-ink mb-4"
        />

        <button
          type="button"
          onClick={handleConfirm}
          disabled={typed.trim() !== CONFIRM_WORD || pending}
          className="w-full bg-destructive text-white font-semibold rounded-full py-3.5 mb-2 disabled:opacity-50"
        >
          {pending ? 'Deleting…' : 'Delete account permanently'}
        </button>
        <button
          type="button"
          onClick={handleClose}
          disabled={pending}
          className="w-full text-muted font-semibold py-2.5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
