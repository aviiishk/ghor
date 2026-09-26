'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  ArrowUpDown,
  Car,
  Home,
  Building2,
  IndianRupee,
  LayoutGrid,
  Map as MapIcon,
  MapPin,
  Search,
  SearchX,
  SlidersHorizontal,
  Sofa,
  Wifi,
  X,
} from 'lucide-react';
import { useBrowseListings, useMapPins, usePopularLocalities } from '@/features/listings/hooks';
import { ListingCard } from '@/features/listings/components/ListingCard';
import type { BrowseFilters } from '@/features/listings/api';
import {
  EMPTY_FILTERS,
  FiltersDialog,
  countActiveFilters,
  type ExtraFilters,
} from '@/features/listings/components/FiltersDialog';
import { Chip, EmptyState, SectionHeader, SkeletonListingCard, formatRent } from '@/components/ui';

// Leaflet needs `window` — never render it on the server.
const ListingsMap = dynamic(() => import('@/features/listings/components/ListingsMap'), {
  ssr: false,
  loading: () => <div className="skeleton h-[70vh] min-h-[420px] rounded-3xl" />,
});

type Sort = NonNullable<BrowseFilters['sort']>;
const SORTS: { label: string; value: Sort }[] = [
  { label: 'Newest first', value: 'newest' },
  { label: 'Price: low to high', value: 'price_asc' },
  { label: 'Price: high to low', value: 'price_desc' },
];
const BUDGET = 7000;

// Browse, redesign 2026-09-26. Discovery sections (popular areas, recently added, under
// budget) show only when nothing is filtered, and each is backed by a real query — they
// disappear rather than show placeholder content when there's no data behind them.
export default function BrowsePage() {
  const [propertyType, setPropertyType] = useState<'room' | 'flat' | undefined>(undefined);
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [locality, setLocality] = useState<string | undefined>(undefined);
  const [sort, setSort] = useState<Sort>('newest');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [extra, setExtra] = useState<ExtraFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Debounce typing into a server-side search.
  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filters: BrowseFilters = useMemo(
    () => ({
      propertyType,
      q: q || undefined,
      locality,
      rentMin: extra.rentMin,
      rentMax: extra.rentMax,
      amenities: extra.amenities.length ? extra.amenities.join(',') : undefined,
      institutionIds: extra.institutionIds.length ? extra.institutionIds.join(',') : undefined,
    }),
    [propertyType, q, locality, extra],
  );

  const isFiltered =
    !!propertyType || !!q || !!locality || countActiveFilters(extra) > 0 || sort !== 'newest';

  const feed = useBrowseListings({ ...filters, sort });
  const underBudget = useBrowseListings({ rentMax: BUDGET, sort: 'price_asc' });
  const { data: localities } = usePopularLocalities();
  const { data: pins, isLoading: pinsLoading } = useMapPins(filters, view === 'map');

  const listings = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const budgetListings = (underBudget.data?.pages[0]?.items ?? []).slice(0, 8);

  // Quick chips are shortcuts into the same state the Filters dialog edits.
  const budgetOn = extra.rentMax === BUDGET && extra.rentMin == null;
  const toggleAmenity = (key: string) =>
    setExtra((e) => ({
      ...e,
      amenities: e.amenities.includes(key) ? e.amenities.filter((a) => a !== key) : [...e.amenities, key],
    }));
  const clearAll = () => {
    setPropertyType(undefined);
    setSearchInput('');
    setQ('');
    setLocality(undefined);
    setExtra(EMPTY_FILTERS);
    setSort('newest');
  };
  const activeCount = countActiveFilters(extra);

  return (
    <div className="bg-cream pb-20">
      {/* ------------------------------------------------------------ Search header */}
      <section className="relative overflow-hidden bg-navy px-4 pb-10 pt-10 text-white sm:px-6 sm:pb-12 sm:pt-14">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary/40 blur-3xl" />
        <div className="relative mx-auto max-w-6xl">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-white/70">
            <MapPin size={15} aria-hidden /> Guwahati
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-5xl">Where do you want to live?</h1>
          <p className="mt-2 max-w-xl text-white/70">Verified rooms and flats, straight from the owner. No brokerage.</p>

          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              setQ(searchInput.trim());
            }}
            className="mt-6 flex h-14 items-center gap-2 rounded-full bg-white pl-5 pr-2 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.5)] sm:h-16"
          >
            <Search size={20} className="shrink-0 text-muted" aria-hidden />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search locality, landmark or title"
              aria-label="Search listings"
              className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-muted-soft outline-none"
            />
            {searchInput && (
              <button type="button" onClick={() => setSearchInput('')} aria-label="Clear search" className="rounded-full p-2 text-muted hover:bg-surface">
                <X size={18} />
              </button>
            )}
            <button type="submit" className="press h-10 shrink-0 rounded-full bg-primary px-5 text-sm font-bold text-white hover:bg-primary-pressed sm:h-12 sm:px-7">
              Search
            </button>
          </form>
        </div>
      </section>

      {/* ------------------------------------------------------------ Filter bar (sticky) */}
      <div className="sticky top-16 z-30 border-b border-navy/[0.06] bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] sm:px-6">
          <Chip icon={SlidersHorizontal} active={activeCount > 0} onClick={() => setFiltersOpen(true)}>
            Filters{activeCount > 0 ? ` · ${activeCount}` : ''}
          </Chip>
          <span className="h-6 w-px shrink-0 bg-navy/10" aria-hidden />
          <Chip icon={Home} active={propertyType === 'room'} onClick={() => setPropertyType(propertyType === 'room' ? undefined : 'room')}>Rooms</Chip>
          <Chip icon={Building2} active={propertyType === 'flat'} onClick={() => setPropertyType(propertyType === 'flat' ? undefined : 'flat')}>Flats</Chip>
          <Chip
            icon={IndianRupee}
            active={budgetOn}
            onClick={() => setExtra((e) => (budgetOn ? { ...e, rentMax: undefined } : { ...e, rentMin: undefined, rentMax: BUDGET }))}
          >
            Under ₹7k
          </Chip>
          <Chip icon={Sofa} active={extra.amenities.includes('furnished')} onClick={() => toggleAmenity('furnished')}>Furnished</Chip>
          <Chip icon={Wifi} active={extra.amenities.includes('wifi')} onClick={() => toggleAmenity('wifi')}>Wi-Fi</Chip>
          <Chip icon={Car} active={extra.amenities.includes('parking')} onClick={() => toggleAmenity('parking')}>Parking</Chip>

          <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
            {view === 'list' && (
              <label className="relative inline-flex h-10 items-center rounded-full border border-hairline bg-white pl-3 pr-2">
                <ArrowUpDown size={15} className="text-muted" aria-hidden />
                <span className="sr-only">Sort</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-full appearance-none bg-transparent pl-2 pr-1 text-sm font-semibold text-ink outline-none">
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </label>
            )}
            {/* DESIGN.md `map-toggle` */}
            <div role="tablist" aria-label="View" className="flex rounded-full border border-hairline bg-white p-1">
              {([['list', LayoutGrid], ['map', MapIcon]] as const).map(([v, Icon]) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold capitalize transition-colors ${view === v ? 'bg-navy text-white' : 'text-ink'}`}
                >
                  <Icon size={15} aria-hidden /> <span className="hidden sm:inline">{v}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Active search / area context */}
        {(q || locality || isFiltered) && (
          <div className="flex flex-wrap items-center gap-2 pt-6 text-sm">
            {q && <span className="rounded-full bg-white px-3 py-1.5 font-semibold text-ink ring-1 ring-hairline">&ldquo;{q}&rdquo;</span>}
            {locality && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 font-semibold text-ink ring-1 ring-hairline">
                <MapPin size={14} aria-hidden /> {locality}
                <button onClick={() => setLocality(undefined)} aria-label={`Remove ${locality}`} className="ml-0.5 text-muted hover:text-ink"><X size={14} /></button>
              </span>
            )}
            {isFiltered && (
              <button onClick={clearAll} className="font-semibold text-primary hover:underline">Clear all</button>
            )}
          </div>
        )}

        {view === 'map' ? (
          <div className="pt-6">
            {pinsLoading ? (
              <div className="skeleton h-[70vh] min-h-[420px] rounded-3xl" />
            ) : (
              <>
                <ListingsMap pins={pins ?? []} activeId={activePinId} onSelect={setActivePinId} />
                <p className="mt-2 text-xs text-muted">
                  {(pins ?? []).length} on the map · locations are approximate
                  {!q && listings.length > (pins ?? []).length && ' · some listings couldn’t be placed and appear in List view only'}
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* ------------------------------------------------ Discovery sections */}
            {!isFiltered && !!localities?.length && (
              <section className="pt-10">
                <SectionHeader title="Popular areas" subtitle="Where owners are listing right now" />
                <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
                  {localities.map((a) => (
                    <button
                      key={a.locality}
                      onClick={() => setLocality(a.locality)}
                      className="press group flex shrink-0 items-center gap-3 rounded-2xl bg-white p-3 pr-5 text-left ring-1 ring-navy/[0.06] hover:ring-primary/40"
                    >
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-primary">
                        <MapPin size={20} aria-hidden />
                      </span>
                      <span>
                        <span className="block font-display font-bold text-ink">{a.locality}</span>
                        <span className="block text-xs text-muted">
                          {a.count} {a.count === 1 ? 'home' : 'homes'} · from {formatRent(a.minRent)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {!isFiltered && listings.length > 3 && (
              <section className="pt-10">
                <SectionHeader title="Recently added" subtitle="Fresh listings, reviewed by GHOR" />
                <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6">
                  {listings.slice(0, 8).map((l, i) => (
                    <ListingCard key={l.id} listing={l} variant="rail" priority={i < 2} />
                  ))}
                </div>
              </section>
            )}

            {!isFiltered && budgetListings.length > 1 && (
              <section className="pt-10">
                <SectionHeader
                  title={`Under ${formatRent(BUDGET)}`}
                  subtitle="Budget-friendly picks, cheapest first"
                  action={{ label: 'See all', onClick: () => setExtra((e) => ({ ...e, rentMin: undefined, rentMax: BUDGET })) }}
                />
                <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6">
                  {budgetListings.map((l) => (
                    <ListingCard key={l.id} listing={l} variant="rail" />
                  ))}
                </div>
              </section>
            )}

            {/* ------------------------------------------------ Results grid */}
            <section className="pt-10">
              <SectionHeader
                title={isFiltered ? 'Matching homes' : 'All homes'}
                subtitle={
                  feed.isLoading
                    ? 'Loading…'
                    : `${listings.length}${feed.hasNextPage ? '+' : ''} ${listings.length === 1 ? 'listing' : 'listings'} in Guwahati`
                }
              />

              {feed.isLoading ? (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }, (_, i) => <SkeletonListingCard key={i} />)}
                </div>
              ) : feed.isError ? (
                <EmptyState icon={SearchX} title="We couldn’t load listings" body="Check your connection and try again." action={{ label: 'Try again', onClick: () => feed.refetch() }} />
              ) : listings.length === 0 ? (
                isFiltered ? (
                  <EmptyState
                    icon={SearchX}
                    title="No homes match that yet"
                    body="Try a wider budget, fewer amenities, or a nearby area. New listings are reviewed and added every day."
                    action={{ label: 'Clear filters', onClick: clearAll }}
                  />
                ) : (
                  <EmptyState
                    icon={Home}
                    title="No homes here yet"
                    body="GHOR is onboarding owners across Guwahati. Every listing is reviewed before it appears, so check back soon."
                  />
                )
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {listings.map((l, i) => (
                    <ListingCard key={l.id} listing={l} priority={isFiltered && i < 3} />
                  ))}
                </div>
              )}

              {feed.hasNextPage && (
                <div className="mt-10 flex justify-center">
                  <button
                    onClick={() => feed.fetchNextPage()}
                    disabled={feed.isFetchingNextPage}
                    className="press rounded-full bg-navy px-7 py-3 text-sm font-bold text-white hover:bg-navy-soft disabled:opacity-60"
                  >
                    {feed.isFetchingNextPage ? 'Loading…' : 'Show more homes'}
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <FiltersDialog open={filtersOpen} value={extra} onApply={setExtra} onClose={() => setFiltersOpen(false)} />
    </div>
  );
}
