import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useListing, useUpdateListing } from '@/features/listings/hooks';
import { useInstitutions } from '@/features/institutions/hooks';
import { colors } from '@/lib/tokens';
import { AMENITIES, amenityLabel } from '@/features/listings/amenities';


// Editing an existing listing's content — apps/api's PATCH /listings/:id already accepts
// all of these fields (see UpdateListingInput in features/listings/api.ts), it just never
// had client UI beyond status transitions until now. Photos are deliberately excluded:
// the backend's update() doesn't touch `images` at all (only settable at create time, see
// apps/api/STATUS.md) — shown read-only here rather than offered as editable.
export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: listing, isLoading, isError } = useListing(id);
  const updateListing = useUpdateListing(id);
  const { data: institutions } = useInstitutions('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rent, setRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [locality, setLocality] = useState('');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [institutionIds, setInstitutionIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!listing || hydrated) return;
    setTitle(listing.title);
    setDescription(listing.description ?? '');
    setRent(String(listing.rent));
    setDeposit(listing.deposit != null ? String(listing.deposit) : '');
    setLocality(listing.locality);
    setAmenities(Object.entries(listing.amenities ?? {}).filter(([, on]) => on).map(([k]) => k));
    setInstitutionIds(listing.institutions.map((tag) => tag.institution.id));
    setHydrated(true);
  }, [listing, hydrated]);

  function toggleAmenity(key: string) {
    setAmenities((prev) => (prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]));
  }
  function toggleInstitution(instId: string) {
    setInstitutionIds((prev) =>
      prev.includes(instId) ? prev.filter((i) => i !== instId) : [...prev, instId],
    );
  }

  async function handleSave() {
    if (!title.trim() || !locality.trim() || !rent) {
      Alert.alert('Missing details', 'Title, locality, and rent are required.');
      return;
    }
    setSaving(true);
    try {
      await updateListing.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        rent: Number(rent),
        deposit: deposit ? Number(deposit) : undefined,
        locality: locality.trim(),
        amenities: Object.fromEntries(amenities.map((a) => [a, true])),
        institutionIds,
      });
      router.back();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !hydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Stack.Screen options={{ headerShown: true, title: 'Edit Listing' }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (isError || !listing) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Stack.Screen options={{ headerShown: true, title: 'Edit Listing' }} />
        <Text className="text-muted text-center">Couldn&apos;t load this listing.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen options={{ headerShown: true, title: 'Edit Listing' }} />
      <ScrollView contentContainerClassName="px-5 py-4" keyboardShouldPersistTaps="handled">
        <Text className="text-sm font-semibold text-muted mb-2">Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholderTextColor={colors['muted-soft']}
          className="border border-hairline rounded-2xl px-4 py-3 text-ink mb-5"
        />

        <Text className="text-sm font-semibold text-muted mb-2">Locality</Text>
        <TextInput
          value={locality}
          onChangeText={setLocality}
          placeholderTextColor={colors['muted-soft']}
          className="border border-hairline rounded-2xl px-4 py-3 text-ink mb-5"
        />

        <View className="flex-row gap-3 mb-5">
          <View className="flex-1">
            <Text className="text-sm font-semibold text-muted mb-2">Rent (₹/mo)</Text>
            <TextInput
              value={rent}
              onChangeText={setRent}
              keyboardType="number-pad"
              placeholderTextColor={colors['muted-soft']}
              className="border border-hairline rounded-2xl px-4 py-3 text-ink"
            />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-muted mb-2">Deposit (optional)</Text>
            <TextInput
              value={deposit}
              onChangeText={setDeposit}
              keyboardType="number-pad"
              placeholderTextColor={colors['muted-soft']}
              className="border border-hairline rounded-2xl px-4 py-3 text-ink"
            />
          </View>
        </View>

        <Text className="text-sm font-semibold text-muted mb-2">Description (optional)</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          placeholderTextColor={colors['muted-soft']}
          className="border border-hairline rounded-2xl px-4 py-3 text-ink mb-5 h-24"
          textAlignVertical="top"
        />

        <Text className="text-sm font-semibold text-muted mb-2">Amenities</Text>
        <View className="flex-row flex-wrap gap-2 mb-5">
          {AMENITIES.map((key) => {
            const active = amenities.includes(key);
            return (
              <Pressable
                key={key}
                onPress={() => toggleAmenity(key)}
                className={`rounded-full px-4 py-2 ${active ? 'bg-primary' : 'bg-surface'}`}
              >
                <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-ink'}`}>
                  {amenityLabel(key)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {institutions !== undefined && institutions.length > 0 && (
          <>
            <Text className="text-sm font-semibold text-muted mb-2">
              Nearby institutions (optional)
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-5">
              {institutions.map((inst) => {
                const active = institutionIds.includes(inst.id);
                return (
                  <Pressable
                    key={inst.id}
                    onPress={() => toggleInstitution(inst.id)}
                    className={`rounded-full px-4 py-2 ${active ? 'bg-primary' : 'bg-surface'}`}
                  >
                    <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-ink'}`}>
                      {inst.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {listing.images.length > 0 && (
          <>
            <Text className="text-sm font-semibold text-muted mb-2">Photos</Text>
            <Text className="text-xs text-muted-soft mb-3">
              Photos can&apos;t be changed here yet — delete and recreate the listing if you need
              different ones.
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-6">
              {listing.images.map((img) => (
                <Image key={img.id} source={{ uri: img.cloudinaryUrl }} className="w-20 h-20 rounded-xl" />
              ))}
            </View>
          </>
        )}

        {/* apps/api sends a live listing back to moderation when its content changes. */}
        {(listing?.status === 'approved' || listing?.status === 'rented') && (
          <View className="bg-surface rounded-xl px-4 py-3 mb-4">
            <Text className="text-muted text-sm">
              Saving changes sends this listing back for a quick review. It'll be hidden from
              search until it's approved again.
            </Text>
          </View>
        )}

        <Pressable
          onPress={handleSave}
          disabled={saving}
          className="items-center justify-center bg-primary rounded-full py-4 mb-8"
          style={{ opacity: saving ? 0.7 : 1 }}
        >
          {saving ? (
            <ActivityIndicator color={colors['on-primary']} />
          ) : (
            <Text className="text-white font-semibold text-base">Save Changes</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
