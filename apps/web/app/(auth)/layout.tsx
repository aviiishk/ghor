import Image from 'next/image';
import { IndianRupee, MessageCircle, ShieldCheck } from 'lucide-react';

// Sign-in / OTP / onboarding shell (redesign 2026-09-26): a split screen on large
// displays — a navy brand panel that says what GHOR is and why to trust it, next to the
// form — and just the form, full-width, on phones. The photo is illustrative stock (see
// public/landing/photos/README.md), not a GHOR listing.
const POINTS = [
  { icon: ShieldCheck, text: 'Every listing is checked by GHOR before it goes live' },
  { icon: MessageCircle, text: 'Chat directly with owners — no middleman' },
  { icon: IndianRupee, text: 'No viewing fees. No brokerage.' },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream lg:grid lg:grid-cols-[1fr_1.05fr]">
      <aside className="relative hidden overflow-hidden bg-navy p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Image src="/landing/photos/flat-living-plants.jpg" alt="" fill priority sizes="50vw" className="object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/75 to-navy/20" />
        <p className="relative text-sm font-semibold text-white/70">Rooms and flats in Guwahati</p>
        <div className="relative">
          <h2 className="max-w-lg font-display text-[3.5rem] font-bold leading-[0.98] tracking-[-0.04em]">
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
        <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-lift ring-1 ring-inset ring-navy/[0.08] sm:p-9 [&>*]:max-w-none">
          {children}
        </div>
      </main>
    </div>
  );
}
