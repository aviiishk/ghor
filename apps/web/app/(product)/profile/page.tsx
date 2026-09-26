'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Bell, ChevronRight, Eye, FileText, LayoutList, LogOut, MessageCircle, Pencil, Phone, Trash2 } from 'lucide-react';
import { Avatar, Badge, IconTile, Skeleton } from '@/components/ui';
import { useProfile, useUpdateProfile } from '@/features/auth/hooks';
import { deleteAccount, signOut } from '@/features/auth/api';
import { DeleteAccountDialog } from '@/features/auth/components/DeleteAccountDialog';
import { useNotifications } from '@/features/notifications/hooks';

// Same scope as apps/mobile's Profile screen: identity display (name editable), the
// Notifications entry point, legal links, sign out, and account deletion (Play Store
// requirement, root CLAUDE.md §15.4). Phone number editing is still not built — it needs
// OTP re-verification of the new number, a separate flow.
export default function ProfilePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: profile, isLoading } = useProfile();
  const { data: notifications } = useNotifications();
  const updateProfile = useUpdateProfile();
  const unreadCount = notifications?.filter((n) => !n.readAt).length ?? 0;

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    qc.clear();
    router.replace('/sign-in');
  }

  async function handleDeleteAccount() {
    await deleteAccount();
    qc.clear();
    router.replace('/sign-in');
  }

  function startEditName() {
    setNameDraft(profile?.fullName ?? '');
    setNameError(null);
    setEditingName(true);
  }

  async function saveName() {
    const fullName = nameDraft.trim();
    if (!fullName) {
      setNameError('Name can’t be empty.');
      return;
    }
    try {
      await updateProfile.mutateAsync({ fullName });
      setEditingName(false);
    } catch (e: unknown) {
      setNameError(e instanceof Error ? e.message : 'Something went wrong');
    }
  }

  if (isLoading || !profile) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-8 sm:px-6" aria-busy="true">
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }

  const isOwner = profile.role === 'owner';
  const row = 'press flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-cream';

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
      {/* Identity */}
      <section className="relative overflow-hidden rounded-3xl bg-navy p-6 text-white sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/40 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="rounded-full ring-4 ring-white/15"><Avatar name={profile.fullName} size="xl" /></span>
          <div className="min-w-0 flex-1">
            {editingName ? (
              <div>
                <div className="flex gap-2">
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveName();
                      if (e.key === 'Escape') setEditingName(false);
                    }}
                    maxLength={80}
                    autoFocus
                    aria-label="Full name"
                    className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 text-ink outline-none"
                  />
                  <button onClick={saveName} disabled={updateProfile.isPending} className="press rounded-full bg-primary px-4 font-bold text-white disabled:opacity-70">Save</button>
                  <button onClick={() => setEditingName(false)} className="px-2 font-semibold text-white/70">Cancel</button>
                </div>
                {nameError && <p className="mt-1 text-sm text-red-200">{nameError}</p>}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="truncate font-display text-2xl font-bold tracking-tight sm:text-3xl">{profile.fullName ?? 'Unnamed'}</h1>
                <button onClick={startEditName} aria-label="Edit name" className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
                  <Pencil size={16} />
                </button>
              </div>
            )}
            <p className="mt-1 flex items-center gap-1.5 text-white/70"><Phone size={14} aria-hidden /> {profile.phone ?? 'No phone on file'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold capitalize">{profile.role === 'seeker' ? 'Renter' : profile.role}</span>
              {profile.phoneVerified && <Badge tone="success" icon={BadgeCheck}>Phone verified</Badge>}
            </div>
          </div>
        </div>
      </section>

      {/* Account */}
      <h2 className="mb-2 mt-8 px-1 text-xs font-bold uppercase tracking-wider text-muted">Account</h2>
      <div className="divide-y divide-hairline-soft overflow-hidden rounded-3xl bg-white ring-1 ring-navy/[0.06]">
        <button onClick={() => router.push('/notifications')} className={row}>
          <IconTile icon={Bell} size="sm" />
          <span className="flex-1 font-semibold text-ink">Notifications</span>
          {unreadCount > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white">{unreadCount}</span>}
          <ChevronRight size={18} className="text-muted-soft" aria-hidden />
        </button>
        <Link href="/chats" className={row}>
          <IconTile icon={MessageCircle} size="sm" />
          <span className="flex-1 font-semibold text-ink">Chats</span>
          <ChevronRight size={18} className="text-muted-soft" aria-hidden />
        </Link>
        {isOwner && (
          <>
            <Link href="/my-listings" className={row}>
              <IconTile icon={LayoutList} size="sm" />
              <span className="flex-1 font-semibold text-ink">My listings</span>
              <ChevronRight size={18} className="text-muted-soft" aria-hidden />
            </Link>
            <Link href={`/owner/${profile.id}`} className={row}>
              <IconTile icon={Eye} size="sm" />
              <span className="flex-1">
                <span className="block font-semibold text-ink">View my public profile</span>
                <span className="block text-xs text-muted">What renters see when they tap your name</span>
              </span>
              <ChevronRight size={18} className="text-muted-soft" aria-hidden />
            </Link>
          </>
        )}
      </div>

      {/* Legal */}
      <h2 className="mb-2 mt-8 px-1 text-xs font-bold uppercase tracking-wider text-muted">About</h2>
      <div className="divide-y divide-hairline-soft overflow-hidden rounded-3xl bg-white ring-1 ring-navy/[0.06]">
        <Link href="/privacy" className={row}>
          <IconTile icon={FileText} size="sm" tone="cream" />
          <span className="flex-1 font-semibold text-ink">Privacy Policy</span>
          <ChevronRight size={18} className="text-muted-soft" aria-hidden />
        </Link>
        <Link href="/terms" className={row}>
          <IconTile icon={FileText} size="sm" tone="cream" />
          <span className="flex-1 font-semibold text-ink">Terms of Service</span>
          <ChevronRight size={18} className="text-muted-soft" aria-hidden />
        </Link>
      </div>

      <div className="mt-8 overflow-hidden rounded-3xl bg-white ring-1 ring-navy/[0.06]">
        <button onClick={handleSignOut} className={row}>
          <IconTile icon={LogOut} size="sm" tone="danger" />
          <span className="flex-1 font-semibold text-destructive-pressed">Sign out</span>
        </button>
      </div>

      <button onClick={() => setDeleteOpen(true)} className="mt-6 inline-flex items-center gap-2 px-2 text-sm font-semibold text-muted hover:text-destructive">
        <Trash2 size={16} aria-hidden /> Delete account
      </button>

      <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDeleteAccount} />
    </div>
  );
}
