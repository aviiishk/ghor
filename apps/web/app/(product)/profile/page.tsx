'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, ChevronRight, FileText, LogOut, Pencil, Trash2 } from 'lucide-react';
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

  if (isLoading || !profile) return <p className="text-muted text-center py-24">Loading…</p>;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center shrink-0">
          <span className="text-primary text-2xl font-bold">
            {(profile.fullName ?? 'U')[0]!.toUpperCase()}
          </span>
        </div>
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
                  className="min-w-0 flex-1 border border-hairline rounded-xl px-3 py-2 text-ink"
                />
                <button
                  onClick={saveName}
                  disabled={updateProfile.isPending}
                  className="bg-primary text-white font-semibold rounded-full px-4 disabled:opacity-70"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  className="text-muted font-semibold px-2"
                >
                  Cancel
                </button>
              </div>
              {nameError && <p className="text-destructive text-sm mt-1">{nameError}</p>}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-ink truncate">
                {profile.fullName ?? 'Unnamed'}
              </h1>
              <button
                onClick={startEditName}
                aria-label="Edit name"
                className="text-muted hover:text-ink p-1"
              >
                <Pencil size={16} />
              </button>
            </div>
          )}
          <p className="text-muted text-sm">{profile.phone ?? 'No phone on file'}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="bg-surface rounded-full px-2.5 py-1 text-xs font-semibold text-ink capitalize">
              {profile.role}
            </span>
            {profile.phoneVerified && (
              <span className="text-success-deep text-xs font-bold">✓ Phone Verified</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={() => router.push('/notifications')}
          className="flex items-center bg-white border border-hairline rounded-2xl px-4 py-4 text-left"
        >
          <Bell size={20} className="text-ink" />
          <span className="flex-1 text-ink font-semibold ml-3">Notifications</span>
          {unreadCount > 0 && (
            <span className="bg-primary text-white text-xs font-bold rounded-full px-2 py-0.5 mr-2">
              {unreadCount}
            </span>
          )}
          <ChevronRight size={18} className="text-muted-soft" />
        </button>

        <Link
          href="/privacy"
          className="flex items-center bg-white border border-hairline rounded-2xl px-4 py-4"
        >
          <FileText size={20} className="text-ink" />
          <span className="flex-1 text-ink font-semibold ml-3">Privacy Policy</span>
          <ChevronRight size={18} className="text-muted-soft" />
        </Link>

        <Link
          href="/terms"
          className="flex items-center bg-white border border-hairline rounded-2xl px-4 py-4"
        >
          <FileText size={20} className="text-ink" />
          <span className="flex-1 text-ink font-semibold ml-3">Terms of Service</span>
          <ChevronRight size={18} className="text-muted-soft" />
        </Link>

        <button
          onClick={handleSignOut}
          className="flex items-center bg-white border border-hairline rounded-2xl px-4 py-4 text-left"
        >
          <LogOut size={20} className="text-destructive" />
          <span className="flex-1 text-destructive font-semibold ml-3">Sign Out</span>
        </button>

        <button
          onClick={() => setDeleteOpen(true)}
          className="flex items-center px-4 py-3 mt-4 text-left text-muted hover:text-destructive"
        >
          <Trash2 size={18} />
          <span className="ml-3 text-sm font-semibold">Delete account</span>
        </button>
      </div>

      <DeleteAccountDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteAccount}
      />
    </div>
  );
}
