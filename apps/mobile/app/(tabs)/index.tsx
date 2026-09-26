import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Search, SlidersHorizontal } from 'lucide-react-native';
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
  const [sort, setSort] = useState<Sort>('newest');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [extra, setExtra] = useState<ExtraFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = countActiveFilters(extra);

  // One filter object for both List and Map — they must always show the same set.
  const filters: BrowseFilters = {
    propertyType,
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
  const visible = search.trim()
    ? listings.filter(
        (l) =>
          l.title.toLowerCase().includes(search.toLowerCase()) ||
          l.locality.toLowerCase().includes(search.toLowerCase()),
      )
    : listings;
  const q = search.trim().toLowerCase();
  const visiblePins = (pins ?? []).filter(
    (p) => !q || p.title.toLowerCase().includes(q) || p.locality.toLowerCase().includes(q),
  );

  return (
    <View className="flex-1 bg-surface">
      <View className="px-4 pt-14 pb-3 bg-white">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-2xl font-bold text-ink">Find your room</Text>
          {/* DESIGN.md `map-toggle` */}
          <View className="flex-row bg-surface rounded-full p-1" accessibilityRole="tablist">
            {(['list', 'map'] as const).map((v) => (
              <Pressable
                key={v}
                onPress={() => setView(v)}
                accessibilityRole="tab"
                accessibilityState={{ selected: view === v }}
                className={`rounded-full px-4 py-1.5 ${view === v ? 'bg-primary' : ''}`}
              >
                <Text
                  className={`text-sm font-semibold capitalize ${view === v ? 'text-white' : 'text-ink'}`}
                >
                  {v}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View className="flex-row items-center bg-surface rounded-full px-4 h-12">
          <Search size={18} color={colors.muted} />
          <TextInput
            className="flex-1 ml-2 text-ink"
            placeholder="Search by locality or title"
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
                className={`rounded-full px-4 py-2 ${active ? 'bg-primary' : 'bg-surface'}`}
              >
                <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-ink'}`}>
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
                className={`rounded-full px-3 py-2 ${active ? 'bg-ink' : 'bg-surface'}`}
              >
                <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-ink'}`}>
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
            <View className="items-center justify-center py-20 px-8">
              {activeFilterCount > 0 || propertyType || search.trim() ? (
                <>
                  <Text className="text-muted text-center mb-3">
                    No listings match your search and filters.
                  </Text>
                  <Pressable
                    onPress={() => {
                      setExtra(EMPTY_FILTERS);
                      setPropertyType(undefined);
                      setSearch('');
                    }}
                  >
                    <Text className="text-ink font-semibold underline">Clear everything</Text>
                  </Pressable>
                </>
              ) : (
                <Text className="text-muted text-center">
                  No listings yet in Guwahati.{'\n'}Check back soon.
                </Text>
              )}
            </View>
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
