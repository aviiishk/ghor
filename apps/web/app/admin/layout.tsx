'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, BarChart3, Flag, Inbox, Settings2, ShieldAlert, Star, Users } from 'lucide-react';
import { useProfile } from '@/features/auth/hooks';
import { Logo } from '@/components/logo';
import { EmptyState, Skeleton } from '@/components/ui';

// A separate surface from the seeker/owner product (root CLAUDE.md §14.10: "keeps admin
// tooling cleanly separated from the user-facing app") — deliberately NOT nested under
// app/(product). Redesign 2026-09-26: denser than the product (it's a work tool), but the
// same tokens, icons and components. Sidebar on desktop, scrollable tabs on phones.
const LINKS = [
  { href: '/admin', label: 'Listings queue', icon: Inbox },
  { href: '/admin/reports', label: 'Reports', icon: Flag },
  { href: '/admin/reviews', label: 'Reviews', icon: Star },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/config', label: 'App config', icon: Settings2 },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: profile, isLoading } = useProfile();
  const pathname = usePathname();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-6 py-10" aria-busy="true">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }

  // The real authorization boundary is server-side (every apps/api admin route 403s a
  // non-admin caller) — this is just the UX layer so a non-admin doesn't see a page full
  // of failed requests.
  if (profile?.role !== 'admin') {
    return <EmptyState icon={ShieldAlert} title="You don’t have access to this page" body="The admin dashboard is only available to GHOR staff." action={{ label: 'Back to GHOR', href: '/browse' }} />;
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-40 bg-navy text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo size="sm" tone="white" />
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider">Admin</span>
          </div>
          <Link href="/browse" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-white/75 hover:bg-white/10 hover:text-white">
            <ArrowLeft size={16} aria-hidden /> Back to app
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:flex lg:gap-8 lg:py-8">
        <nav aria-label="Admin sections" className="-mx-4 flex gap-1 overflow-x-auto border-b border-navy/[0.06] bg-white px-4 py-2 [scrollbar-width:none] lg:sticky lg:top-24 lg:mx-0 lg:h-fit lg:w-56 lg:shrink-0 lg:flex-col lg:rounded-3xl lg:border-0 lg:p-2 lg:ring-1 lg:ring-navy/[0.06]">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex shrink-0 items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  active ? 'bg-navy text-white' : 'text-body hover:bg-cream'
                }`}
              >
                <Icon size={18} aria-hidden /> {label}
              </Link>
            );
          })}
        </nav>
        <main className="min-w-0 flex-1 py-6 lg:py-0">{children}</main>
      </div>
    </div>
  );
}
