import { useEffect } from 'react';
import Constants from 'expo-constants';
import { isExpoGo } from '@/lib/isExpoGo';
import { registerPushToken } from './api';

// Requests notification permission and registers the resulting Expo push token with
// apps/api — the client half of root CLAUDE.md §7.7's "reliable Expo push on every
// message" requirement (the server half — sending — is built and verified live, see
// apps/api/STATUS.md). Called once from (tabs)/_layout.tsx, the root of the
// authenticated area, so it only runs for a signed-in user.
//
// Two things make this untestable end-to-end in this environment, both flagged rather
// than hidden:
// 1. Expo Go on Android (SDK 53+) removed remote push entirely — skipped here via the
//    same `isExpoGo` check that fixed the launch crash in app/_layout.tsx. This only
//    actually runs in a real dev/production build.
// 2. `EAS_PROJECT_ID` (read via Constants.expoConfig.extra.eas.projectId, see
//    app.config.ts) is still a placeholder value — Expo requires a real EAS project to
//    mint a push token. Registration no-ops gracefully until that's configured, rather
//    than throwing.
export function usePushRegistration(enabled: boolean) {
  useEffect(() => {
    if (!enabled || isExpoGo) return;

    (async () => {
      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
        if (!projectId) return;

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Notifications = require('expo-notifications') as typeof import('expo-notifications');

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;

        const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
        await registerPushToken(expoPushToken);
      } catch {
        // Best-effort — a failed registration must never affect the rest of the app.
      }
    })();
  }, [enabled]);
}
