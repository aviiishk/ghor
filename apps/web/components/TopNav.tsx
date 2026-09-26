'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, Plus } from 'lucide-react';
import { useProfile } from '@/features/auth/hooks';
import { signOut } from '@/features/auth/api';
import { useNotifications } from '@/features/notifications/hooks';

// Persistent top nav for the signed-in product area, replacing the marketing navbar —
// decided 2026-07-23 (apps/web/CLAUDE.md's "Logged-in navigation"): role-conditional
// links mirroring apps/mobile's tab bar (seekers see 3, owners see 4), no sidebar.
export function TopNav() {
  const { data: profile } = useProfile();
  const { data: notifications } = useNotifications();
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const isOwner = profile?.role === 'owner';
  const unreadCount = notifications?.filter((n) => !n.readAt).length ?? 0;

  async function handleSignOut() {
    await signOut();
    qc.clear();
    router.replace('/sign-in');
  }

  const links = [
    { href: '/browse', label: 'Browse' },
    ...(isOwner ? [{ href: '/my-listings', label: 'Listings' }] : []),
    { href: '/chats', label: 'Chats' },
    { href: '/profile', label: 'Profile' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-hairline">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 h-16">
        <Link href="/browse" className="text-xl font-bold text-ink shrink-0">
          GH<span className="text-primary">●</span>R
        </Link>

        <nav className="flex items-center gap-4 sm:gap-6">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-semibold ${active ? 'text-primary' : 'text-muted hover:text-ink'}`}
              >
                {link.label}
              </Link>
            );
          })}
          {isOwner && (
            <Link
              href="/listing/new"
              aria-label="List a property"
              className="flex items-center gap-1 bg-primary text-white text-sm font-semibold rounded-full p-2 sm:px-4"
            >
              <Plus size={16} />
              {/* Icon-only on phones — the full label doesn't fit alongside 4 links. */}
              <span className="hidden sm:inline">List a property</span>
            </Link>
          )}
          <Link href="/notifications" className="relative text-muted hover:text-ink" aria-label="Notifications">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
          {/* Hidden on phones for space; Profile has its own Sign Out. */}
          <button
            onClick={handleSignOut}
            className="hidden sm:block text-sm text-muted font-medium hover:text-ink whitespace-nowrap"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
