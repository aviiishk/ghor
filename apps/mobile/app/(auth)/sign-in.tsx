import { useState } from 'react';
import {
  View, Text, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Phone, ArrowRight } from 'lucide-react-native';
import { sendPhoneOtp } from '@/features/auth/api';
import { colors } from '@/lib/tokens';
import { openLegalPage } from '@/lib/legal';

export default function SignInScreen() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handlePhoneContinue() {
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.length < 10) {
      Alert.alert('Enter a valid mobile number');
      return;
    }
    const formatted = cleaned.startsWith('+') ? cleaned : `+91${cleaned}`;
    setLoading(true);
    try {
      await sendPhoneOtp(formatted);
      router.push({ pathname: '/(auth)/verify-otp', params: { phone: formatted } });
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    // Not wired up yet: needs real Google Cloud OAuth client IDs (iOS/Android/Expo) to
    // drive an expo-auth-session flow and get an idToken to send to apps/api's
    // POST /auth/google — see apps/mobile/STATUS.md. Phone OTP is fully working end to
    // end in the meantime.
    Alert.alert(
      'Coming soon',
      'Google sign-in isn’t set up yet — please continue with your phone number for now.',
    );
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
        {/* Logo */}
        <View className="mb-10">
          <Text className="text-4xl font-bold text-ink">
            GH<Text className="text-primary">●</Text>R
          </Text>
          <Text className="text-2xl font-bold text-ink mt-4">Welcome back!</Text>
          <Text className="text-muted mt-1">Login to continue your room search journey.</Text>
        </View>

        {/* Phone input */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-muted mb-2">Mobile Number</Text>
          <View className="flex-row items-center border border-hairline rounded-2xl px-4 py-3 bg-surface">
            <View className="bg-primary-light rounded-lg px-2 py-1 mr-3">
              <Text className="text-primary font-semibold text-sm">+91</Text>
            </View>
            <Phone size={16} color={colors.muted} />
            <TextInput
              className="flex-1 ml-2 text-ink text-base"
              placeholder="Enter your mobile number"
              placeholderTextColor={colors['muted-soft']}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={10}
              returnKeyType="done"
              onSubmitEditing={handlePhoneContinue}
            />
          </View>
        </View>

        {/* Continue button */}
        <Pressable
          onPress={handlePhoneContinue}
          disabled={loading}
          className="flex-row items-center justify-center bg-primary rounded-full py-4 mb-6"
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          {loading ? (
            <ActivityIndicator color={colors['on-primary']} />
          ) : (
            <>
              <Text className="text-white font-semibold text-base mr-2">Continue</Text>
              <ArrowRight size={18} color={colors['on-primary']} />
            </>
          )}
        </Pressable>

        {/* Divider */}
        <View className="flex-row items-center mb-6">
          <View className="flex-1 h-px bg-hairline" />
          <Text className="mx-4 text-muted text-sm">Or continue with</Text>
          <View className="flex-1 h-px bg-hairline" />
        </View>

        {/* Google */}
        <Pressable
          onPress={handleGoogle}
          disabled={googleLoading}
          className="flex-row items-center justify-center border border-hairline rounded-full py-4"
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          {googleLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Text className="text-lg mr-2">G</Text>
              <Text className="text-ink font-medium">Continue with Google</Text>
            </>
          )}
        </Pressable>

        {/* Terms */}
        <Text className="text-xs text-muted text-center mt-8">
          By signing in, you agree to our{' '}
          <Text className="text-primary" onPress={() => openLegalPage('terms')}>
            Terms & Conditions
          </Text> and{' '}
          <Text className="text-primary" onPress={() => openLegalPage('privacy')}>
            Privacy Policy
          </Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
