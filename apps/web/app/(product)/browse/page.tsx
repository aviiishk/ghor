'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useBrowseListings, useMapPins } from '@/features/listings/hooks';
import { ListingCard } from '@/features/listings/components/ListingCard';
import type { BrowseFilters } from '@/features/listings/api';
import { SlidersHorizontal } from 'lucide-react';
import {
  EMPTY_FILTERS,
  FiltersDialog,
  countActiveFilters,
  type ExtraFilters,
} from '@/features/listings/components/FiltersDialog';

// Leaflet needs `window` — never render it on the server.
const ListingsMap = dynamic(() => import('@/features/listings/components/ListingsMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[70vh] min-h-[420px] rounded-2xl bg-surface animate-pulse" />
  ),
});

type Sort = NonNullable<BrowseFilters['sort']>;
// "Most viewed" (root CLAUDE.md §2's sort list) isn't here yet: it needs a view-count
// aggregate the feed can keyset-paginate on, which apps/api doesn't have.
const SORTS: { label: string; value: Sort }[] = [
  { label: 'Newest', value: 'newest' },
  { label: 'Price: low to high', value: 'price_asc' },
  { label: 'Price: high to low', value: 'price_desc' },
];

const PROPERTY_FILTERS: { label: string; value: 'room' | 'flat' | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Room', value: 'room' },
  { label: 'Flat', value: 'flat' },
];

// Resolves apps/web/CLAUDE.md's previously-open "grid vs. single-column" question: a
// responsive multi-column grid (1 col mobile width, 2 col tablet, 3 col desktop), not a
// constrained single column matching apps/mobile. Desktop width is the whole reason to
// build a web browse feed distinctly from the mobile one — a single column would waste
// it, and this is the standard desktop marketplace-grid pattern (Airbnb included).
export default function BrowsePage() {
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

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useBrowseListings({ ...filters, sort });

  // Fetched only once the Map tab is opened; same filters as the list, so both views
  // always show the same set.
  const { data: pins, isLoading: pinsLoading } = useMapPins(filters, view === 'map');

  const listings = data?.pages.flatMap((page) => page.items) ?? [];
  // Client-side filter over already-loaded pages — same limitation as apps/mobile's
  // browse feed (apps/api's BrowseListingsDto has no text-search param yet).
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold text-ink">Find your room</h1>
        {/* DESIGN.md `map-toggle`: two-option segmented control, filter-chip styling. */}
        <div role="tablist" aria-label="View" className="flex bg-surface rounded-full p-1">
          {(['list', 'map'] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${
                view === v ? 'bg-primary text-white' : 'text-ink'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by locality or title"
          className="w-full sm:flex-1 rounded-full border border-hairline bg-white px-5 h-12 shrink-0 text-ink outline-none focus:border-primary"
        />
        <div className="flex gap-2">
          {PROPERTY_FILTERS.map((filter) => {
            const active = propertyType === filter.value;
            return (
              <button
                key={filter.label}
                onClick={() => setPropertyType(filter.value)}
                className={`rounded-full px-4 h-12 text-sm font-semibold ${
                  active ? 'bg-primary text-white' : 'bg-white text-ink border border-hairline'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setFiltersOpen(true)}
          className={`flex items-center justify-center gap-2 rounded-full px-4 h-12 text-sm font-semibold shrink-0 border ${
            activeFilterCount
              ? 'border-ink bg-white text-ink'
              : 'border-hairline bg-white text-ink'
          }`}
        >
          <SlidersHorizontal size={16} />
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-ink text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Sort listings"
          className="rounded-full border border-hairline bg-white px-4 h-12 text-sm font-semibold text-ink"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {view === 'map' ? (
        pinsLoading ? (
          <div className="h-[70vh] min-h-[420px] rounded-2xl bg-surface animate-pulse" />
        ) : (
          <>
            <ListingsMap
              pins={visiblePins}
              activeId={activePinId}
              onSelect={setActivePinId}
            />
            <p className="text-muted text-xs mt-2">
              {visiblePins.length} on the map · locations are approximate
              {/* Only when there's evidence of un-geocoded listings: the list's first
                  page(s) already hold more than the map shows. */}
              {!q && listings.length > visiblePins.length &&
                ' · some listings couldn’t be placed on the map and appear in List view only'}
            </p>
          </>
        )
      ) : isLoading ? (
        <p className="text-muted text-center py-20">Loading listings…</p>
      ) : isError ? (
        <p className="text-muted text-center py-20">Couldn&apos;t load listings. Try refreshing.</p>
      ) : visible.length === 0 ? (
        activeFilterCount > 0 || propertyType || search.trim() ? (
          <div className="text-center py-20">
            <p className="text-muted mb-4">No listings match your search and filters.</p>
            <button
              onClick={() => {
                setExtra(EMPTY_FILTERS);
                setPropertyType(undefined);
                setSearch('');
              }}
              className="text-ink font-semibold underline"
            >
              Clear everything
            </button>
          </div>
        ) : (
          <p className="text-muted text-center py-20">
            No listings yet in Guwahati.
            <br />
            Check back soon.
          </p>
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {visible.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}

      {view === 'list' && hasNextPage && (
        <div className="flex justify-center mt-8">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="rounded-full border border-hairline bg-white px-6 py-3 text-sm font-semibold text-ink disabled:opacity-60"
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}

      <FiltersDialog
        open={filtersOpen}
        value={extra}
        onApply={setExtra}
        onClose={() => setFiltersOpen(false)}
      />
    </div>
  );
}
