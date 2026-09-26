import Image from 'next/image';
import { IndianRupee, MessageCircle, ShieldCheck } from 'lucide-react';

// Sign-in / OTP / onboarding shell (redesign 2026-09-26): a split screen on large
// displays — a navy brand panel that says what GHOR is and why to trust it, next to the
// form — and just the form, full-width, on phones. The room image is an illustrative
// render from the approved mockups (see sections/landing/Landing.tsx).
const POINTS = [
  { icon: ShieldCheck, text: 'Every listing is reviewed before it goes live' },
  { icon: MessageCircle, text: 'Chat directly with owners — no middleman' },
  { icon: IndianRupee, text: 'No viewing fees. No brokerage.' },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream lg:grid lg:grid-cols-[1fr_1.05fr]">
      <aside className="relative hidden overflow-hidden bg-navy p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Image src="/landing/room-hero.jpg" alt="" fill priority sizes="50vw" className="object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/70 to-navy/30" />
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary/40 blur-3xl" />
        <p className="relative text-sm font-semibold text-white/70">Rooms and flats in Guwahati</p>
        <div className="relative">
          <h2 className="max-w-md font-display text-5xl font-bold leading-[1.02] tracking-[-0.035em]">
            Find your place. <span className="text-primary-tint">Directly from the owner.</span>
          </h2>
          <ul className="mt-8 space-y-3">
            {POINTS.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-white/85">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                  <p.icon size={18} aria-hidden />
                </span>
                {p.text}
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="flex min-h-screen items-center justify-center px-6 py-16 lg:min-h-0">
        <div className="w-full max-w-md rounded-[28px] bg-white p-7 shadow-[0_24px_60px_-30px_rgba(11,27,63,0.35)] ring-1 ring-navy/[0.06] sm:p-9 [&>*]:max-w-none">
          {children}
        </div>
      </main>
    </div>
  );
}
