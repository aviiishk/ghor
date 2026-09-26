import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { X } from 'lucide-react-native';
import { AMENITIES, amenityLabel } from '../amenities';
import { useInstitutions } from '@/features/institutions/hooks';
import { colors } from '@/lib/tokens';

// Mirrors apps/web's FiltersDialog — same shape, same semantics (amenities = all of,
// institutions = any of), same "edit a draft, apply on Show results".
export type ExtraFilters = {
  rentMin?: number;
  rentMax?: number;
  amenities: string[];
  institutionIds: string[];
};

export const EMPTY_FILTERS: ExtraFilters = { amenities: [], institutionIds: [] };

export function countActiveFilters(f: ExtraFilters): number {
  return (
    (f.rentMin != null || f.rentMax != null ? 1 : 0) + f.amenities.length + f.institutionIds.length
  );
}

const RENT_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: 'Under ₹5k', max: 5000 },
  { label: '₹5k–10k', min: 5000, max: 10000 },
  { label: '₹10k–20k', min: 10000, max: 20000 },
  { label: '₹20k+', min: 20000 },
];

function toInt(value: string): number | undefined {
  const n = parseInt(value.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : undefined;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      className={`rounded-full px-4 py-2 ${active ? 'bg-primary' : 'bg-surface'}`}
    >
      <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-ink'}`}>{label}</Text>
    </Pressable>
  );
}

export function FiltersSheet({
  visible,
  value,
  onApply,
  onClose,
}: {
  visible: boolean;
  value: ExtraFilters;
  onApply: (next: ExtraFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<ExtraFilters>(value);
  const { data: institutions } = useInstitutions('');

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  function toggle(list: 'amenities' | 'institutionIds', key: string) {
    setDraft((d) => ({
      ...d,
      [list]: d[list].includes(key) ? d[list].filter((k) => k !== key) : [...d[list], key],
    }));
  }

  const rentInvalid =
    draft.rentMin != null && draft.rentMax != null && draft.rentMin > draft.rentMax;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-white rounded-t-3xl" style={{ maxHeight: '88%' }}>
          <View className="flex-row items-center justify-between px-5 pt-5 pb-3 border-b border-hairline">
            <Text className="text-lg font-bold text-ink">Filters</Text>
            <Pressable onPress={onClose} accessibilityLabel="Close filters" hitSlop={8}>
              <X size={20} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 24 }}>
            <View>
              <Text className="text-sm font-semibold text-ink mb-3">Monthly rent</Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {RENT_PRESETS.map((p) => {
                  const active = draft.rentMin === p.min && draft.rentMax === p.max;
                  return (
                    <Chip
                      key={p.label}
                      label={p.label}
                      active={active}
                      onPress={() =>
                        setDraft((d) =>
                          active
                            ? { ...d, rentMin: undefined, rentMax: undefined }
                            : { ...d, rentMin: p.min, rentMax: p.max },
                        )
                      }
                    />
                  );
                })}
              </View>
              <View className="flex-row items-center gap-3">
                <TextInput
                  keyboardType="number-pad"
                  placeholder="Min ₹"
                  placeholderTextColor={colors['muted-soft']}
                  accessibilityLabel="Minimum rent"
                  value={draft.rentMin != null ? String(draft.rentMin) : ''}
                  onChangeText={(t) => setDraft((d) => ({ ...d, rentMin: toInt(t) }))}
                  className="flex-1 border border-hairline rounded-xl px-4 py-2.5 text-ink"
                />
                <Text className="text-muted">–</Text>
                <TextInput
                  keyboardType="number-pad"
                  placeholder="Max ₹"
                  placeholderTextColor={colors['muted-soft']}
                  accessibilityLabel="Maximum rent"
                  value={draft.rentMax != null ? String(draft.rentMax) : ''}
                  onChangeText={(t) => setDraft((d) => ({ ...d, rentMax: toInt(t) }))}
                  className="flex-1 border border-hairline rounded-xl px-4 py-2.5 text-ink"
                />
              </View>
              {rentInvalid && (
                <Text className="text-destructive text-sm mt-2">
                  Minimum is higher than maximum.
                </Text>
              )}
            </View>

            <View>
              <Text className="text-sm font-semibold text-ink mb-1">Amenities</Text>
              <Text className="text-xs text-muted mb-3">Show places that have all of these.</Text>
              <View className="flex-row flex-wrap gap-2">
                {AMENITIES.map((key) => (
                  <Chip
                    key={key}
                    label={amenityLabel(key)}
                    active={draft.amenities.includes(key)}
                    onPress={() => toggle('amenities', key)}
                  />
                ))}
              </View>
            </View>

            {/* Hidden until the founder seeds the curated institutions list. */}
            {!!institutions?.length && (
              <View>
                <Text className="text-sm font-semibold text-ink mb-1">Near</Text>
                <Text className="text-xs text-muted mb-3">Show places near any of these.</Text>
                <View className="flex-row flex-wrap gap-2">
                  {institutions.map((inst) => (
                    <Chip
                      key={inst.id}
                      label={inst.name}
                      active={draft.institutionIds.includes(inst.id)}
                      onPress={() => toggle('institutionIds', inst.id)}
                    />
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          <View className="flex-row items-center justify-between px-5 pt-3 pb-8 border-t border-hairline">
            <Pressable onPress={() => setDraft(EMPTY_FILTERS)} hitSlop={8}>
              <Text className="text-ink font-semibold underline">Clear all</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onApply(draft);
                onClose();
              }}
              disabled={rentInvalid}
              className="bg-primary rounded-full px-6 py-3"
              style={{ opacity: rentInvalid ? 0.5 : 1 }}
            >
              <Text className="text-white font-semibold">Show results</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
