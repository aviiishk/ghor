import type { ComponentType } from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors } from '@/lib/tokens';

type IconProps = { size?: number; color?: string };

// Mirrors apps/web's components/ui EmptyState (redesign 2026-09-26): every meaningful
// empty state gets an icon composition, a human title, one line of explanation and,
// usually, the next action — never a bare "No data found".
export function EmptyState({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: ComponentType<IconProps>;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View className="items-center px-8 py-16">
      <View style={{ width: 88, height: 88, alignItems: 'center', justifyContent: 'center' }}>
        <View className="bg-primary-light" style={{ position: 'absolute', width: 84, height: 84, borderRadius: 28, transform: [{ rotate: '6deg' }] }} />
        <View className="bg-cream-deep" style={{ position: 'absolute', width: 84, height: 84, borderRadius: 28, transform: [{ rotate: '-3deg' }] }} />
        <View className="items-center justify-center rounded-3xl bg-white" style={{ width: 64, height: 64, elevation: 2 }}>
          <Icon size={28} color={colors.primary} />
        </View>
      </View>
      <Text className="mt-5 text-center text-lg font-bold text-ink">{title}</Text>
      {body && <Text className="mt-1.5 text-center text-sm leading-5 text-muted">{body}</Text>}
      {actionLabel && onAction && (
        <Pressable onPress={onAction} className="mt-5 rounded-full bg-primary px-5 py-3 active:opacity-80">
          <Text className="text-sm font-semibold text-white">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
