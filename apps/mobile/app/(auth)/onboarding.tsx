import { useState } from 'react';
import {
  View, Text, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { User, Home, ArrowRight } from 'lucide-react-native';
import { completeOnboarding } from '@/features/auth/api';
import { colors } from '@/lib/tokens';
import { openLegalPage } from '@/lib/legal';

type Role = 'seeker' | 'owner';

export default function OnboardingScreen() {
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('seeker');
  const [loading, setLoading] = useState(false);

  async function handleComplete() {
    if (!name.trim()) {
      Alert.alert('Please enter your name');
      return;
    }
    setLoading(true);
    try {
      await completeOnboarding({ fullName: name.trim(), role });
      router.replace('/(tabs)');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-6 py-12"
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo + headline */}
        <View className="mb-10">
          <Text className="text-4xl font-bold text-ink">
            GH<Text className="text-primary">●</Text>R
          </Text>
          <Text className="text-2xl font-bold text-ink mt-4">Find your next room.</Text>
          <Text className="text-primary text-lg font-medium">Feel at home.</Text>
        </View>

        {/* Role selector */}
        <Text className="text-sm font-medium text-muted mb-3">I am…</Text>
        <View className="gap-3 mb-6">
          <RoleCard
            icon={<User size={20} color={role === 'seeker' ? colors.primary : colors.muted} />}
            label="Looking for a room"
            sublabel="Find rooms to rent"
            selected={role === 'seeker'}
            onPress={() => setRole('seeker')}
          />
          <RoleCard
            icon={<Home size={20} color={role === 'owner' ? colors.primary : colors.muted} />}
            label="I am a room owner"
            sublabel="List your rooms"
            selected={role === 'owner'}
            onPress={() => setRole('owner')}
          />
        </View>

        {/* Name */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-muted mb-2">Full Name</Text>
          <View className="flex-row items-center border border-hairline rounded-2xl px-4 py-3 bg-surface">
            <User size={16} color={colors.muted} />
            <TextInput
              className="flex-1 ml-2 text-ink text-base"
              placeholder="Your full name"
              placeholderTextColor={colors['muted-soft']}
              value={name}
              onChangeText={setName}
              returnKeyType="done"
              onSubmitEditing={handleComplete}
            />
          </View>
        </View>

        {/* Terms */}
        <Text className="text-xs text-muted mb-6">
          By signing up, you agree to our{' '}
          <Text className="text-primary" onPress={() => openLegalPage('terms')}>
            Terms & Conditions
          </Text> and{' '}
          <Text className="text-primary" onPress={() => openLegalPage('privacy')}>
            Privacy Policy
          </Text>
        </Text>

        {/* Submit */}
        <Pressable
          onPress={handleComplete}
          disabled={loading}
          className="flex-row items-center justify-center bg-primary rounded-full py-4"
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          {loading ? (
            <ActivityIndicator color={colors['on-primary']} />
          ) : (
            <>
              <Text className="text-white font-semibold text-base mr-2">Get Started</Text>
              <ArrowRight size={18} color={colors['on-primary']} />
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function RoleCard({
  icon, label, sublabel, selected, onPress,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center p-4 rounded-2xl border-2 ${
        selected ? 'border-primary bg-primary-light' : 'border-hairline bg-surface'
      }`}
    >
      <View className={`mr-3 p-2 rounded-xl ${selected ? 'bg-white' : 'bg-white'}`}>
        {icon}
      </View>
      <View className="flex-1">
        <Text className={`font-semibold ${selected ? 'text-primary' : 'text-ink'}`}>
          {label}
        </Text>
        <Text className="text-muted text-sm">{sublabel}</Text>
      </View>
      <View
        className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
          selected ? 'border-primary bg-primary' : 'border-slate-300'
        }`}
      >
        {selected && <View className="w-2 h-2 rounded-full bg-white" />}
      </View>
    </Pressable>
  );
}
