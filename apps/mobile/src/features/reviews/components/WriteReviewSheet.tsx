import { useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { useCreateReview } from '../hooks';
import { colors } from '@/lib/tokens';

// DESIGN.md `star-selector`: five large stars, ink when filled, hairline when empty.
function StarSelector({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View className="flex-row gap-1" accessibilityRole="radiogroup" accessibilityLabel="Rating">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        return (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            accessibilityRole="radio"
            accessibilityState={{ checked: n === value }}
            accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}
            hitSlop={4}
            className="p-1"
          >
            <Star
              size={34}
              color={filled ? colors.ink : colors.hairline}
              fill={filled ? colors.ink : 'transparent'}
              strokeWidth={1.75}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

// Only shown when the server says viewer.canReview (see ReviewsSection).
export function WriteReviewSheet({
  visible,
  onClose,
  listingId,
}: {
  visible: boolean;
  onClose: () => void;
  listingId: string;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const createReview = useCreateReview(listingId);

  async function handleSubmit() {
    if (rating < 1) {
      Alert.alert('Pick a rating', 'Tap a star to rate this listing.');
      return;
    }
    try {
      await createReview.mutateAsync({ rating, comment: comment.trim() || undefined });
      setRating(0);
      setComment('');
      onClose();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong');
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-white rounded-t-3xl p-5 pb-8">
          <Text className="text-lg font-bold text-ink mb-1">Write a review</Text>
          <Text className="text-muted text-sm mb-4">
            How was this listing and its owner? Reviews are public and can't be edited later.
          </Text>

          <View className="mb-4">
            <StarSelector value={rating} onChange={setRating} />
          </View>

          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Was it as described? Was the owner responsive? (optional)"
            placeholderTextColor={colors['muted-soft']}
            maxLength={1000}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            className="border border-hairline rounded-2xl px-4 py-3 text-ink mb-4 h-28"
          />

          <Pressable
            onPress={handleSubmit}
            disabled={createReview.isPending}
            className="items-center justify-center bg-primary rounded-full py-4 mb-2"
            style={{ opacity: createReview.isPending ? 0.7 : 1 }}
          >
            <Text className="text-white font-semibold">
              {createReview.isPending ? 'Posting…' : 'Post review'}
            </Text>
          </Pressable>
          <Pressable onPress={onClose} className="items-center justify-center py-3">
            <Text className="text-muted font-semibold">Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
