'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import {
  ArrowUpDown,
  Bath,
  Car,
  IndianRupee,
  LayoutGrid,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  SearchX,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sofa,
  Wifi,
  X,
} from 'lucide-react';
import { useBrowseListings, useMapPins, usePopularLocalities } from '@/features/listings/hooks';
import { ListingCard } from '@/features/listings/components/ListingCard';
import { SearchBox } from '@/features/listings/components/SearchBox';
import type { BrowseFilters, Listing, MapPin as MapPinData, PopularLocality } from '@/features/listings/api';
import { amenityLabel } from '@/features/listings/amenities';
import { useProfile } from '@/features/auth/hooks';
import {
  EMPTY_FILTERS,
  FiltersDialog,
  countActiveFilters,
  type ExtraFilters,
} from '@/features/listings/components/FiltersDialog';
import { ButtonLink, Chip, EmptyState, SectionHeader, SkeletonListingCard, buttonClass, cx, formatRent } from '@/components/ui';

// Leaflet needs `window` — never render it on the server.
const ListingsMap = dynamic(() => import('@/features/listings/components/ListingsMap'), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full rounded-2xl" />,
});

type Sort = NonNullable<BrowseFilters['sort']>;
const SORTS: { label: string; value: Sort }[] = [
  { label: 'Newest first', value: 'newest' },
  { label: 'Rent: low to high', value: 'price_asc' },
  { label: 'Rent: high to low', value: 'price_desc' },
];
const BUDGET = 7000;
const GRID = 'grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

// Browse, redesign v2 (2026-09-27). Search leads; filters are one sticky row; results are
// image-first inventory. Discovery rails (popular areas, recently added, under budget)
// show only when nothing is filtered, and only when real data backs them.
export default function BrowsePage() {
  const { data: profile } = useProfile();
  const [propertyType, setPropertyType] = useState<'room' | 'flat' | undefined>(undefined);
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [locality, setLocality] = useState<string | undefined>(undefined);
  const [sort, setSort] = useState<Sort>('newest');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [extra, setExtra] = useState<ExtraFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filters live in the URL so refresh, back/forward and shared links keep the search
  // (e.g. /browse?locality=Beltola from the landing page's locality links).
  const [urlReady, setUrlReady] = useState(false);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const num = (k: string) => {
      const n = Number(sp.get(k));
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };
    const t = sp.get('type');
    if (t === 'room' || t === 'flat') setPropertyType(t);
    if (sp.get('q')) {
      setSearchInput(sp.get('q')!);
      setQ(sp.get('q')!);
    }
    if (sp.get('locality')) setLocality(sp.get('locality')!);
    const s = sp.get('sort');
    if (s === 'price_asc' || s === 'price_desc') setSort(s);
    if (sp.get('view') === 'map') setView('map');
    const amen = sp.get('amenities');
    if (amen || num('rentMin') || num('rentMax')) {
      setExtra({ ...EMPTY_FILTERS, rentMin: num('rentMin'), rentMax: num('rentMax'), amenities: amen ? amen.split(',').filter(Boolean) : [] });
    }
    setUrlReady(true);
  }, []);

  // Debounce typing into a server-side search.
  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput.trim()), 350);
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

  const activeCount = countActiveFilters(extra);

  useEffect(() => {
    if (!urlReady) return;
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (locality) sp.set('locality', locality);
    if (propertyType) sp.set('type', propertyType);
    if (sort !== 'newest') sp.set('sort', sort);
    if (view === 'map') sp.set('view', 'map');
    if (extra.rentMin != null) sp.set('rentMin', String(extra.rentMin));
    if (extra.rentMax != null) sp.set('rentMax', String(extra.rentMax));
    if (extra.amenities.length) sp.set('amenities', extra.amenities.join(','));
    const next = sp.toString() ? `?${sp}` : window.location.pathname;
    if (next !== window.location.search && !(next === window.location.pathname && !window.location.search)) {
      window.history.replaceState(window.history.state, '', next);
    }
  }, [urlReady, q, locality, propertyType, sort, view, extra]);
  const isFiltered = !!propertyType || !!q || !!locality || activeCount > 0 || sort !== 'newest';

  // Queries wait for the URL to be read, so a shared/refreshed filtered link doesn't first
  // fetch the unfiltered feed and budget rail it is about to discard.
  const feed = useBrowseListings({ ...filters, sort }, urlReady);
  // Only the unfiltered discovery view shows this rail.
  const underBudget = useBrowseListings({ rentMax: BUDGET, sort: 'price_asc' }, urlReady && !isFiltered);
  const { data: localities } = usePopularLocalities();
  const { data: pins, isLoading: pinsLoading } = useMapPins(filters, urlReady && view === 'map');

  const listings = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const budgetListings = (underBudget.data?.pages[0]?.items ?? []).slice(0, 10);

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
  const pickLocality = (name: string) => {
    setSearchInput('');
    setQ('');
    setLocality(name);
  };

  // Every active filter as a removable token, so what's applied is never a mystery.
  const tokens: { key: string; label: string; remove: () => void }[] = [
    ...(q ? [{ key: 'q', label: `“${q}”`, remove: () => { setSearchInput(''); setQ(''); } }] : []),
    ...(locality ? [{ key: 'loc', label: locality, remove: () => setLocality(undefined) }] : []),
    ...(propertyType ? [{ key: 'type', label: propertyType === 'room' ? 'Rooms' : 'Flats', remove: () => setPropertyType(undefined) }] : []),
    ...(extra.rentMin != null || extra.rentMax != null
      ? [{
          key: 'rent',
          label:
            extra.rentMin != null && extra.rentMax != null
              ? `${formatRent(extra.rentMin)}–${formatRent(extra.rentMax)}`
              : extra.rentMax != null
                ? `Under ${formatRent(extra.rentMax)}`
                : `${formatRent(extra.rentMin!)}+`,
          remove: () => setExtra((e) => ({ ...e, rentMin: undefined, rentMax: undefined })),
        }]
      : []),
    ...extra.amenities.map((a) => ({ key: `a-${a}`, label: amenityLabel(a), remove: () => toggleAmenity(a) })),
    ...(extra.institutionIds.length
      ? [{ key: 'inst', label: `Near ${extra.institutionIds.length} place${extra.institutionIds.length === 1 ? '' : 's'}`, remove: () => setExtra((e) => ({ ...e, institutionIds: [] })) }]
      : []),
  ];

  const countLabel = !urlReady || feed.isLoading
    ? 'Finding homes…'
    : feed.isError
      ? 'Homes in Guwahati'
    : `${listings.length}${feed.hasNextPage ? '+' : ''} ${listings.length === 1 ? 'home' : 'homes'}${locality ? ` in ${locality}` : ' in Guwahati'}`;

  return (
    <div className="bg-cream pb-16">
      {/* ------------------------------------------------------------ Search header */}
      <section className="pb-6 pt-6 sm:pb-8 sm:pt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
            <MapPin size={15} aria-hidden /> Guwahati · rooms and flats, direct from owners
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-[clamp(2.25rem,5vw,3.75rem)] font-bold leading-[1] tracking-[-0.035em] text-navy">
            Where do you want to live?
          </h1>
          <div className="mt-5 max-w-3xl sm:mt-7">
            <SearchBox
              value={searchInput}
              onChange={setSearchInput}
              onSubmit={setQ}
              onPickLocality={pickLocality}
              popular={localities}
            />
          </div>
          <ul className="no-scrollbar -mx-4 mt-4 flex gap-x-5 overflow-x-auto whitespace-nowrap px-4 text-[13px] font-medium text-body sm:mx-0 sm:mt-5 sm:flex-wrap sm:gap-y-2 sm:px-0 sm:text-sm">
            <li className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-success-deep" aria-hidden /> Every listing reviewed by GHOR</li>
            <li className="inline-flex items-center gap-2"><IndianRupee size={16} className="text-primary" aria-hidden /> No brokerage, no viewing fee</li>
            <li className="inline-flex items-center gap-2"><MessageCircle size={16} className="text-primary" aria-hidden /> Chat with the owner directly</li>
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------ Filter bar (sticky) */}
      <div className="sticky top-16 z-30 border-y border-navy/[0.07] bg-cream/90 backdrop-blur-md">
        <div className="no-scrollbar mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
          <button
            onClick={() => setFiltersOpen(true)}
            className={cx(
              'press inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold ring-1 ring-inset transition-colors',
              activeCount ? 'bg-navy text-white ring-navy' : 'bg-white text-ink ring-hairline hover:ring-ink/30',
            )}
          >
            <SlidersHorizontal size={16} aria-hidden /> Filters
            {activeCount > 0 && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs text-navy">{activeCount}</span>}
          </button>

          <div role="radiogroup" aria-label="Property type" className="flex shrink-0 rounded-full bg-white p-1 ring-1 ring-inset ring-hairline">
            {([[undefined, 'All'], ['room', 'Rooms'], ['flat', 'Flats']] as const).map(([v, label]) => (
              <button
                key={label}
                role="radio"
                aria-checked={propertyType === v}
                onClick={() => setPropertyType(v)}
                className={cx('h-8 rounded-full px-3.5 text-sm font-semibold transition-colors', propertyType === v ? 'bg-navy text-white' : 'text-body hover:text-ink')}
              >
                {label}
              </button>
            ))}
          </div>

          <span className="mx-1 h-6 w-px shrink-0 bg-navy/10" aria-hidden />
          <Chip icon={IndianRupee} active={budgetOn} onClick={() => setExtra((e) => (budgetOn ? { ...e, rentMax: undefined } : { ...e, rentMin: undefined, rentMax: BUDGET }))}>
            Under ₹7k
          </Chip>
          <Chip icon={Sofa} active={extra.amenities.includes('furnished')} onClick={() => toggleAmenity('furnished')}>Furnished</Chip>
          <Chip icon={Bath} active={extra.amenities.includes('attached_bath')} onClick={() => toggleAmenity('attached_bath')}>Attached bath</Chip>
          <Chip icon={Wifi} active={extra.amenities.includes('wifi')} onClick={() => toggleAmenity('wifi')}>Wi-Fi</Chip>
          <Chip icon={Car} active={extra.amenities.includes('parking')} onClick={() => toggleAmenity('parking')}>Parking</Chip>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Results header: count, applied filters, sort, list/map */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="mr-1 font-display text-lg font-bold text-navy" aria-live="polite">{countLabel}</p>
            {tokens.map((t) => (
              <span key={t.key} className="inline-flex h-8 items-center gap-1 rounded-full bg-white pl-3 pr-1 text-sm font-semibold text-ink ring-1 ring-inset ring-navy/10">
                {t.label}
                <button onClick={t.remove} aria-label={`Remove ${t.label}`} className="rounded-full p-1 text-muted hover:bg-cream hover:text-ink">
                  <X size={14} />
                </button>
              </span>
            ))}
            {tokens.length > 1 && (
              <button onClick={clearAll} className="px-1 text-sm font-semibold text-primary hover:underline">Clear all</button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {view === 'list' && (
              <label className="relative inline-flex h-10 items-center rounded-full bg-white pl-3.5 pr-2 ring-1 ring-inset ring-hairline focus-within:ring-2 focus-within:ring-primary">
                <ArrowUpDown size={15} className="text-muted" aria-hidden />
                <span className="sr-only">Sort</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-full cursor-pointer appearance-none bg-transparent pl-2 pr-1 text-sm font-semibold text-ink outline-none">
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </label>
            )}
            {/* DESIGN.md `map-toggle` */}
            <div role="tablist" aria-label="View" className="flex rounded-full bg-white p-1 ring-1 ring-inset ring-hairline">
              {([['list', LayoutGrid, 'List'], ['map', MapIcon, 'Map']] as const).map(([v, Icon, label]) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={cx('inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors', view === v ? 'bg-navy text-white' : 'text-ink')}
                >
                  <Icon size={15} aria-hidden /> {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {view === 'map' ? (
          <MapSplit
            listings={listings}
            loading={!urlReady || feed.isLoading || pinsLoading}
            pins={pins ?? []}
            activePinId={activePinId}
            setActivePinId={setActivePinId}
            hoverId={hoverId}
            setHoverId={setHoverId}
            q={q}
          />
        ) : (
          <>
            {/* ------------------------------------------------ Discovery (unfiltered only) */}
            {!isFiltered && !!localities?.length && (
              <section className="pt-10">
                <SectionHeader title="Popular areas" subtitle="Where owners are listing right now" />
                <LocalityRail localities={localities} onPick={pickLocality} />
              </section>
            )}

            {!isFiltered && listings.length > 4 && (
              <section className="pt-12">
                <SectionHeader title="Just listed" subtitle="Fresh homes, each reviewed by GHOR" />
                <div className="no-scrollbar -mx-4 flex snap-x gap-5 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
                  {listings.slice(0, 8).map((l, i) => (
                    <ListingCard key={l.id} listing={l} variant="rail" priority={i < 2} />
                  ))}
                </div>
              </section>
            )}

            {!isFiltered && budgetListings.length > 2 && (
              <section className="pt-12">
                <SectionHeader
                  title={`Under ${formatRent(BUDGET)} a month`}
                  subtitle="Budget-friendly homes, cheapest first"
                  action={{ label: 'See all', onClick: () => setExtra((e) => ({ ...e, rentMin: undefined, rentMax: BUDGET })) }}
                />
                <div className="no-scrollbar -mx-4 flex snap-x gap-5 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
                  {budgetListings.map((l) => (
                    <ListingCard key={l.id} listing={l} variant="rail" />
                  ))}
                </div>
              </section>
            )}

            {/* ------------------------------------------------ Results grid */}
            <section className={isFiltered ? 'pt-8' : 'pt-12'}>
              {!isFiltered && listings.length > 0 && <SectionHeader title="All homes in Guwahati" />}

              {!urlReady || feed.isLoading ? (
                <div className={GRID}>
                  {Array.from({ length: 8 }, (_, i) => <SkeletonListingCard key={i} />)}
                </div>
              ) : feed.isError ? (
                <EmptyState icon={SearchX} title="We couldn’t load homes" body="Check your connection and try again." action={{ label: 'Try again', onClick: () => feed.refetch() }} />
              ) : listings.length === 0 ? (
                isFiltered ? (
                  <FilteredEmpty localities={localities} onPick={pickLocality} onClear={clearAll} />
                ) : (
                  <InventoryEmpty isOwner={profile?.role === 'owner'} />
                )
              ) : (
                <div className={GRID}>
                  {listings.map((l, i) => (
                    <ListingCard key={l.id} listing={l} priority={i < 4} />
                  ))}
                </div>
              )}

              {feed.hasNextPage && (
                <div className="mt-12 flex justify-center">
                  <button onClick={() => feed.fetchNextPage()} disabled={feed.isFetchingNextPage} className={buttonClass('navy', 'lg')}>
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

// ---------------------------------------------------------------------------------------

const TILE_TONES = ['bg-navy text-white', 'bg-primary text-white', 'bg-cream-deep text-navy', 'bg-white text-navy ring-1 ring-inset ring-navy/10'];

function LocalityRail({ localities, onPick }: { localities: PopularLocality[]; onPick: (l: string) => void }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {localities.map((a, i) => (
        <button
          key={a.locality}
          onClick={() => onPick(a.locality)}
          className={cx('press group flex h-36 w-52 shrink-0 snap-start flex-col justify-between rounded-2xl p-5 text-left transition-transform hover:-translate-y-0.5', TILE_TONES[i % TILE_TONES.length])}
        >
          <MapPin size={20} className="shrink-0 opacity-70" aria-hidden />
          <span className="min-w-0">
            {/* Localities are free text — clamp long ones so the count line stays visible. */}
            <span className="line-clamp-2 break-words font-display text-2xl font-bold leading-tight tracking-tight" title={a.locality}>
              {a.locality}
            </span>
            <span className="mt-1 block text-sm opacity-75">
              {a.count} {a.count === 1 ? 'home' : 'homes'} · from {formatRent(a.minRent)}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

function MapSplit({
  listings,
  loading,
  pins,
  activePinId,
  setActivePinId,
  hoverId,
  setHoverId,
  q,
}: {
  listings: Listing[];
  loading: boolean;
  pins: MapPinData[];
  activePinId: string | null;
  setActivePinId: (id: string | null) => void;
  hoverId: string | null;
  setHoverId: (id: string | null) => void;
  q: string;
}) {
  const unplaced = listings.filter((l) => !pins.some((p) => p.id === l.id)).length;
  return (
    <div className="grid grid-cols-1 gap-6 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Map first on phones, right-hand and sticky on desktop */}
      <div className="lg:order-2">
        <div className="lg:sticky lg:top-[8.5rem]">
          {loading ? (
            <div className="skeleton h-[60vh] rounded-2xl lg:h-[calc(100vh-10rem)]" />
          ) : (
            <ListingsMap
              pins={pins}
              activeId={activePinId}
              onSelect={setActivePinId}
              highlightId={hoverId}
              className="h-[60vh] min-h-[380px] rounded-2xl lg:h-[calc(100vh-10rem)]"
            />
          )}
          <p className="mt-2 text-xs text-muted">
            {pins.length} on the map · areas are approximate, never exact addresses
            {!q && unplaced > 0 && ` · ${unplaced} couldn’t be placed and appear in the list only`}
          </p>
        </div>
      </div>
      <div className="lg:order-1">
        {loading ? (
          <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => <SkeletonListingCard key={i} />)}
          </div>
        ) : listings.length === 0 ? (
          <EmptyState compact icon={MapIcon} title="Nothing on the map yet" body="Homes appear here once they’re live. Try List view or widen your filters." />
        ) : (
          <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} onHover={setHoverId} highlighted={activePinId === l.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilteredEmpty({ localities, onPick, onClear }: { localities?: PopularLocality[]; onPick: (l: string) => void; onClear: () => void }) {
  return (
    <div className="surface flex flex-col items-center px-6 py-14 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-cream-deep text-navy">
        <SearchX size={26} aria-hidden />
      </span>
      <h2 className="mt-5 font-display text-2xl font-bold tracking-tight text-navy">No homes match that yet</h2>
      <p className="mt-2 max-w-md text-muted">Try a wider budget, fewer amenities or a nearby area. New homes are reviewed and added as owners join.</p>
      <button onClick={onClear} className={cx(buttonClass('navy'), 'mt-6')}>Clear filters</button>
      {!!localities?.length && (
        <div className="mt-8">
          <p className="text-sm font-semibold text-muted">Areas with homes right now</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {localities.slice(0, 6).map((l) => (
              <button key={l.locality} onClick={() => onPick(l.locality)} className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-cream px-4 text-sm font-semibold text-navy ring-1 ring-inset ring-navy/10 hover:bg-cream-deep">
                <MapPin size={14} aria-hidden /> {l.locality} <span className="text-muted">· {l.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Zero live inventory is a real launch state, not an error: say what's happening, show
// what GHOR will look like (illustrative photos, labelled as such), give a next step.
function InventoryEmpty({ isOwner }: { isOwner: boolean }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = `${window.location.origin}/`;
    const text = 'GHOR — rooms and flats in Guwahati, directly from owners. No brokerage.';
    try {
      if (navigator.share) await navigator.share({ title: 'GHOR', text, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // share sheet dismissed
    }
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-navy text-white">
      <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="p-7 sm:p-10 lg:p-14">
          <p className="text-sm font-semibold text-primary-tint">Opening in Guwahati</p>
          <h2 className="mt-3 font-display text-[clamp(1.9rem,3.6vw,3rem)] font-bold leading-[1.05] tracking-[-0.03em]">
            The first homes are being checked right now.
          </h2>
          <p className="mt-4 max-w-lg text-lg leading-8 text-white/75">
            GHOR is onboarding owners across the city. Every listing is reviewed by a person before it appears here, so the feed fills up carefully rather than quickly.
          </p>
          <ul className="mt-7 space-y-3 text-[15px] text-white/85">
            <li className="flex items-center gap-3"><ShieldCheck size={18} className="shrink-0 text-success" aria-hidden /> Real photos, at least three per listing</li>
            <li className="flex items-center gap-3"><MessageCircle size={18} className="shrink-0 text-primary-tint" aria-hidden /> Chat with the owner as soon as it’s live</li>
            <li className="flex items-center gap-3"><IndianRupee size={18} className="shrink-0 text-primary-tint" aria-hidden /> Nothing to pay to search or contact</li>
          </ul>
          <div className="mt-9 flex flex-wrap gap-3">
            {isOwner ? (
              <ButtonLink href="/listing/new" size="lg">List your property</ButtonLink>
            ) : (
              <button onClick={share} className={buttonClass('light', 'lg')}>
                <Share2 size={19} aria-hidden /> {copied ? 'Link copied' : 'Tell an owner about GHOR'}
              </button>
            )}
          </div>
        </div>
        <div className="relative hidden min-h-[420px] lg:block" aria-hidden>
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-2 p-2 pl-0">
            <div className="relative row-span-2 overflow-hidden rounded-2xl">
              <Image src="/landing/photos/room-bright-bed.jpg" alt="" fill sizes="30vw" className="object-cover" />
            </div>
            <div className="relative overflow-hidden rounded-2xl">
              <Image src="/landing/photos/studio-kitchen.jpg" alt="" fill sizes="20vw" className="object-cover" />
            </div>
            <div className="relative overflow-hidden rounded-2xl">
              <Image src="/landing/photos/flat-living-plants.jpg" alt="" fill sizes="20vw" className="object-cover" />
            </div>
          </div>
          <span className="absolute bottom-4 right-4 rounded-full bg-navy/70 px-2.5 py-1 text-[11px] font-semibold text-white/85 backdrop-blur-sm">Illustrative photos</span>
        </div>
      </div>
    </div>
  );
}
