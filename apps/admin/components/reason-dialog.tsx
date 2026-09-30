"use client";

import { useEffect, useId, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button, ErrorNote, Input, Textarea } from "@/components/primitives";

// The one way the console asks for a reason (replaces window.prompt / window.confirm).
// Reasons are free text on purpose: the reason-code taxonomy is an open founder decision
// (F-14). What gets sent is "<reason>" or "<reason> — <details>", at most 500 characters,
// matching the API's limit. Errors from the action stay inside the dialog so the admin can
// correct and retry; a step-up prompt (if the API asks for one) stacks on top.

const MAX_TOTAL = 500;

export interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  destructive?: boolean;
  /** false = a plain confirmation (no reason field). */
  requireReason?: boolean;
  onConfirm: (reason: string) => Promise<unknown>;
}

export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  requireReason = true,
  onConfirm
}: ReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const ids = { reason: useId(), details: useId() };

  useEffect(() => {
    if (open) {
      setReason("");
      setDetails("");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const combined = details.trim() ? `${reason.trim()} — ${details.trim()}` : reason.trim();
  const tooShort = requireReason && reason.trim().length < 3;
  const tooLong = combined.length > MAX_TOTAL;

  async function submit() {
    if (tooShort || tooLong) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(requireReason ? combined : "");
      onOpenChange(false);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle className="text-ink">{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>

          {requireReason && (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor={ids.reason}>Reason (recorded in the audit log)</Label>
                <Input
                  id={ids.reason}
                  autoFocus
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={MAX_TOTAL}
                  aria-invalid={reason.length > 0 && tooShort}
                  aria-describedby={`${ids.reason}-hint`}
                />
                <p id={`${ids.reason}-hint`} className="text-xs text-muted">
                  At least 3 characters. Free text for now — standard reason codes aren’t decided yet.
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={ids.details}>Details (optional)</Label>
                <Textarea id={ids.details} rows={3} value={details} onChange={(e) => setDetails(e.target.value)} />
                <p className={`text-xs ${tooLong ? "text-destructive-pressed" : "text-muted"}`}>
                  {combined.length}/{MAX_TOTAL} characters
                </p>
              </div>
            </div>
          )}

          <ErrorNote error={error} />

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant={destructive ? "danger" : "primary"} disabled={busy || tooShort || tooLong}>
              {busy ? "Working…" : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type AskOptions = Omit<ReasonDialogProps, "open" | "onOpenChange">;

// Promise-free convenience: `ask({...})` opens the dialog; the action runs in onConfirm.
export function useReasonDialog() {
  const [opts, setOpts] = useState<AskOptions | null>(null);
  const element = opts ? (
    <ReasonDialog {...opts} open onOpenChange={(o) => !o && setOpts(null)} />
  ) : null;
  return { ask: (o: AskOptions) => setOpts(o), element };
}
