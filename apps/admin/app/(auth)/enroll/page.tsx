"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { Button, ErrorNote, Input } from "@/components/primitives";

// Mandatory authenticator enrollment (first sign-in, after a recovery code, a TOTP reset
// or break-glass). Recovery codes are shown exactly once, here, and never stored by this
// app — they exist only in this component's memory until the admin continues.
export default function EnrollPage() {
  const router = useRouter();
  const [qr, setQr] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    api<{ qrDataUrl: string; secret: string }>("/api/auth/totp/enroll", { method: "POST" })
      .then(setQr)
      .catch(setError);
  }, []);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ recoveryCodes: string[] }>("/api/auth/totp/confirm", { method: "POST", body: { code } });
      setCodes(res.recoveryCodes);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (codes) {
    return (
      <div>
        <h1 className="text-lg font-bold text-ink">Save your recovery codes</h1>
        <p className="mt-1 text-sm text-muted">
          Each code works once if you lose your authenticator. They will <strong>not</strong> be shown again. Store them
          offline (printed, or in a password manager).
        </p>
        <ol className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-surface p-3 font-mono text-sm text-ink">
          {codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
        <label className="mt-4 flex items-start gap-2 text-sm text-body">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-0.5" />
          I have saved these codes somewhere safe.
        </label>
        <Button
          className="mt-4 w-full"
          disabled={!saved}
          onClick={() => {
            setCodes(null);
            router.replace("/");
          }}
        >
          Continue to the console
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void confirm();
      }}
    >
      <h1 className="text-lg font-bold text-ink">Set up your authenticator</h1>
      <p className="mt-1 text-sm text-muted">
        Required for every GHOR admin. Scan the code with an authenticator app (Google Authenticator, Microsoft
        Authenticator, 1Password…), then enter the 6-digit code it shows.
      </p>
      {qr ? (
        <div className="mt-4 flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL generated server-side */}
          <img src={qr.qrDataUrl} alt="Authenticator enrollment QR code" width={220} height={220} className="rounded-xl ring-1 ring-hairline" />
          <details className="w-full text-xs text-muted">
            <summary className="cursor-pointer">Can’t scan? Enter the key manually</summary>
            <p className="mt-1 break-all font-mono text-ink">{qr.secret}</p>
          </details>
        </div>
      ) : (
        !error && <p className="mt-4 text-sm text-muted">Preparing…</p>
      )}
      <Input
        className="mt-4 text-center text-lg tracking-[0.3em]"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        placeholder="6-digit code"
      />
      <div className="mt-3">
        <ErrorNote error={error} />
      </div>
      <Button type="submit" className="mt-4 w-full" disabled={busy || !qr || code.length !== 6}>
        {busy ? "Checking…" : "Verify and continue"}
      </Button>
    </form>
  );
}
