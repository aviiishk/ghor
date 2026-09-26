import { Tabs } from 'expo-router';
import { ClipboardList, Home, MessageCircle, User } from 'lucide-react-native';
import { colors } from '@/lib/tokens';
import { useProfile } from '@/features/auth/hooks';
import { usePushRegistration } from '@/features/notifications/pushRegistration';

export default function TabsLayout() {
  // Role-conditional tab count, decided 2026-07-23 (apps/mobile/design.md's Mobile-only
  // conventions): seekers get 3 tabs, owners get a 4th "Listings" tab between Home and
  // Chat. Home renders the same Browse content for both roles — only the tab count
  // changes. `href: null` is Expo Router's documented way to keep a route registered
  // (still reachable, e.g. by direct navigation) while hiding it from the tab bar.
  const { data: profile } = useProfile();
  const isOwner = profile?.role === 'owner';

  // Root of the authenticated area — the right place to register for push once, for
  // every signed-in user, without duplicating the check on every screen.
  usePushRegistration(!!profile);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          borderTopColor: colors.hairline,
          backgroundColor: colors.canvas,
          height: 64,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="listings"
        options={{
          title: 'Listings',
          tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />,
          href: isOwner ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
