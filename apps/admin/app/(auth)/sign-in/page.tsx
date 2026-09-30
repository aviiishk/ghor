"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { Button, ErrorNote, Input } from "@/components/primitives";

type Step = "phone" | "code" | "break-glass";

// First factor: phone OTP. The second factor (TOTP) is mandatory for every admin role —
// there is no console access before it (D-47).
export default function SignInPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("+91");
  const [code, setCode] = useState("");
  const [mfa, setMfa] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const sendCode = () =>
    run(async () => {
      await api("/api/auth/otp/send", { method: "POST", body: { phone } });
      setStep("code");
    });

  const verifyCode = () =>
    run(async () => {
      const res = await api<{ mfa: string | null; breakGlassAvailable: boolean }>("/api/auth/otp/verify", {
        method: "POST",
        body: { phone, code }
      });
      if (res.breakGlassAvailable) {
        setMfa(res.mfa);
        setStep("break-glass");
        return;
      }
      router.push(res.mfa === "enroll" ? "/enroll" : "/mfa");
    });

  const useBreakGlass = () =>
    run(async () => {
      await api("/api/auth/break-glass", { method: "POST" });
      router.push("/enroll");
    });

  if (step === "break-glass") {
    return (
      <div>
        <h1 className="text-lg font-bold text-ink">Break-glass access available</h1>
        <p className="mt-2 text-sm text-muted">
          This number is on the deployment’s emergency list. Break-glass makes this account a super admin, resets its
          authenticator and signs out every other session. It is recorded and all super admins are alerted.
        </p>
        <div className="mt-4">
          <ErrorNote error={error} />
        </div>
        <div className="mt-5 flex flex-col gap-2">
          {mfa && (
            <Button onClick={() => router.push(mfa === "enroll" ? "/enroll" : "/mfa")} disabled={busy}>
              Continue normal sign-in
            </Button>
          )}
          <Button variant="danger" onClick={useBreakGlass} disabled={busy}>
            Use break-glass
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void (step === "phone" ? sendCode() : verifyCode());
      }}
    >
      <h1 className="text-lg font-bold text-ink">Sign in</h1>
      <label className="mt-4 block text-sm font-semibold text-ink" htmlFor="phone">
        Phone number
      </label>
      <Input id="phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value.trim())} disabled={step !== "phone"} className="mt-1" />
      {step === "code" && (
        <>
          <label className="mt-4 block text-sm font-semibold text-ink" htmlFor="code">
            6-digit code sent by SMS
          </label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="mt-1 tracking-[0.3em]"
            autoFocus
          />
        </>
      )}
      <div className="mt-4">
        <ErrorNote error={error} />
      </div>
      <Button type="submit" className="mt-5 w-full" disabled={busy || (step === "code" && code.length !== 6)}>
        {busy ? "Please wait…" : step === "phone" ? "Send code" : "Continue"}
      </Button>
      {step === "code" && (
        <button type="button" onClick={() => setStep("phone")} className="mt-3 w-full text-sm font-semibold text-primary">
          Use a different number
        </button>
      )}
    </form>
  );
}
