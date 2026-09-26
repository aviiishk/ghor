import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { verifyPhoneOtp, sendPhoneOtp, getProfile } from '@/features/auth/api';
import { colors } from '@/lib/tokens';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 45;

export default function VerifyOtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const timer = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  async function handleVerify() {
    if (otp.length < OTP_LENGTH) return;
    setLoading(true);
    try {
      await verifyPhoneOtp(phone!, otp);
      // Returning users (fullName already set) skip onboarding; first-time users don't.
      const profile = await getProfile();
      router.replace(profile.fullName ? '/(tabs)' : '/(auth)/onboarding');
    } catch (e: unknown) {
      Alert.alert('Invalid OTP', e instanceof Error ? e.message : 'Please try again');
      setOtp('');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (countdown > 0) return;
    try {
      await sendPhoneOtp(phone!);
      setCountdown(RESEND_SECONDS);
      setOtp('');
      Alert.alert('OTP resent');
    } catch {
      Alert.alert('Failed to resend OTP');
    }
  }

  const digits = otp.padEnd(OTP_LENGTH, ' ').split('');

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 px-6 pt-16">
        {/* Logo */}
        <Text className="text-3xl font-bold text-ink mb-1">
          GH<Text className="text-primary">●</Text>R
        </Text>

        <Text className="text-2xl font-bold text-ink mt-8 mb-1">Verification Code</Text>
        <Text className="text-muted mb-10">
          Enter the {OTP_LENGTH}-digit code sent to{'\n'}
          <Text className="text-primary font-medium">{phone}</Text>
        </Text>

        {/* OTP boxes (hidden real input, visual boxes) */}
        <View className="flex-row gap-3 mb-8 justify-center">
          {digits.map((d, i) => (
            <View
              key={i}
              className={`w-12 h-14 rounded-2xl border-2 items-center justify-center ${
                i < otp.length ? 'border-primary bg-primary-light' : 'border-hairline bg-surface'
              }`}
            >
              <Text className="text-2xl font-bold text-ink">{d.trim()}</Text>
            </View>
          ))}
        </View>

        {/* Hidden real input */}
        <TextInput
          ref={inputRef}
          value={otp}
          onChangeText={(v) => {
            const clean = v.replace(/\D/g, '').slice(0, OTP_LENGTH);
            setOtp(clean);
            if (clean.length === OTP_LENGTH) {
              handleVerify();
            }
          }}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
          className="absolute opacity-0 h-0 w-0"
        />

        {/* Tap anywhere on boxes to focus */}
        <Pressable
          onPress={() => inputRef.current?.focus()}
          className="absolute top-56 left-0 right-0 h-20"
        />

        {/* Verify button */}
        <Pressable
          onPress={handleVerify}
          disabled={loading || otp.length < OTP_LENGTH}
          className="flex-row items-center justify-center bg-primary rounded-full py-4 mb-6"
          style={({ pressed }) => ({
            opacity: otp.length < OTP_LENGTH ? 0.5 : pressed ? 0.85 : 1,
          })}
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

        {/* Resend */}
        <Pressable onPress={handleResend} disabled={countdown > 0}>
          <Text className="text-center text-muted">
            Didn't receive the code?{' '}
            <Text className={countdown > 0 ? 'text-muted' : 'text-primary font-semibold'}>
              {countdown > 0 ? `Resend in 00:${String(countdown).padStart(2, '0')}` : 'Resend Code'}
            </Text>
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
