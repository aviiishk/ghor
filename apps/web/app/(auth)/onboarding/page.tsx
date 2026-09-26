'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { completeOnboarding } from '@/features/auth/api';
import { Logo } from '@/components/logo';

type Role = 'seeker' | 'owner';

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('seeker');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleComplete() {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await completeOnboarding({ fullName: name.trim(), role });
      router.replace('/browse');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <Logo />
      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-ink">Find your next room.</h1>
      <p className="text-primary text-lg font-medium mb-8">Feel at home.</p>

      <label className="block text-sm font-medium text-muted mb-3">I am…</label>
      <div className="flex flex-col gap-3 mb-6">
        <RoleCard
          label="Looking for a room"
          sublabel="Find rooms to rent"
          selected={role === 'seeker'}
          onClick={() => setRole('seeker')}
        />
        <RoleCard
          label="I am a room owner"
          sublabel="List your rooms"
          selected={role === 'owner'}
          onClick={() => setRole('owner')}
        />
      </div>

      <label className="block text-sm font-medium text-muted mb-2" htmlFor="fullName">
        Full Name
      </label>
      <input
        id="fullName"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your full name"
        className="w-full border border-hairline rounded-2xl px-4 py-3 text-ink mb-6 bg-surface"
        onKeyDown={(e) => e.key === 'Enter' && handleComplete()}
      />

      {error && <p className="text-destructive text-sm mb-4">{error}</p>}

      <p className="text-xs text-muted mb-6">
        By signing up, you agree to our{' '}
        <Link href="/terms" target="_blank" className="text-primary">
          Terms &amp; Conditions
        </Link>{' '}
        and{' '}
        <Link href="/privacy" target="_blank" className="text-primary">
          Privacy Policy
        </Link>
      </p>

      <button
        onClick={handleComplete}
        disabled={loading}
        className="w-full bg-primary text-white font-semibold rounded-full py-4 disabled:opacity-70"
      >
        {loading ? 'Setting up…' : 'Get Started →'}
      </button>
    </div>
  );
}

function RoleCard({
  label,
  sublabel,
  selected,
  onClick,
}: {
  label: string;
  sublabel: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center p-4 rounded-2xl border-2 text-left ${
        selected ? 'border-primary bg-primary-light' : 'border-hairline bg-surface'
      }`}
    >
      <div className="flex-1">
        <p className={`font-semibold ${selected ? 'text-primary' : 'text-ink'}`}>{label}</p>
        <p className="text-muted text-sm">{sublabel}</p>
      </div>
      <div
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
          selected ? 'border-primary bg-primary' : 'border-slate-300'
        }`}
      >
        {selected && <div className="w-2 h-2 rounded-full bg-white" />}
      </div>
    </button>
  );
}
