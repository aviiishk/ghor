'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProfile } from '@/features/auth/hooks';

// A separate surface from the seeker/owner product (root CLAUDE.md §14.10: "keeps admin
// tooling cleanly separated from the user-facing app") — deliberately NOT nested under
// app/(product), so it doesn't get the Browse/Listings/Chats/Profile TopNav.
const LINKS = [
  { href: '/admin', label: 'Listings Queue' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/reviews', label: 'Reviews' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/config', label: 'App Config' },
  { href: '/admin/analytics', label: 'Analytics' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: profile, isLoading } = useProfile();
  const pathname = usePathname();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted">Loading…</div>;
  }

  // The real authorization boundary is server-side (every apps/api admin route 403s a
  // non-admin caller) — this is just the UX layer so a non-admin doesn't see a page full
  // of failed requests.
  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <p className="text-muted text-center">You don&apos;t have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-ink text-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-14">
          <span className="font-bold">GHOR Admin</span>
          <Link href="/browse" className="text-sm text-white/70 hover:text-white">
            ← Back to app
          </Link>
        </div>
      </header>
      <div className="max-w-6xl mx-auto flex gap-8 px-6 py-8">
        <nav className="w-44 shrink-0 flex flex-col gap-1">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  active ? 'bg-primary text-white' : 'text-ink hover:bg-white'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
