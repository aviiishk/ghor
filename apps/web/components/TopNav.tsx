'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Compass, LayoutList, MessageCircle, Plus } from 'lucide-react';
import { useProfile } from '@/features/auth/hooks';
import { useNotifications } from '@/features/notifications/hooks';
import { Logo } from '@/components/logo';
import { Avatar } from '@/components/ui';

// Persistent top nav for the signed-in product area (apps/web/CLAUDE.md "Logged-in
// navigation"): role-conditional links mirroring apps/mobile's tab bar. Redesign
// 2026-09-26: wordmark, pill-shaped active state, icons, and an avatar that opens
// Profile (Sign out lives there — it no longer competes for nav space).
export function TopNav() {
  const { data: profile } = useProfile();
  const { data: notifications } = useNotifications();
  const pathname = usePathname();
  const isOwner = profile?.role === 'owner';
  const unreadCount = notifications?.filter((n) => !n.readAt).length ?? 0;

  const links = [
    { href: '/browse', label: 'Browse', icon: Compass },
    ...(isOwner ? [{ href: '/my-listings', label: 'My listings', icon: LayoutList }] : []),
    { href: '/chats', label: 'Chats', icon: MessageCircle },
  ];
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`) || (href === '/chats' && pathname.startsWith('/chat/'));

  return (
    <header className="sticky top-0 z-40 border-b border-navy/[0.06] bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/browse" aria-label="GHOR — browse" className="shrink-0">
          <Logo size="sm" />
        </Link>

        <nav className="flex items-center gap-1 sm:gap-1.5">
          {links.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors ${
                  active ? 'bg-primary-light text-primary' : 'text-body hover:bg-surface'
                }`}
              >
                <Icon size={18} aria-hidden />
                <span className="hidden md:inline">{label}</span>
              </Link>
            );
          })}

          {isOwner && (
            <Link
              href="/listing/new"
              aria-label="List a property"
              className="press ml-1 inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-bold text-white hover:bg-primary-pressed sm:px-4"
            >
              <Plus size={18} aria-hidden />
              <span className="hidden lg:inline">List a property</span>
            </Link>
          )}

          <Link
            href="/notifications"
            aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
            className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
              isActive('/notifications') ? 'bg-primary-light text-primary' : 'text-body hover:bg-surface'
            }`}
          >
            <Bell size={19} aria-hidden />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-[18px] text-white ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>

          <Link href="/profile" aria-label="Profile" className={`ml-0.5 rounded-full ring-2 ${isActive('/profile') ? 'ring-primary' : 'ring-transparent hover:ring-hairline'}`}>
            <Avatar name={profile?.fullName} size="sm" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
