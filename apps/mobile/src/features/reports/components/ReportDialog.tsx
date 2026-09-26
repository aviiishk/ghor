import { useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useCreateReport } from '../hooks';
import type { ReportReasonCategory } from '../api';
import { colors } from '@/lib/tokens';

const CATEGORIES: { value: ReportReasonCategory; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'fake', label: 'Fake' },
  { value: 'inappropriate', label: 'Inappropriate' },
  { value: 'other', label: 'Other' },
];

export function ReportDialog({
  visible,
  onClose,
  listingId,
}: {
  visible: boolean;
  onClose: () => void;
  listingId: string;
}) {
  const [category, setCategory] = useState<ReportReasonCategory>('spam');
  const [reason, setReason] = useState('');
  const createReport = useCreateReport();

  async function handleSubmit() {
    if (!reason.trim()) {
      Alert.alert('Add a reason', 'Tell us briefly what looks wrong with this listing.');
      return;
    }
    try {
      await createReport.mutateAsync({ listingId, reason: reason.trim(), reasonCategory: category });
      setReason('');
      onClose();
      Alert.alert('Report submitted', "Thanks — we'll take a look.");
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong');
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-white rounded-t-3xl p-5 pb-8">
          <Text className="text-lg font-bold text-ink mb-1">Report this listing</Text>
          <Text className="text-muted text-sm mb-4">
            Let us know if something looks off — spam, fake, or otherwise inappropriate.
          </Text>

          <View className="flex-row flex-wrap gap-2 mb-4">
            {CATEGORIES.map((c) => {
              const active = category === c.value;
              return (
                <Pressable
                  key={c.value}
                  onPress={() => setCategory(c.value)}
                  className={`rounded-full px-4 py-2 ${active ? 'bg-primary' : 'bg-surface'}`}
                >
                  <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-ink'}`}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="What's wrong with this listing?"
            placeholderTextColor={colors['muted-soft']}
            multiline
            numberOfLines={3}
            className="border border-hairline rounded-2xl px-4 py-3 text-ink mb-4 h-24"
            textAlignVertical="top"
          />

          <Pressable
            onPress={handleSubmit}
            disabled={createReport.isPending}
            className="items-center justify-center bg-destructive rounded-full py-4 mb-2"
            style={{ opacity: createReport.isPending ? 0.7 : 1 }}
          >
            <Text className="text-white font-semibold">Submit Report</Text>
          </Pressable>
          <Pressable onPress={onClose} className="items-center justify-center py-3">
            <Text className="text-muted font-semibold">Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
