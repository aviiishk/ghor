import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MapPin, Search, SearchX, SlidersHorizontal, Home } from 'lucide-react-native';
import { EmptyState } from '@/components/EmptyState';
import { useBrowseListings, useMapPins } from '@/features/listings/hooks';
import { ListingsMapView } from '@/features/listings/components/ListingsMapView';
import {
  EMPTY_FILTERS,
  FiltersSheet,
  countActiveFilters,
  type ExtraFilters,
} from '@/features/listings/components/FiltersSheet';
import { ListingCard } from '@/features/listings/components/ListingCard';
import { colors } from '@/lib/tokens';
import type { BrowseFilters } from '@/features/listings/api';

type Sort = NonNullable<BrowseFilters['sort']>;
// "Most viewed" isn't offered yet — needs a keyset-paginatable view-count in apps/api.
const SORTS: { label: string; value: Sort }[] = [
  { label: 'Newest', value: 'newest' },
  { label: 'Price ↑', value: 'price_asc' },
  { label: 'Price ↓', value: 'price_desc' },
];

const PROPERTY_FILTERS: { label: string; value: 'room' | 'flat' | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Room', value: 'room' },
  { label: 'Flat', value: 'flat' },
];

export default function HomeScreen() {
  const [propertyType, setPropertyType] = useState<'room' | 'flat' | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  // Server-side search (apps/api `q`), debounced — replaces the old client-side filter
  // that only ever searched pages already loaded on the phone.
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const [sort, setSort] = useState<Sort>('newest');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [extra, setExtra] = useState<ExtraFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = countActiveFilters(extra);

  // One filter object for both List and Map — they must always show the same set.
  const filters: BrowseFilters = {
    propertyType,
    q: q || undefined,
    rentMin: extra.rentMin,
    rentMax: extra.rentMax,
    amenities: extra.amenities.length ? extra.amenities.join(',') : undefined,
    institutionIds: extra.institutionIds.length ? extra.institutionIds.join(',') : undefined,
  };

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useBrowseListings({ ...filters, sort });

  // Fetched only once Map is opened; same filters as the list.
  const { data: pins, isLoading: pinsLoading } = useMapPins(filters, view === 'map');

  const listings = data?.pages.flatMap((page) => page.items) ?? [];
  // Client-side filter over already-loaded pages — not a real server-side search yet
  // (apps/api's BrowseListingsDto has no text-search param), see apps/mobile/STATUS.md.
  const visible = listings;
  const visiblePins = pins ?? [];

  return (
    <View className="flex-1 bg-cream">
      <View className="bg-navy px-4 pb-4 pt-14">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-1 pr-3">
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <MapPin size={13} color="rgba(255,255,255,0.7)" />
              <Text className="text-xs font-semibold text-white/70">Guwahati</Text>
            </View>
            <Text className="mt-1 text-2xl font-bold text-white">Where do you want to live?</Text>
          </View>
          {/* DESIGN.md `map-toggle` */}
          <View className="flex-row rounded-full p-1" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} accessibilityRole="tablist">
            {(['list', 'map'] as const).map((v) => (
              <Pressable
                key={v}
                onPress={() => setView(v)}
                accessibilityRole="tab"
                accessibilityState={{ selected: view === v }}
                className={`rounded-full px-4 py-1.5 ${view === v ? 'bg-primary' : ''}`}
              >
                <Text
                  className={`text-sm font-semibold capitalize ${view === v ? 'text-white' : 'text-white/80'}`}
                >
                  {v}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View className="h-12 flex-row items-center rounded-full bg-white px-4">
          <Search size={18} color={colors.muted} />
          <TextInput
            className="flex-1 ml-2 text-ink"
            placeholder="Search locality, landmark or title"
            placeholderTextColor={colors['muted-soft']}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        {/* Horizontally scrollable: 3 type chips + 3 sort chips don't fit a 360px phone. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-3 -mx-4"
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
        >
          <Pressable
            onPress={() => setFiltersOpen(true)}
            accessibilityLabel={`Filters${activeFilterCount ? `, ${activeFilterCount} active` : ''}`}
            className={`flex-row items-center rounded-full px-3 py-2 ${
              activeFilterCount ? 'bg-ink' : 'bg-surface'
            }`}
          >
            <SlidersHorizontal size={14} color={activeFilterCount ? '#FFFFFF' : colors.ink} />
            <Text
              className={`text-sm font-semibold ml-1.5 ${activeFilterCount ? 'text-white' : 'text-ink'}`}
            >
              Filters{activeFilterCount ? ` · ${activeFilterCount}` : ''}
            </Text>
          </Pressable>
          {PROPERTY_FILTERS.map((filter) => {
            const active = propertyType === filter.value;
            return (
              <Pressable
                key={filter.label}
                onPress={() => setPropertyType(filter.value)}
                className={`rounded-full px-4 py-2 ${active ? 'bg-primary' : 'bg-white/10'}`}
              >
                <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-white/85'}`}>
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
          {view === 'list' && <View className="w-px bg-hairline mx-1" />}
          {view === 'list' && SORTS.map((s) => {
            const active = sort === s.value;
            return (
              <Pressable
                key={s.value}
                onPress={() => setSort(s.value)}
                accessibilityLabel={`Sort by ${s.value.replace('_', ' ')}`}
                className={`rounded-full px-3 py-2 ${active ? 'bg-primary' : 'bg-white/10'}`}
              >
                <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-white/85'}`}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {view === 'map' ? (
        pinsLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <ListingsMapView
            pins={visiblePins}
            activeId={activePinId}
            onSelect={setActivePinId}
          />
        )
      ) : isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-muted text-center">
            Couldn't load listings. Pull down to try again.
          </Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ListingCard listing={item} />}
          contentContainerClassName="px-4 pt-4 pb-8"
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.4}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={
            activeFilterCount > 0 || propertyType || search.trim() ? (
              <EmptyState
                icon={SearchX}
                title="No homes match that yet"
                body="Try a wider budget, fewer amenities, or a nearby area. New listings are reviewed and added every day."
                actionLabel="Clear filters"
                onAction={() => {
                  setExtra(EMPTY_FILTERS);
                  setPropertyType(undefined);
                  setSearch('');
                }}
              />
            ) : (
              <EmptyState
                icon={Home}
                title="No homes here yet"
                body="GHOR is onboarding owners across Guwahati. Every listing is checked by GHOR before it appears, so check back soon."
              />
            )
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
            ) : null
          }
        />
      )}

      <FiltersSheet
        visible={filtersOpen}
        value={extra}
        onApply={setExtra}
        onClose={() => setFiltersOpen(false)}
      />
    </View>
  );
}
