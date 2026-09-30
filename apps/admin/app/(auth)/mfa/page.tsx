"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { Button, ErrorNote, Input } from "@/components/primitives";

// Second factor: authenticator code, or a single-use recovery code. Using a recovery code
// ends every other session, alerts the super admins, and forces authenticator
// re-enrollment before the console opens (D-47).
export default function MfaPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"totp" | "recovery">("totp");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "totp") {
        await api("/api/auth/totp/verify", { method: "POST", body: { code: value } });
        router.replace("/");
      } else {
        await api("/api/auth/recovery", { method: "POST", body: { recoveryCode: value } });
        router.replace("/enroll?recovered=1");
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h1 className="text-lg font-bold text-ink">{mode === "totp" ? "Authenticator code" : "Recovery code"}</h1>
      <p className="mt-1 text-sm text-muted">
        {mode === "totp"
          ? "Enter the 6-digit code from your authenticator app."
          : "Each recovery code works once. You will set up a new authenticator right after."}
      </p>
      <Input
        autoFocus
        className="mt-4 text-center text-lg tracking-[0.3em]"
        inputMode={mode === "totp" ? "numeric" : "text"}
        autoComplete="one-time-code"
        maxLength={mode === "totp" ? 6 : 16}
        value={value}
        onChange={(e) => setValue(mode === "totp" ? e.target.value.replace(/\D/g, "") : e.target.value.toUpperCase())}
      />
      <div className="mt-3">
        <ErrorNote error={error} />
      </div>
      <Button type="submit" className="mt-4 w-full" disabled={busy || (mode === "totp" ? value.length !== 6 : value.length < 10)}>
        {busy ? "Checking…" : "Sign in"}
      </Button>
      <button
        type="button"
        className="mt-3 w-full text-sm font-semibold text-primary"
        onClick={() => {
          setMode(mode === "totp" ? "recovery" : "totp");
          setValue("");
          setError(null);
        }}
      >
        {mode === "totp" ? "Lost your authenticator? Use a recovery code" : "Use authenticator code instead"}
      </button>
    </form>
  );
}
