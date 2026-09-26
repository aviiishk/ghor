import { useState } from 'react';
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
import { Stack, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ArrowRight, Plus, X } from 'lucide-react-native';
import { useCreateListing } from '@/features/listings/hooks';
import { updateListing } from '@/features/listings/api';
import { useInstitutions } from '@/features/institutions/hooks';
import { uploadImage } from '@/lib/cloudinary';
import { colors } from '@/lib/tokens';
import { AMENITIES, amenityLabel } from '@/features/listings/amenities';


export default function NewListingScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [propertyType, setPropertyType] = useState<'room' | 'flat'>('room');
  const [rent, setRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [locality, setLocality] = useState('');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [institutionIds, setInstitutionIds] = useState<string[]>([]);
  const [localPhotos, setLocalPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const createListing = useCreateListing();
  const { data: institutions } = useInstitutions('');

  function toggleAmenity(key: string) {
    setAmenities((prev) => (prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]));
  }
  function toggleInstitution(id: string) {
    setInstitutionIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  async function pickPhotos() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 8,
    });
    if (!result.canceled) {
      setLocalPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
    }
  }

  function removePhoto(uri: string) {
    setLocalPhotos((prev) => prev.filter((p) => p !== uri));
  }

  async function handleSubmit(publish: boolean) {
    if (!title.trim() || !locality.trim() || !rent) {
      Alert.alert('Missing details', 'Title, locality, and rent are required.');
      return;
    }
    if (publish && localPhotos.length < 3) {
      Alert.alert('Add more photos', 'At least 3 photos are required to publish a listing.');
      return;
    }

    setSaving(true);
    try {
      const uploadedUrls = await Promise.all(localPhotos.map((uri) => uploadImage(uri)));
      const listing = await createListing.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        propertyType,
        rent: Number(rent),
        deposit: deposit ? Number(deposit) : undefined,
        locality: locality.trim(),
        amenities: Object.fromEntries(amenities.map((a) => [a, true])),
        images: uploadedUrls.map((cloudinaryUrl, position) => ({ cloudinaryUrl, position })),
        institutionIds: institutionIds.length ? institutionIds : undefined,
      });

      if (publish) {
        // Publishing is a distinct state transition (draft -> pending), not part of
        // create — matches apps/api/src/listings/listings.service.ts exactly.
        await updateListing(listing.id, { status: 'pending' });
      }

      Alert.alert(
        publish ? 'Submitted for review' : 'Saved as draft',
        publish
          ? 'Your listing will go live once approved.'
          : 'Finish and publish it anytime from My Listings.',
      );
      router.replace(`/listing/${listing.id}`);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen options={{ headerShown: true, title: 'Create Listing' }} />
      <ScrollView contentContainerClassName="px-5 py-4" keyboardShouldPersistTaps="handled">
        <Text className="text-sm font-semibold text-muted mb-2">Property type</Text>
        <View className="flex-row gap-2 mb-5">
          {(['room', 'flat'] as const).map((type) => (
            <Pressable
              key={type}
              onPress={() => setPropertyType(type)}
              className={`flex-1 items-center py-3 rounded-2xl border-2 ${
                propertyType === type ? 'border-primary bg-primary-light' : 'border-hairline bg-surface'
              }`}
            >
              <Text
                className={`font-semibold capitalize ${
                  propertyType === type ? 'text-primary' : 'text-ink'
                }`}
              >
                {type}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text className="text-sm font-semibold text-muted mb-2">Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. 2BHK near GS Road"
          placeholderTextColor={colors['muted-soft']}
          className="border border-hairline rounded-2xl px-4 py-3 text-ink mb-5"
        />

        <Text className="text-sm font-semibold text-muted mb-2">Locality</Text>
        <TextInput
          value={locality}
          onChangeText={setLocality}
          placeholder="e.g. Zoo Road, Guwahati"
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
              placeholder="7000"
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
              placeholder="14000"
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
          placeholder="A few lines about the place..."
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

        <Text className="text-sm font-semibold text-muted mb-2">
          Photos {localPhotos.length > 0 ? `(${localPhotos.length})` : ''}
        </Text>
        <Text className="text-xs text-muted-soft mb-3">
          At least 3 photos are required to publish.
        </Text>
        <View className="flex-row flex-wrap gap-2 mb-6">
          {localPhotos.map((uri) => (
            <View key={uri} className="relative">
              <Image source={{ uri }} className="w-20 h-20 rounded-xl" />
              <Pressable
                onPress={() => removePhoto(uri)}
                className="w-5 h-5 rounded-full bg-ink items-center justify-center"
                style={{ position: 'absolute', top: -6, right: -6 }}
              >
                <X size={12} color={colors['on-primary']} />
              </Pressable>
            </View>
          ))}
          <Pressable
            onPress={pickPhotos}
            className="w-20 h-20 rounded-xl border-2 border-dashed border-hairline items-center justify-center"
          >
            <Plus size={20} color={colors.muted} />
          </Pressable>
        </View>

        <Pressable
          onPress={() => handleSubmit(true)}
          disabled={saving}
          className="flex-row items-center justify-center bg-primary rounded-full py-4 mb-3"
          style={{ opacity: saving ? 0.7 : 1 }}
        >
          {saving ? (
            <ActivityIndicator color={colors['on-primary']} />
          ) : (
            <>
              <Text className="text-white font-semibold text-base mr-2">Submit for Review</Text>
              <ArrowRight size={18} color={colors['on-primary']} />
            </>
          )}
        </Pressable>
        <Pressable
          onPress={() => handleSubmit(false)}
          disabled={saving}
          className="items-center justify-center border border-hairline rounded-full py-4 mb-8"
        >
          <Text className="text-ink font-semibold text-base">Save as Draft</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
