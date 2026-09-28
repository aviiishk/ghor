'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Dialog } from '@/components/ui/overlay';
import { buttonClass, cx, inputBase } from '@/components/ui';
import { friendlyError } from '@/lib/errors';

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

  async function handleConfirm() {
    setError(null);
    setPending(true);
    try {
      await onConfirm();
    } catch (e: unknown) {
      setError(friendlyError(e, 'We couldn’t delete your account. Nothing was removed — please try again.'));
      setPending(false);
    }
  }

  function handleClose() {
    setTyped('');
    setError(null);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      dismissible={!pending}
      title="Delete your account?"
      description="This can’t be undone. It permanently deletes:"
      footer={
        <>
          <button type="button" onClick={handleClose} disabled={pending} className={buttonClass('ghost')}>
            Keep my account
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={typed.trim() !== CONFIRM_WORD || pending}
            className={buttonClass('destructive')}
          >
            {pending ? 'Deleting…' : 'Delete permanently'}
          </button>
        </>
      }
    >
      <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-body">
        <li>your profile and sign-in</li>
        <li>all your listings and their photos</li>
        <li>all your conversations and messages</li>
        <li>your reviews, reports and notifications</li>
      </ul>

      {error && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-destructive-pale px-3 py-2.5 text-sm text-destructive-pressed">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden /> {error}
        </p>
      )}

      <label htmlFor="confirm-delete" className="mt-5 block text-sm font-semibold text-navy">
        Type {CONFIRM_WORD} to confirm
      </label>
      <input
        id="confirm-delete"
        data-autofocus
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
        autoCapitalize="characters"
        className={cx(inputBase, 'mt-2 h-12')}
      />
    </Dialog>
  );
}
