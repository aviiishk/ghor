'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BadgeCheck,
  BedDouble,
  CalendarDays,
  Check,
  Clock,
  Flag,
  GraduationCap,
  IndianRupee,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Share2,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useListing, useUpdateListing } from '@/features/listings/hooks';
import { useCreateConversation } from '@/features/chat/hooks';
import { useProfile } from '@/features/auth/hooks';
import { ReportDialog } from '@/features/reports/components/ReportDialog';
import { RatingDisplay } from '@/features/reviews/components/RatingDisplay';
import { ReviewsSection } from '@/features/reviews/components/ReviewsSection';
import { SimilarListings } from '@/features/listings/components/SimilarListings';
import { ListingInsights } from '@/features/listings/components/ListingInsights';
import { PhotoGallery } from '@/features/listings/components/PhotoGallery';
import { useOwner } from '@/features/owners/hooks';
import { describeLastActive, describeResponseTime } from '@/features/owners/api';
import { trackEvent } from '@/lib/analytics';
import { amenityIcon, amenityLabel } from '@/features/listings/amenities';
import { Avatar, Badge, EmptyState, IconTile, PriceTag, Skeleton, StatusBadge, formatRent } from '@/components/ui';

const LocationMap = dynamic(() => import('@/features/listings/components/LocationMap'), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full rounded-none" />,
});

function formatDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.getTime() <= Date.now() ? 'Available now' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6" aria-busy="true">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="mt-5 h-[300px] rounded-3xl sm:h-[440px]" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-5 w-1/3" />
          <div className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        </div>
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    </div>
  );
}

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: listing, isLoading, isError } = useListing(id);
  const { data: profile } = useProfile();
  const updateListing = useUpdateListing(id);
  const createConversation = useCreateConversation();
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [shared, setShared] = useState(false);
  // Hooks must run before the early returns below, so this keys off listing?.ownerId.
  const { data: owner } = useOwner(listing?.ownerId);

  if (isLoading) return <DetailSkeleton />;
  if (isError || !listing) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <EmptyState
          icon={XCircle}
          title="This listing isn’t available"
          body="It may have been rented, removed, or it’s still being reviewed."
          action={{ label: 'Browse homes', href: '/browse' }}
        />
      </div>
    );
  }

  const isOwner = profile?.id === listing.ownerId;
  const amenities = Object.entries(listing.amenities ?? {})
    .filter(([, on]) => on)
    .map(([key]) => key);
  const responseTime = describeResponseTime(owner?.responseTimeMinutes ?? null);
  const lastActive = describeLastActive(listing.owner.lastActiveAt);
  const available = formatDate(listing.availableFrom);

  async function handleStatusChange(status: 'pending' | 'approved' | 'rented') {
    setError(null);
    try {
      await updateListing.mutateAsync({ status });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    }
  }

  async function handleChat() {
    // The core conversion event (root CLAUDE.md §4) — counted on tap, before the
    // conversation request, so a failed request still shows up as intent.
    trackEvent({ eventName: 'contact_tap', listingId: listing!.id, channel: 'chat' });
    setError(null);
    try {
      const conversation = await createConversation.mutateAsync(listing!.id);
      router.push(`/chat/${conversation.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not start the conversation');
    }
  }

  function handleCall() {
    // Non-null: only ever runs after the `!listing` guard above.
    const phone = listing!.owner.phone;
    trackEvent({ eventName: 'contact_tap', listingId: listing!.id, channel: 'call' });
    if (!phone) {
      alert("This owner hasn't added a phone number yet.");
      return;
    }
    window.location.href = `tel:${phone}`;
  }

  // Share listing (root CLAUDE.md §2): native share sheet where available, else copy link.
  async function handleShare() {
    const url = window.location.href;
    const text = `${listing!.title} — ${formatRent(listing!.rent)}/month in ${listing!.locality}, on GHOR`;
    trackEvent({ eventName: 'listing_shared', listingId: listing!.id });
    try {
      if (navigator.share) await navigator.share({ title: listing!.title, text, url });
      else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      // user dismissed the share sheet
    }
  }

  const facts = [
    { icon: BedDouble, label: 'Type', value: listing.propertyType === 'room' ? 'Room' : 'Flat' },
    { icon: IndianRupee, label: 'Rent', value: `${formatRent(listing.rent)}/mo` },
    { icon: Wallet, label: 'Deposit', value: listing.deposit != null ? formatRent(listing.deposit) : 'Ask owner' },
    { icon: CalendarDays, label: 'Move-in', value: available ?? 'Ask owner' },
  ];

  const ownerActions = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-muted">Status</span>
        <StatusBadge status={listing.status} />
      </div>
      <Link href={`/listing/${listing.id}/edit`} className="press flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white font-semibold text-ink ring-1 ring-hairline hover:ring-ink/30">
        <Pencil size={17} aria-hidden /> Edit details
      </Link>
      {listing.status === 'draft' && (
        <button onClick={() => handleStatusChange('pending')} disabled={updateListing.isPending} className="press h-12 w-full rounded-full bg-primary font-bold text-white hover:bg-primary-pressed disabled:opacity-70">
          Submit for review
        </button>
      )}
      {listing.status === 'rejected' && (
        <button onClick={() => handleStatusChange('pending')} disabled={updateListing.isPending} className="press h-12 w-full rounded-full bg-primary font-bold text-white hover:bg-primary-pressed disabled:opacity-70">
          Resubmit for review
        </button>
      )}
      {listing.status === 'approved' && (
        <button onClick={() => handleStatusChange('rented')} disabled={updateListing.isPending} className="press h-12 w-full rounded-full bg-navy font-bold text-white hover:bg-navy-soft disabled:opacity-70">
          Mark as rented
        </button>
      )}
      {listing.status === 'rented' && (
        <button onClick={() => handleStatusChange('approved')} disabled={updateListing.isPending} className="press h-12 w-full rounded-full bg-primary font-bold text-white hover:bg-primary-pressed disabled:opacity-70">
          Mark as available again
        </button>
      )}
    </div>
  );

  const ownerBanner: Record<string, { tone: string; icon: typeof Clock; title: string; body: string } | undefined> = {
    draft: { tone: 'bg-surface-sunken text-body', icon: Pencil, title: 'Draft — only you can see this', body: 'Add at least 3 photos, then submit it for review.' },
    pending: { tone: 'bg-warning-pale text-warning-deep', icon: Clock, title: 'In review', body: 'We check every listing before it goes live. You’ll get a notification when it’s approved.' },
    rejected: { tone: 'bg-destructive-pale text-destructive-pressed', icon: XCircle, title: 'Needs changes', body: 'This listing wasn’t approved. Edit the details, then resubmit it for review.' },
    rented: { tone: 'bg-navy text-white', icon: Check, title: 'Marked as rented', body: 'It’s hidden from search. Mark it available again when the room frees up.' },
  };
  const banner = isOwner ? ownerBanner[listing.status] : undefined;

  return (
    <div className="pb-32 lg:pb-16">
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <div className="mb-5 flex items-center justify-between">
          <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-semibold text-body hover:bg-white">
            <ArrowLeft size={17} aria-hidden /> Back
          </button>
          <button onClick={handleShare} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-body hover:bg-white">
            <Share2 size={16} aria-hidden /> {shared ? 'Link copied' : 'Share'}
          </button>
        </div>

        {banner && (
          <div className={`mb-5 flex items-start gap-3 rounded-2xl p-4 ${banner.tone}`}>
            <banner.icon size={20} className="mt-0.5 shrink-0" aria-hidden />
            <div>
              <p className="font-bold">{banner.title}</p>
              <p className="text-sm opacity-90">{banner.body}</p>
            </div>
          </div>
        )}

        <PhotoGallery
          images={listing.images}
          title={listing.title}
          overlay={
            <div className="flex gap-1.5">
              <span className="glass-chip rounded-full px-2.5 py-1 text-xs font-bold capitalize">{listing.propertyType}</span>
              {listing.status === 'approved' && (
                <span className="glass-chip inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-success-deep">
                  <ShieldCheck size={13} aria-hidden /> Verified by GHOR
                </span>
              )}
            </div>
          }
        />

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-12">
          {/* ---------------------------------------------------- Main column */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {listing.propertyVerified && <Badge tone="success" icon={BadgeCheck}>Property verified</Badge>}
              <RatingDisplay avgRating={listing.avgRating} reviewCount={listing.reviewCount} />
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">{listing.title}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-body">
              <MapPin size={17} className="text-primary" aria-hidden /> {listing.locality}, {listing.city}
            </p>

            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {facts.map((f) => (
                <div key={f.label} className="rounded-2xl bg-white p-4 ring-1 ring-navy/[0.06]">
                  <f.icon size={20} className="text-primary" aria-hidden />
                  <dt className="mt-2 text-xs font-semibold text-muted">{f.label}</dt>
                  <dd className="font-display font-bold text-ink">{f.value}</dd>
                </div>
              ))}
            </dl>

            {listing.description && (
              <section className="mt-10">
                <h2 className="text-xl font-bold text-ink">About this place</h2>
                <p className="mt-3 whitespace-pre-line leading-7 text-body">{listing.description}</p>
              </section>
            )}

            {amenities.length > 0 && (
              <section className="mt-10">
                <h2 className="text-xl font-bold text-ink">What this place offers</h2>
                <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {amenities.map((key) => (
                    <li key={key} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-navy/[0.06]">
                      <IconTile icon={amenityIcon(key)} size="sm" />
                      <span className="font-semibold text-ink">{amenityLabel(key)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {listing.institutions.length > 0 && (
              <section className="mt-10">
                <h2 className="text-xl font-bold text-ink">Nearby</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {listing.institutions.map((tag) => (
                    <span key={tag.institution.id} className="inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3.5 py-2 text-sm font-semibold text-primary">
                      <GraduationCap size={16} aria-hidden /> {tag.institution.name}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {listing.latitude != null && listing.longitude != null && (
              <section className="mt-10">
                <h2 className="text-xl font-bold text-ink">Where it is</h2>
                <p className="mt-1 text-sm text-muted">{listing.locality} · approximate area, the owner will share the exact address</p>
                <div className="relative mt-4 h-64 overflow-hidden rounded-3xl ring-1 ring-navy/[0.06] sm:h-72">
                  <LocationMap lat={listing.latitude} lng={listing.longitude} />
                </div>
              </section>
            )}

            {/* Owner trust card */}
            <section className="mt-10 rounded-3xl bg-white p-6 ring-1 ring-navy/[0.06]">
              <div className="flex items-start gap-4">
                <Avatar name={listing.owner.fullName} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-muted">Listed by</p>
                  <Link href={`/owner/${listing.ownerId}`} className="font-display text-lg font-bold text-ink hover:underline">
                    {listing.owner.fullName ?? 'Owner'}
                  </Link>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {listing.owner.phoneVerified && <Badge tone="success" icon={BadgeCheck}>Phone verified</Badge>}
                    {listing.owner.idVerificationStatus === 'verified' && <Badge tone="success" icon={ShieldCheck}>ID verified</Badge>}
                  </div>
                </div>
              </div>
              <ul className="mt-5 grid gap-2 text-sm text-body sm:grid-cols-2">
                {responseTime && <li className="flex items-center gap-2"><MessageCircle size={16} className="text-primary" aria-hidden /> {responseTime}</li>}
                {owner?.responseRate != null && <li className="flex items-center gap-2"><Check size={16} className="text-primary" aria-hidden /> {owner.responseRate}% response rate</li>}
                {lastActive && <li className="flex items-center gap-2"><Clock size={16} className="text-primary" aria-hidden /> {lastActive}</li>}
                {owner && owner.reviewCount > 0 && (
                  <li className="flex items-center gap-2"><RatingDisplay avgRating={owner.avgRating} reviewCount={owner.reviewCount} size="sm" /> across their listings</li>
                )}
              </ul>
              <div className="mt-5 flex items-center justify-between border-t border-hairline-soft pt-4">
                <Link href={`/owner/${listing.ownerId}`} className="text-sm font-bold text-primary hover:underline">View profile</Link>
                {!isOwner && (
                  <button onClick={() => setReportOpen(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-destructive">
                    <Flag size={13} aria-hidden /> Report listing
                  </button>
                )}
              </div>
            </section>
          </div>

          {/* ---------------------------------------------------- Contact / owner card */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-3xl bg-white p-6 shadow-[0_24px_60px_-28px_rgba(11,27,63,0.45)] ring-1 ring-navy/[0.06]">
              <PriceTag amount={listing.rent} size="lg" />
              <p className="mt-1 text-sm text-muted">
                {listing.deposit != null ? `Deposit ${formatRent(listing.deposit)}` : 'Deposit: ask the owner'}
              </p>
              {error && <p role="alert" className="mt-4 rounded-xl bg-destructive-pale px-3 py-2 text-sm text-destructive-pressed">{error}</p>}
              <div className="mt-6">
                {isOwner ? (
                  ownerActions
                ) : (
                  <div className="space-y-3">
                    <button onClick={handleChat} disabled={createConversation.isPending} className="press flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-bold text-white shadow-[0_12px_28px_-10px_rgba(37,99,235,0.7)] hover:bg-primary-pressed disabled:opacity-70">
                      <MessageCircle size={20} aria-hidden /> Chat with Owner
                    </button>
                    <button onClick={handleCall} className="press flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white font-semibold text-ink ring-1 ring-hairline hover:ring-ink/30">
                      <Phone size={18} aria-hidden /> Call owner
                    </button>
                  </div>
                )}
              </div>
              {!isOwner && (
                <ul className="mt-6 space-y-2 border-t border-hairline-soft pt-5 text-sm text-body">
                  <li className="flex items-center gap-2"><ShieldCheck size={16} className="text-success-deep" aria-hidden /> Reviewed by GHOR before going live</li>
                  <li className="flex items-center gap-2"><IndianRupee size={16} className="text-primary" aria-hidden /> No brokerage, no viewing fee</li>
                </ul>
              )}
            </div>
          </aside>
        </div>

        <ReviewsSection listingId={listing.id} avgRating={listing.avgRating} reviewCount={listing.reviewCount} />

        {/* Owner-only: their listing's stats, instead of "similar listings" to their own. */}
        {isOwner ? <ListingInsights listingId={listing.id} /> : <SimilarListings listingId={listing.id} />}
      </div>

      {/* ---------------------------------------------------- Mobile sticky bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-navy/[0.08] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        {error && <p role="alert" className="mb-2 text-sm text-destructive-pressed">{error}</p>}
        {isOwner ? (
          <div className="flex items-center gap-3">
            <StatusBadge status={listing.status} />
            <Link href={`/listing/${listing.id}/edit`} className="press ml-auto inline-flex h-12 items-center gap-2 rounded-full px-5 font-semibold text-ink ring-1 ring-hairline">
              <Pencil size={17} aria-hidden /> Edit
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <PriceTag amount={listing.rent} size="md" />
              <p className="truncate text-xs text-muted">{listing.deposit != null ? `Deposit ${formatRent(listing.deposit)}` : 'No brokerage'}</p>
            </div>
            <button onClick={handleCall} aria-label="Call owner" className="press ml-auto inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-ink ring-1 ring-hairline">
              <Phone size={19} />
            </button>
            <button onClick={handleChat} disabled={createConversation.isPending} className="press inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-primary px-5 font-bold text-white disabled:opacity-70">
              <MessageCircle size={18} aria-hidden /> Chat
            </button>
          </div>
        )}
      </div>

      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} listingId={listing.id} />
    </div>
  );
}
