import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Bell, ChevronRight, FileText, LogOut, Pencil, Trash2 } from 'lucide-react-native';
import { useProfile, useUpdateProfile } from '@/features/auth/hooks';
import { deleteAccount, signOut } from '@/features/auth/api';
import { DeleteAccountSheet } from '@/features/auth/components/DeleteAccountSheet';
import { useNotifications } from '@/features/notifications/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { colors } from '@/lib/tokens';
import { openLegalPage } from '@/lib/legal';

// Profile/Settings: identity display (name editable), Notifications entry point, legal
// links, sign out, and account deletion (Play Store requirement, root CLAUDE.md §15.4).
// Phone number editing is still not built — it needs OTP re-verification of the new
// number, a separate flow.
export default function ProfileScreen() {
  const { data: profile, isLoading } = useProfile();
  const { data: notifications } = useNotifications();
  const updateProfile = useUpdateProfile();
  const qc = useQueryClient();
  const unreadCount = notifications?.filter((n) => !n.readAt).length ?? 0;

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [deleteVisible, setDeleteVisible] = useState(false);

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          qc.clear();
          router.replace('/(auth)/sign-in');
        },
      },
    ]);
  }

  async function handleDeleteAccount() {
    await deleteAccount();
    setDeleteVisible(false);
    qc.clear();
    router.replace('/(auth)/sign-in');
  }

  function startEditName() {
    setNameDraft(profile?.fullName ?? '');
    setEditingName(true);
  }

  async function saveName() {
    const fullName = nameDraft.trim();
    if (!fullName) {
      Alert.alert('Name required', "Name can't be empty.");
      return;
    }
    try {
      await updateProfile.mutateAsync({ fullName });
      setEditingName(false);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong');
    }
  }

  if (isLoading || !profile) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="px-5 pt-14 pb-6 bg-white">
        <View className="w-16 h-16 rounded-full bg-primary-light items-center justify-center mb-3">
          <Text className="text-primary text-2xl font-bold">
            {(profile.fullName ?? 'U')[0]!.toUpperCase()}
          </Text>
        </View>

        {editingName ? (
          <View className="flex-row items-center gap-2">
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              onSubmitEditing={saveName}
              maxLength={80}
              autoFocus
              accessibilityLabel="Full name"
              placeholderTextColor={colors['muted-soft']}
              className="flex-1 border border-hairline rounded-xl px-3 py-2 text-ink"
            />
            <Pressable
              onPress={saveName}
              disabled={updateProfile.isPending}
              className="bg-primary rounded-full px-4 py-2"
              style={{ opacity: updateProfile.isPending ? 0.7 : 1 }}
            >
              <Text className="text-white font-semibold">Save</Text>
            </Pressable>
            <Pressable onPress={() => setEditingName(false)} className="px-1 py-2">
              <Text className="text-muted font-semibold">Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={startEditName}
            accessibilityLabel="Edit name"
            className="flex-row items-center"
          >
            <Text className="text-xl font-bold text-ink">{profile.fullName ?? 'Unnamed'}</Text>
            <Pencil size={16} color={colors.muted} style={{ marginLeft: 8 }} />
          </Pressable>
        )}

        <Text className="text-muted text-sm mt-0.5">{profile.phone ?? 'No phone on file'}</Text>
        <View className="flex-row items-center gap-2 mt-2">
          <View className="bg-surface rounded-full px-2.5 py-1">
            <Text className="text-xs font-semibold text-ink capitalize">{profile.role}</Text>
          </View>
          {profile.phoneVerified && (
            <Text className="text-success-deep text-xs font-bold">✓ Phone Verified</Text>
          )}
        </View>
      </View>

      <View className="px-5 pt-5">
        <Pressable
          onPress={() => router.push('/notifications')}
          className="flex-row items-center bg-white rounded-2xl px-4 py-4 mb-3 shadow-sm"
        >
          <Bell size={20} color={colors.ink} />
          <Text className="flex-1 text-ink font-semibold ml-3">Notifications</Text>
          {unreadCount > 0 && (
            <View className="bg-primary rounded-full px-2 py-0.5 mr-2">
              <Text className="text-white text-xs font-bold">{unreadCount}</Text>
            </View>
          )}
          <ChevronRight size={18} color={colors['muted-soft']} />
        </Pressable>

        <Pressable
          onPress={() => openLegalPage('privacy')}
          className="flex-row items-center bg-white rounded-2xl px-4 py-4 mb-3 shadow-sm"
        >
          <FileText size={20} color={colors.ink} />
          <Text className="flex-1 text-ink font-semibold ml-3">Privacy Policy</Text>
          <ChevronRight size={18} color={colors['muted-soft']} />
        </Pressable>

        <Pressable
          onPress={() => openLegalPage('terms')}
          className="flex-row items-center bg-white rounded-2xl px-4 py-4 mb-3 shadow-sm"
        >
          <FileText size={20} color={colors.ink} />
          <Text className="flex-1 text-ink font-semibold ml-3">Terms of Service</Text>
          <ChevronRight size={18} color={colors['muted-soft']} />
        </Pressable>

        <Pressable
          onPress={handleSignOut}
          className="flex-row items-center bg-white rounded-2xl px-4 py-4 shadow-sm"
        >
          <LogOut size={20} color={colors.destructive} />
          <Text className="flex-1 text-destructive font-semibold ml-3">Sign Out</Text>
        </Pressable>

        <Pressable
          onPress={() => setDeleteVisible(true)}
          className="flex-row items-center px-4 py-4 mt-4"
        >
          <Trash2 size={18} color={colors.muted} />
          <Text className="text-muted text-sm font-semibold ml-3">Delete account</Text>
        </Pressable>
      </View>

      <DeleteAccountSheet
        visible={deleteVisible}
        onClose={() => setDeleteVisible(false)}
        onConfirm={handleDeleteAccount}
      />
    </ScrollView>
  );
}
