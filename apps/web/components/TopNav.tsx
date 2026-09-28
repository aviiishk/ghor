'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Compass, LayoutList, MessageCircle, Plus, UserRound } from 'lucide-react';
import { useProfile } from '@/features/auth/hooks';
import { useNotifications } from '@/features/notifications/hooks';
import { useConversations } from '@/features/chat/hooks';
import { Logo } from '@/components/logo';
import { Avatar, buttonClass, cx } from '@/components/ui';

// Signed-in navigation, redesign v2 (2026-09-27). Desktop: one header with labelled links,
// live unread counts and the owner's "List a property" CTA. Phones: a slim top bar plus a
// bottom tab bar (a consumer-app pattern, not a shrunk desktop nav). Screens that carry
// their own fixed action bar — listing detail, the create/edit flows, a chat thread —
// hide the tab bar so two fixed bars never stack.
const HIDE_TABBAR = [/^\/listing\/new/, /^\/listing\/[^/]+(\/edit)?$/, /^\/chat\//];

function useNavData() {
  const { data: profile } = useProfile();
  const { data: notifications } = useNotifications();
  const { data: conversations } = useConversations();
  const pathname = usePathname();
  return {
    profile,
    pathname,
    isOwner: profile?.role === 'owner',
    unreadNotifications: notifications?.filter((n) => !n.readAt).length ?? 0,
    unreadChats: conversations?.reduce((n, c) => n + (c.unreadCount ?? 0), 0) ?? 0,
  };
}

function isActive(pathname: string, href: string) {
  if (href === '/chats') return pathname === '/chats' || pathname.startsWith('/chat/');
  if (href === '/my-listings') return pathname === '/my-listings';
  return pathname === href || pathname.startsWith(`${href}/`);
}

// `inverted` for use on the navy active pill. Passed as a prop, not as override classes:
// cx doesn't resolve Tailwind conflicts, so `text-navy` would lose to `text-white`.
function Count({ n, className, inverted }: { n: number; className?: string; inverted?: boolean }) {
  if (!n) return null;
  return (
    <span
      className={cx(
        'inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-[18px]',
        inverted ? 'bg-white text-navy' : 'bg-primary text-white',
        className,
      )}
    >
      {n > 9 ? '9+' : n}
    </span>
  );
}

export function TopNav() {
  const { profile, pathname, isOwner, unreadNotifications, unreadChats } = useNavData();

  const links = [
    { href: '/browse', label: 'Browse', icon: Compass, count: 0 },
    ...(isOwner ? [{ href: '/my-listings', label: 'My listings', icon: LayoutList, count: 0 }] : []),
    { href: '/chats', label: 'Chats', icon: MessageCircle, count: unreadChats },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-navy/[0.07] bg-cream/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/browse" aria-label="GHOR — browse homes" className="shrink-0">
          <Logo size="sm" />
        </Link>

        {/* Desktop links */}
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {links.map(({ href, label, count }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'relative inline-flex h-10 items-center gap-2 rounded-full px-4 text-[15px] font-semibold transition-colors',
                  active ? 'bg-navy text-white' : 'text-body hover:bg-navy/[0.05]',
                )}
              >
                {label}
                <Count n={count} inverted={active} />
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {isOwner && (
            <Link href="/listing/new" className={cx(buttonClass('primary', 'sm'), 'hidden md:inline-flex')}>
              <Plus size={17} aria-hidden /> List a property
            </Link>
          )}

          <Link
            href="/notifications"
            aria-label={`Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ''}`}
            aria-current={isActive(pathname, '/notifications') ? 'page' : undefined}
            className={cx(
              'relative inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors',
              isActive(pathname, '/notifications') ? 'bg-navy text-white' : 'text-body hover:bg-navy/[0.05]',
            )}
          >
            <Bell size={19} aria-hidden />
            {unreadNotifications > 0 && (
              <span className="absolute right-1 top-1 inline-flex min-w-[17px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-[17px] text-white ring-2 ring-cream">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </Link>

          <Link
            href="/profile"
            aria-label="Your profile"
            className={cx(
              'hidden items-center gap-2 rounded-full py-1 pl-1 pr-3 ring-1 transition-colors md:inline-flex',
              isActive(pathname, '/profile') ? 'bg-white ring-navy/30' : 'ring-navy/10 hover:bg-white',
            )}
          >
            <Avatar name={profile?.fullName} size="sm" />
            <span className="max-w-[120px] truncate text-sm font-semibold text-ink">{profile?.fullName?.split(' ')[0] ?? 'Profile'}</span>
          </Link>
          <Link href="/profile" aria-label="Your profile" className="rounded-full md:hidden">
            <Avatar name={profile?.fullName} size="sm" />
          </Link>
        </div>
      </div>
    </header>
  );
}

// Bottom tab bar — phones only.
export function MobileTabBar() {
  const { pathname, isOwner, unreadChats } = useNavData();
  if (HIDE_TABBAR.some((r) => r.test(pathname))) return null;

  const tabs = [
    { href: '/browse', label: 'Explore', icon: Compass, count: 0 },
    { href: '/chats', label: 'Chats', icon: MessageCircle, count: unreadChats },
    ...(isOwner ? [{ href: '/my-listings', label: 'Listings', icon: LayoutList, count: 0 }] : []),
    { href: '/profile', label: 'Profile', icon: UserRound, count: 0 },
  ];

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-navy/[0.08] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <div className="mx-auto flex h-[68px] max-w-md items-stretch justify-around px-2">
        {tabs.slice(0, isOwner ? 2 : 3).map((t) => (
          <Tab key={t.href} {...t} active={isActive(pathname, t.href)} />
        ))}
        {isOwner && (
          <Link href="/listing/new" aria-label="List a property" className="flex flex-1 flex-col items-center justify-center">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_10px_20px_-8px_rgba(37,99,235,0.8)]">
              <Plus size={22} aria-hidden />
            </span>
          </Link>
        )}
        {isOwner && tabs.slice(2).map((t) => <Tab key={t.href} {...t} active={isActive(pathname, t.href)} />)}
      </div>
    </nav>
  );
}

function Tab({ href, label, icon: Icon, count, active }: { href: string; label: string; icon: typeof Compass; count: number; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cx('relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold', active ? 'text-navy' : 'text-muted')}
    >
      <span className={cx('relative inline-flex h-8 w-14 items-center justify-center rounded-full transition-colors', active && 'bg-navy/[0.07]')}>
        <Icon size={21} strokeWidth={active ? 2.4 : 2} aria-hidden />
        <Count n={count} className="absolute -right-0.5 -top-1 ring-2 ring-white" />
      </span>
      {label}
    </Link>
  );
}

// Reserves room for the tab bar on the screens that show it.
export function ProductShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const tabbar = !HIDE_TABBAR.some((r) => r.test(pathname));
  return <main className={tabbar ? 'pb-tabbar' : ''}>{children}</main>;
}
