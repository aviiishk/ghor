'use client';

import { friendlyError } from '@/lib/errors';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { sendPhoneOtp } from '@/features/auth/api';
import { Logo } from '@/components/logo';

export default function SignInPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.length < 10) {
      setError('Enter a valid mobile number');
      return;
    }
    const formatted = cleaned.startsWith('+') ? cleaned : `+91${cleaned}`;
    setLoading(true);
    setError(null);
    try {
      await sendPhoneOtp(formatted);
      // Carry ?next= (set by middleware / an expired session) through to verify-otp.
      const next = new URLSearchParams(window.location.search).get('next');
      router.push(`/verify-otp?phone=${encodeURIComponent(formatted)}${next ? `&next=${encodeURIComponent(next)}` : ''}`);
    } catch (e: unknown) {
      setError(friendlyError(e, 'We couldn’t send the code. Check the number and try again.'));
    } finally {
      setLoading(false);
    }
  }

  function handleGoogle() {
    setError('Google sign-in isn’t available yet — please continue with your mobile number.');
  }

  return (
    <div className="w-full max-w-sm">
      <Logo />
      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-ink">Welcome back!</h1>
      <p className="text-muted mt-1 mb-8">Login to continue your room search journey.</p>

      <label className="block text-sm font-medium text-muted mb-2" htmlFor="phone">
        Mobile Number
      </label>
      <div className="flex items-center border border-hairline rounded-2xl px-4 py-3 bg-surface mb-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30">
        <span className="bg-primary-light text-primary font-semibold text-sm rounded-lg px-2 py-1 mr-3">
          +91
        </span>
        <input
          id="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder="Enter your mobile number"
          className="flex-1 bg-transparent text-ink text-base outline-none"
          onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
        />
      </div>

      {error && <p role="alert" className="mb-4 text-sm text-destructive-pressed">{error}</p>}

      <button
        onClick={handleContinue}
        disabled={loading}
        className="w-full flex items-center justify-center bg-primary text-white font-semibold rounded-full py-4 mb-6 disabled:opacity-70"
      >
        {loading ? 'Sending…' : 'Continue →'}
      </button>

      <div className="flex items-center mb-6">
        <div className="flex-1 h-px bg-hairline" />
        <span className="mx-4 text-muted text-sm">Or continue with</span>
        <div className="flex-1 h-px bg-hairline" />
      </div>

      <button
        onClick={handleGoogle}
        className="w-full flex items-center justify-center border border-hairline text-ink font-medium rounded-full py-4"
      >
        Continue with Google
      </button>

      <p className="text-xs text-muted text-center mt-8">
        By signing in, you agree to our{' '}
        <Link href="/terms" className="text-primary">
          Terms &amp; Conditions
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="text-primary">
          Privacy Policy
        </Link>
      </p>
    </div>
  );
}
