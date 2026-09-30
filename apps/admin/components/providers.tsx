"use client";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { api, isStepUpRequired } from "@/lib/client/api";
import type { Me } from "@/types/admin";
import { Button, ErrorNote, Input } from "./primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";

// ---------------------------------------------------------------------------
// Step-up (D-47): the API refuses sensitive actions with STEP_UP_REQUIRED until the admin
// re-enters a TOTP code; this provider catches that, asks for the code, then retries the
// action once. The API remains the only place the rule is enforced.
// ---------------------------------------------------------------------------

type StepUpCtx = { withStepUp: <T>(action: () => Promise<T>) => Promise<T> };
const StepUpContext = createContext<StepUpCtx | null>(null);

export function useStepUp() {
  const ctx = useContext(StepUpContext);
  if (!ctx) throw new Error("useStepUp outside provider");
  return ctx;
}

function StepUpProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ resolve: () => void; reject: (e: unknown) => void } | null>(null);

  const withStepUp = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    try {
      return await action();
    } catch (e) {
      if (!isStepUpRequired(e)) throw e;
      await new Promise<void>((resolve, reject) => {
        pending.current = { resolve, reject };
        setCode("");
        setError(null);
        setOpen(true);
      });
      return action();
    }
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/step-up", { method: "POST", body: { code } });
      setOpen(false);
      pending.current?.resolve();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setOpen(false);
    pending.current?.reject(new Error("Re-authentication cancelled"));
  }

  return (
    <StepUpContext.Provider value={{ withStepUp }}>
      {children}
      <Dialog open={open} onOpenChange={(next) => !next && !busy && cancel()}>
        <DialogContent className="max-w-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="grid gap-4"
          >
            <DialogHeader>
              <DialogTitle className="text-ink">Confirm it’s you</DialogTitle>
              <DialogDescription>
                This action needs a fresh code from your authenticator app (valid for 10 minutes).
              </DialogDescription>
            </DialogHeader>
            <Input
              autoFocus
              aria-label="Authenticator code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="6-digit code"
              className="text-center text-lg tracking-[0.4em]"
            />
            <ErrorNote error={error} />
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="secondary" onClick={cancel} disabled={busy}>Cancel</Button>
              <Button type="submit" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Confirm"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </StepUpContext.Provider>
  );
}

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/api/auth/me"), staleTime: 60_000 });
}

// UI mirror of the API's permission map — only decides what to SHOW. Every action is
// still authorized by apps/api, which is the security boundary.
export function useCan() {
  const { data } = useMe();
  return (permission: string) => !!data?.permissions.includes(permission);
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })
  );
  return (
    <QueryClientProvider client={client}>
      <StepUpProvider>{children}</StepUpProvider>
    </QueryClientProvider>
  );
}
