'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  FileText,
  LayoutList,
  LogOut,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { Avatar, Skeleton, buttonClass, cx, inputBase } from '@/components/ui';
import { useToast } from '@/components/ui/overlay';
import { useProfile, useUpdateProfile } from '@/features/auth/hooks';
import { deleteAccount, signOut } from '@/features/auth/api';
import { DeleteAccountDialog } from '@/features/auth/components/DeleteAccountDialog';
import { useNotifications } from '@/features/notifications/hooks';
import { useConversations } from '@/features/chat/hooks';
import { useMyListings } from '@/features/listings/hooks';
import { friendlyError } from '@/lib/errors';

// Account page, polish pass (2026-09-27). A restrained identity header (who you are on
// GHOR and what's verified), then quiet grouped lists — no card per row, no competing
// colour blocks. Destructive actions sit at the bottom and look secondary. Same scope as
// before: name editing, notifications, legal, sign out, account deletion (Play Store
// requirement, root CLAUDE.md §15.4). Phone editing needs its own OTP re-verification
// flow and isn't built.
export default function ProfilePage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: profile, isLoading } = useProfile();
  const { data: notifications } = useNotifications();
  const { data: conversations } = useConversations();
  const isOwner = profile?.role === 'owner';
  const { data: myListings } = useMyListings();
  const updateProfile = useUpdateProfile();
  const unreadNotifications = notifications?.filter((n) => !n.readAt).length ?? 0;
  const unreadChats = conversations?.reduce((n, c) => n + (c.unreadCount ?? 0), 0) ?? 0;

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    qc.clear();
    // Full load so no signed-in prefetch or cached page survives the sign-out.
    window.location.replace('/sign-in');
  }

  async function handleDeleteAccount() {
    await deleteAccount();
    qc.clear();
    window.location.replace('/sign-in');
  }

  function startEditName() {
    setNameDraft(profile?.fullName ?? '');
    setNameError(null);
    setEditingName(true);
  }

  async function saveName() {
    const fullName = nameDraft.trim();
    if (fullName.length < 2) {
      setNameError('Enter your name as renters and owners should see it (at least 2 letters).');
      return;
    }
    try {
      await updateProfile.mutateAsync({ fullName });
      setEditingName(false);
      toast('Name updated');
    } catch (e: unknown) {
      setNameError(friendlyError(e, 'We couldn’t save your name. Please try again.'));
    }
  }

  if (isLoading || !profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-6" aria-busy="true">
        <div className="flex items-center gap-5">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="mt-10 h-56 rounded-2xl" />
        <Skeleton className="mt-6 h-40 rounded-2xl" />
      </div>
    );
  }

  const roleLabel = profile.role === 'seeker' ? 'Renter' : profile.role === 'owner' ? 'Property owner' : 'Admin';
  const memberSince = new Date(profile.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const live = myListings?.filter((l) => l.status === 'approved').length ?? 0;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
      {/* ------------------------------------------------ Identity */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar name={profile.fullName} size="xl" />
        <div className="min-w-0 flex-1">
          {editingName ? (
            <div className="max-w-md">
              <label htmlFor="full-name" className="text-sm font-semibold text-navy">
                Your name
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  id="full-name"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveName();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                  maxLength={80}
                  autoFocus
                  aria-invalid={!!nameError}
                  aria-describedby={nameError ? 'name-error' : undefined}
                  className={cx(inputBase, 'h-11', nameError && 'ring-2 ring-destructive')}
                />
                <button onClick={saveName} disabled={updateProfile.isPending} className={buttonClass('navy')}>
                  {updateProfile.isPending ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditingName(false)} className={buttonClass('ghost')}>
                  Cancel
                </button>
              </div>
              {nameError && (
                <p id="name-error" className="mt-1.5 text-sm text-destructive-pressed">
                  {nameError}
                </p>
              )}
            </div>
          ) : (
            <h1 className="font-display text-[2rem] font-bold leading-tight tracking-[-0.03em] text-navy sm:text-[2.4rem]">
              {profile.fullName ?? 'Add your name'}
            </h1>
          )}
          <p className="mt-1 text-[15px] text-muted">
            {roleLabel} · on GHOR since {memberSince}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {profile.phoneVerified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-pale px-2.5 py-1 text-xs font-bold text-success-deep">
                <BadgeCheck size={13} aria-hidden /> Phone verified
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-cream-deep px-2.5 py-1 text-xs font-semibold text-muted">Phone not verified</span>
            )}
            {profile.idVerificationStatus === 'verified' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-pale px-2.5 py-1 text-xs font-bold text-success-deep">
                <ShieldCheck size={13} aria-hidden /> ID verified
              </span>
            )}
          </div>
        </div>
        {isOwner && (
          <Link href={`/owner/${profile.id}`} className={cx(buttonClass('secondary', 'sm'), 'self-start sm:self-center')}>
            View public profile
          </Link>
        )}
      </header>

      {isOwner && myListings && (
        <dl className="mt-8 grid grid-cols-3 divide-x divide-navy/[0.08] border-y border-navy/[0.08] py-4 text-center">
          {[
            [myListings.length, myListings.length === 1 ? 'Listing' : 'Listings'],
            [live, 'Live now'],
            [conversations?.length ?? 0, (conversations?.length ?? 0) === 1 ? 'Conversation' : 'Conversations'],
          ].map(([n, label]) => (
            <div key={String(label)}>
              <dd className="font-display text-2xl font-bold text-navy">{n}</dd>
              <dt className="text-xs font-semibold text-muted">{label}</dt>
            </div>
          ))}
        </dl>
      )}

      {/* ------------------------------------------------ Activity */}
      <Group title="Activity">
        <Row href="/chats" icon={MessageCircle} label="Chats" meta={unreadChats ? plural(unreadChats, 'unread message', 'unread messages') : 'Conversations with owners and renters'} badge={unreadChats} />
        <Row href="/notifications" icon={Bell} label="Notifications" meta={unreadNotifications ? `${unreadNotifications} unread` : 'Messages, reviews and listing updates'} badge={unreadNotifications} />
        {isOwner ? (
          <>
            <Row href="/my-listings" icon={LayoutList} label="My listings" meta={myListings ? `${plural(myListings.length, 'listing', 'listings')} · ${live} live` : 'Manage your rooms and flats'} />
            <Row href="/listing/new" icon={Plus} label="List a property" meta="Add a room or flat in about three minutes" />
          </>
        ) : (
          <Row href="/browse" icon={Search} label="Find a home" meta="Rooms and flats across Guwahati" />
        )}
      </Group>

      {/* ------------------------------------------------ Account */}
      <Group title="Account">
        <Item label="Name" value={profile.fullName ?? 'Not set'} action={!editingName && <button onClick={startEditName} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-bold text-primary hover:bg-primary-light"><Pencil size={14} aria-hidden /> Edit</button>} />
        <Item
          label="Phone number"
          value={profile.phone ? formatPhone(profile.phone) : 'Not set'}
          hint={isOwner ? 'Used to sign in, and shown on your listings so renters can call you.' : 'Used to sign in.'}
        />
        <Item label="Account type" value={roleLabel} />
      </Group>

      <Group title="Legal">
        <Row href="/privacy" icon={FileText} label="Privacy Policy" />
        <Row href="/terms" icon={FileText} label="Terms of Service" />
      </Group>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-navy/[0.08] pt-8">
        <button onClick={handleSignOut} disabled={signingOut} className={buttonClass('secondary')}>
          <LogOut size={17} aria-hidden /> {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
        <button onClick={() => setDeleteOpen(true)} className="rounded-lg px-2 py-1 text-sm font-semibold text-muted underline-offset-4 hover:text-destructive-pressed hover:underline">
          Delete account
        </button>
      </div>

      <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDeleteAccount} />
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 font-display text-lg font-bold text-navy">{title}</h2>
      <div className="divide-y divide-navy/[0.07] overflow-hidden rounded-2xl bg-white ring-1 ring-inset ring-navy/[0.08]">{children}</div>
    </section>
  );
}

function Row({ href, icon: Icon, label, meta, badge = 0 }: { href: string; icon: typeof Bell; label: string; meta?: string; badge?: number }) {
  return (
    <Link href={href} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-cream">
      <Icon size={20} className="shrink-0 text-navy/70" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">{label}</span>
        {meta && <span className="block truncate text-sm text-muted">{meta}</span>}
      </span>
      {badge > 0 && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      <ChevronRight size={18} className="shrink-0 text-muted-soft transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

function Item({ label, value, hint, action }: { label: string; value: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">{label}</p>
        <p className="font-semibold text-ink">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

// +919876543210 -> +91 98765 43210 (how Indian numbers are written); anything else as-is.
function formatPhone(phone: string) {
  const m = /^\+91(\d{5})(\d{5})$/.exec(phone);
  return m ? `+91 ${m[1]} ${m[2]}` : phone;
}
