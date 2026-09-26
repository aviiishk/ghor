import { useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { colors } from '@/lib/tokens';

const CONFIRM_WORD = 'DELETE';

// Typed confirmation, not a one-tap Alert — this is irreversible and takes the user's
// listings and every conversation (both sides) with it. Mirrors apps/web's
// DeleteAccountDialog; see apps/api's AuthService.deleteAccount() for what's removed.
export function DeleteAccountSheet({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [typed, setTyped] = useState('');
  const [pending, setPending] = useState(false);
  const canConfirm = typed.trim() === CONFIRM_WORD && !pending;

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong');
      setPending(false);
    }
  }

  function handleClose() {
    setTyped('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-white rounded-t-3xl p-5 pb-8">
          <Text className="text-lg font-bold text-ink mb-1">Delete your account?</Text>
          <Text className="text-muted text-sm mb-3">
            This can't be undone. It permanently deletes your profile and login, all your
            listings and photos, all your conversations and messages, and your reviews,
            reports and notifications.
          </Text>

          <Text className="text-sm font-semibold text-ink mb-2">
            Type {CONFIRM_WORD} to confirm
          </Text>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholderTextColor={colors['muted-soft']}
            className="border border-hairline rounded-2xl px-4 py-3 text-ink mb-4"
          />

          <Pressable
            onPress={handleConfirm}
            disabled={!canConfirm}
            className="items-center justify-center bg-destructive rounded-full py-4 mb-2"
            style={{ opacity: canConfirm ? 1 : 0.5 }}
          >
            <Text className="text-white font-semibold">
              {pending ? 'Deleting…' : 'Delete account permanently'}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleClose}
            disabled={pending}
            className="items-center justify-center py-3"
          >
            <Text className="text-muted font-semibold">Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
