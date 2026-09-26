import Constants from 'expo-constants';

// Expo Go on Android (SDK 53+) removed remote push entirely — even loading
// expo-notifications' native module throws, let alone calling it (see
// app/_layout.tsx's header comment for the crash this caused and how it was fixed).
// Shared here so every call site that touches expo-notifications can skip itself in
// Expo Go instead of each re-deriving the same check.
export const isExpoGo = Constants.appOwnership === 'expo';
