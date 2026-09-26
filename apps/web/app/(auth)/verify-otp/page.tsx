'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { verifyPhoneOtp, sendPhoneOtp, getProfile } from '@/features/auth/api';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 45;

function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone') ?? '';
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const timer = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  async function handleVerify(code = otp) {
    if (code.length < OTP_LENGTH) return;
    setLoading(true);
    setError(null);
    try {
      await verifyPhoneOtp(phone, code);
      // Returning users (fullName already set) skip onboarding; first-time users don't —
      // same check as apps/mobile's verify-otp.tsx.
      const profile = await getProfile();
      router.replace(profile.fullName ? '/browse' : '/onboarding');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Please try again');
      setOtp('');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (countdown > 0) return;
    try {
      await sendPhoneOtp(phone);
      setCountdown(RESEND_SECONDS);
      setOtp('');
    } catch {
      setError('Failed to resend OTP');
    }
  }

  const digits = otp.padEnd(OTP_LENGTH, ' ').split('');

  return (
    <div className="w-full max-w-sm">
      <p className="text-3xl font-bold text-ink mb-1">
        GH<span className="text-primary">●</span>R
      </p>
      <h1 className="text-2xl font-bold text-ink mt-8 mb-1">Verification Code</h1>
      <p className="text-muted mb-10">
        Enter the {OTP_LENGTH}-digit code sent to{' '}
        <span className="text-primary font-medium">{phone}</span>
      </p>

      <div className="relative mb-8">
        <div className="flex gap-3 justify-center">
          {digits.map((d, i) => (
            <div
              key={i}
              className={`w-12 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-bold text-ink ${
                i < otp.length ? 'border-primary bg-primary-light' : 'border-hairline bg-surface'
              }`}
            >
              {d.trim()}
            </div>
          ))}
        </div>
        <input
          ref={inputRef}
          value={otp}
          onChange={(e) => {
            const clean = e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH);
            setOtp(clean);
            if (clean.length === OTP_LENGTH) handleVerify(clean);
          }}
          inputMode="numeric"
          maxLength={OTP_LENGTH}
          aria-label="Verification code"
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </div>

      {error && <p className="text-destructive text-sm text-center mb-4">{error}</p>}

      <button
        onClick={() => handleVerify()}
        disabled={loading || otp.length < OTP_LENGTH}
        className="w-full bg-primary text-white font-semibold rounded-full py-4 mb-6 disabled:opacity-50"
      >
        {loading ? 'Verifying…' : 'Continue →'}
      </button>

      <button onClick={handleResend} disabled={countdown > 0} className="w-full text-center text-muted">
        Didn&apos;t receive the code?{' '}
        <span className={countdown > 0 ? 'text-muted' : 'text-primary font-semibold'}>
          {countdown > 0 ? `Resend in 00:${String(countdown).padStart(2, '0')}` : 'Resend Code'}
        </span>
      </button>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={null}>
      <VerifyOtpForm />
    </Suspense>
  );
}
