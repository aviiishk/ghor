import '../global.css';
import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { hasSession, clearTokens } from '@/lib/apiClient';
import { getProfile } from '@/features/auth/api';
import { isExpoGo } from '@/lib/isExpoGo';

SplashScreen.preventAutoHideAsync();

// Expo Go on Android (SDK 53+) throws as soon as `expo-notifications` is *loaded* —
// remote push was removed from Expo Go entirely, and the module throws from its own
// top-level code, not just from calling setNotificationHandler()/addNotification...
// Listener(). A static `import * as Notifications from 'expo-notifications'` is hoisted
// and evaluated unconditionally regardless of any runtime check below it, so guarding
// only the *usages* (the first attempt at this fix) still crashed — the import itself
// had already run. A conditional `require()` is what actually defers loading the module
// until after we've confirmed we're not in Expo Go — re-enabled normally in a real
// dev/production build, where remote push does work (see features/notifications for the
// registration side, added once apps/api had a real endpoint + Expo-side sender to
// register against).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Notifications = isExpoGo
  ? null
  : (require('expo-notifications') as typeof import('expo-notifications'));

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  // Tapping a push notification → navigate directly to the relevant chat thread or
  // listing, matching every payload shape apps/api's PushService actually sends (see
  // ChatService.sendMessage() and ListingsService.notifyOwner()).
  useEffect(() => {
    if (!Notifications) return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | { conversationId?: string; listingId?: string }
        | undefined;
      if (data?.conversationId) {
        router.push(`/chat/${data.conversationId}`);
      } else if (data?.listingId) {
        router.push(`/listing/${data.listingId}`);
      }
    });
    return () => sub.remove();
  }, []);

  // Auth gate: redirect based on stored token + profile completeness. Runs once at
  // launch — apps/api has no realtime "auth state changed" stream the way Supabase Auth
  // did, so mid-session sign-out/expiry is handled where it happens (signOut() in
  // features/auth/api.ts, or a SessionExpiredError from apiClient.ts), not reactively
  // here. See apps/mobile/STATUS.md for that as a known gap, not an oversight.
  useEffect(() => {
    (async () => {
      if (!(await hasSession())) {
        router.replace('/(auth)/sign-in');
        return;
      }
      try {
        const profile = await getProfile();
        router.replace(profile.fullName ? '/(tabs)' : '/(auth)/onboarding');
      } catch {
        // Stored token is stale/invalid (e.g. expired while the app was closed) — clear
        // it rather than leaving the app stuck retrying against a dead session.
        await clearTokens();
        router.replace('/(auth)/sign-in');
      }
    })();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="listing/[id]" options={{ headerShown: true, title: '' }} />
        <Stack.Screen name="listing/[id]/edit" options={{ headerShown: true, title: 'Edit Listing' }} />
        <Stack.Screen name="listing/new" options={{ headerShown: true, title: 'Create Listing' }} />
        <Stack.Screen name="chat/[conversationId]" options={{ headerShown: true, title: '' }} />
        <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notifications' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </QueryClientProvider>
  );
}
