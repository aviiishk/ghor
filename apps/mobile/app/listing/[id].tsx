import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Flag, MessageCircle, Pencil, Phone } from 'lucide-react-native';
import { useListing, useUpdateListing } from '@/features/listings/hooks';
import { useCreateConversation } from '@/features/chat/hooks';
import { useProfile } from '@/features/auth/hooks';
import { ReportDialog } from '@/features/reports/components/ReportDialog';
import { RatingDisplay } from '@/features/reviews/components/RatingDisplay';
import { ReviewsSection } from '@/features/reviews/components/ReviewsSection';
import { SimilarListings } from '@/features/listings/components/SimilarListings';
import { ListingInsights } from '@/features/listings/components/ListingInsights';
import { useOwner } from '@/features/owners/hooks';
import { describeResponseTime } from '@/features/owners/api';
import { trackEvent } from '@/lib/analytics';
import { colors } from '@/lib/tokens';
import { amenityLabel } from '@/features/listings/amenities';

const { width } = Dimensions.get('window');

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: listing, isLoading, isError } = useListing(id);
  const { data: profile } = useProfile();
  const updateListing = useUpdateListing(id);
  const createConversation = useCreateConversation();
  const [activeImage, setActiveImage] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  // Hooks must run before the early returns below, so this keys off listing?.ownerId.
  const { data: owner } = useOwner(listing?.ownerId);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (isError || !listing) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Stack.Screen options={{ headerShown: true, title: '' }} />
        <Text className="text-muted text-center">This listing isn't available anymore.</Text>
      </View>
    );
  }

  const isOwner = profile?.id === listing.ownerId;
  const amenities = Object.entries(listing.amenities ?? {})
    .filter(([, on]) => on)
    .map(([key]) => key);

  async function handleStatusChange(status: 'pending' | 'approved' | 'rented') {
    try {
      await updateListing.mutateAsync({ status });
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong');
    }
  }

  async function handleChat() {
    // The core conversion event (root CLAUDE.md §4) — counted on tap, before the
    // conversation request, so a failed request still shows up as intent.
    trackEvent({ eventName: 'contact_tap', listingId: listing!.id, channel: 'chat' });
    try {
      const conversation = await createConversation.mutateAsync(listing!.id);
      router.push(`/chat/${conversation.id}`);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not start the conversation');
    }
  }

  function handleCall() {
    // Non-null: this closure only ever runs after the `!listing` guard above has
    // already returned early, but TS can't see that narrowing across a closure boundary.
    const phone = listing!.owner.phone;
    trackEvent({ eventName: 'contact_tap', listingId: listing!.id, channel: 'call' });
    if (!phone) {
      Alert.alert('No phone number', 'This owner hasn’t added a phone number yet.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  }

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView>
        <View>
          {listing.images.length > 0 ? (
            <>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) =>
                  setActiveImage(Math.round(e.nativeEvent.contentOffset.x / width))
                }
              >
                {listing.images.map((img) => (
                  <Image
                    key={img.id}
                    source={{ uri: img.cloudinaryUrl }}
                    style={{ width, height: width * 0.75 }}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
              {listing.images.length > 1 && (
                <View
                  className="flex-row justify-center gap-1.5"
                  style={{ position: 'absolute', bottom: 12, left: 0, right: 0 }}
                >
                  {listing.images.map((img, i) => (
                    <View
                      key={img.id}
                      className={`w-1.5 h-1.5 rounded-full ${i === activeImage ? 'bg-white' : 'bg-white/50'}`}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View
              style={{ width, height: width * 0.75 }}
              className="bg-surface items-center justify-center"
            >
              <Text className="text-muted-soft">No photos yet</Text>
            </View>
          )}
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-white items-center justify-center"
            style={{ position: 'absolute', top: 56, left: 16 }}
          >
            <ArrowLeft size={20} color={colors.ink} />
          </Pressable>
          {isOwner && (
            <Pressable
              onPress={() => router.push(`/listing/${listing.id}/edit`)}
              className="w-10 h-10 rounded-full bg-white items-center justify-center"
              style={{ position: 'absolute', top: 56, right: 16 }}
            >
              <Pencil size={18} color={colors.ink} />
            </Pressable>
          )}
        </View>

        <View className="p-5">
          <Text className="text-2xl font-bold text-ink mb-1">{listing.title}</Text>
          <Text className="text-muted mb-2">
            {listing.locality}, {listing.city}
          </Text>
          <View className="mb-3">
            <RatingDisplay avgRating={listing.avgRating} reviewCount={listing.reviewCount} />
          </View>

          <Text className="text-3xl font-bold text-ink mb-4">
            ₹{listing.rent.toLocaleString('en-IN')}
            <Text className="text-base font-medium text-muted">/mo</Text>
          </Text>

          {listing.deposit != null && (
            <Text className="text-muted mb-4">
              Deposit: ₹{listing.deposit.toLocaleString('en-IN')}
            </Text>
          )}

          {amenities.length > 0 && (
            <View className="flex-row flex-wrap gap-2 mb-4">
              {amenities.map((key) => (
                <View key={key} className="bg-primary-light rounded-full px-3 py-1.5">
                  <Text className="text-primary text-xs font-bold">
                    {amenityLabel(key)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {listing.institutions.length > 0 && (
            <View className="flex-row flex-wrap gap-2 mb-4">
              {listing.institutions.map((tag) => (
                <View key={tag.institution.id} className="bg-primary-light rounded-full px-3 py-1.5">
                  <Text className="text-primary text-xs font-bold">
                    Near {tag.institution.name}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {listing.description && (
            <Text className="text-ink leading-6 mb-5">{listing.description}</Text>
          )}

          <View className="border-t border-hairline pt-4">
            <Text className="text-sm text-muted mb-1">Listed by</Text>
            <View className="flex-row items-center justify-between">
              <Pressable
                onPress={() => router.push(`/owner/${listing.ownerId}`)}
                className="flex-1 mr-3"
                accessibilityRole="link"
              >
                <View className="flex-row items-center">
                  <Text className="text-ink font-semibold underline">
                    {listing.owner.fullName ?? 'Owner'}
                  </Text>
                  {listing.owner.phoneVerified && (
                    <Text className="text-success-deep text-xs font-bold ml-2">✓ Phone Verified</Text>
                  )}
                </View>
                {describeResponseTime(owner?.responseTimeMinutes ?? null) && (
                  <Text className="text-xs text-muted mt-0.5">
                    {describeResponseTime(owner?.responseTimeMinutes ?? null)}
                  </Text>
                )}
              </Pressable>
              {!isOwner && (
                <Pressable onPress={() => setReportOpen(true)} className="flex-row items-center">
                  <Flag size={14} color={colors['muted-soft']} />
                  <Text className="text-muted-soft text-xs font-semibold ml-1">Report</Text>
                </Pressable>
              )}
            </View>
          </View>

          <ReviewsSection
            listingId={listing.id}
            avgRating={listing.avgRating}
            reviewCount={listing.reviewCount}
          />

          {/* Owner-only: their listing's stats, instead of "similar listings" to their own. */}
          {isOwner ? (
            <ListingInsights listingId={listing.id} />
          ) : (
            <SimilarListings listingId={listing.id} />
          )}
        </View>
      </ScrollView>

      <ReportDialog
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        listingId={listing.id}
      />

      <View className="p-4 border-t border-hairline">
        {isOwner ? (
          <View>
            {listing.status === 'draft' && (
              <Pressable
                onPress={() => handleStatusChange('pending')}
                disabled={updateListing.isPending}
                className="flex-row items-center justify-center bg-primary rounded-full py-4"
              >
                <Text className="text-white font-semibold">Submit for Review</Text>
              </Pressable>
            )}
            {listing.status === 'pending' && (
              <View className="items-center py-3">
                <Text className="text-muted">Waiting for approval</Text>
              </View>
            )}
            {listing.status === 'rejected' && (
              <View>
                <Text className="text-destructive text-center text-sm mb-3">
                  This listing was rejected. Fix it with the edit button, then resubmit.
                </Text>
                <Pressable
                  onPress={() => handleStatusChange('pending')}
                  disabled={updateListing.isPending}
                  className="flex-row items-center justify-center bg-primary rounded-full py-4"
                >
                  <Text className="text-white font-semibold">Resubmit for Review</Text>
                </Pressable>
              </View>
            )}
            {listing.status === 'approved' && (
              <Pressable
                onPress={() => handleStatusChange('rented')}
                disabled={updateListing.isPending}
                className="flex-row items-center justify-center border border-hairline rounded-full py-4"
              >
                <Text className="text-ink font-semibold">Mark as Rented</Text>
              </Pressable>
            )}
            {listing.status === 'rented' && (
              <Pressable
                onPress={() => handleStatusChange('approved')}
                disabled={updateListing.isPending}
                className="flex-row items-center justify-center bg-primary rounded-full py-4"
              >
                <Text className="text-white font-semibold">Mark as Available</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View className="flex-row gap-3">
            <Pressable
              onPress={handleCall}
              className="flex-1 flex-row items-center justify-center border border-hairline rounded-full py-4"
            >
              <Phone size={18} color={colors.ink} />
              <Text className="text-ink font-semibold ml-2">Call</Text>
            </Pressable>
            <Pressable
              onPress={handleChat}
              className="flex-1 flex-row items-center justify-center bg-primary rounded-full py-4"
            >
              <MessageCircle size={18} color={colors['on-primary']} />
              <Text className="text-white font-semibold ml-2">Chat with Owner</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
