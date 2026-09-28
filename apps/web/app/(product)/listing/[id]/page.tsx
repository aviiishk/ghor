'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  Clock,
  Flag,
  GraduationCap,
  IndianRupee,
  MessageCircle,
  Pencil,
  Phone,
  Share2,
  ShieldCheck,
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
import {
  AboutText,
  AmenityList,
  DetailSection,
  KeyFacts,
  ListingHeadline,
  PriceHeading,
  formatAvailable,
} from '@/features/listings/components/ListingDetailView';
import { useOwner } from '@/features/owners/hooks';
import { describeLastActive, describeResponseTime } from '@/features/owners/api';
import { trackEvent } from '@/lib/analytics';
import { friendlyError } from '@/lib/errors';
import { useToast } from '@/components/ui/overlay';
import { Avatar, Button, EmptyState, IconButton, Skeleton, StatusBadge, buttonClass, cx, formatRent } from '@/components/ui';

const STATUS_DONE: Record<string, string> = {
  pending: 'Submitted for review — we’ll notify you when it’s live.',
  rented: 'Marked as rented. It’s hidden from search.',
  approved: 'Listed again. Renters can find it now.',
};

const LocationMap = dynamic(() => import('@/features/listings/components/LocationMap'), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full rounded-none" />,
});

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8" aria-busy="true">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="mt-5 h-[300px] rounded-2xl sm:h-[480px]" />
      <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="mt-6 h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-72 rounded-2xl" />
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
  const toast = useToast();

  if (isLoading) return <DetailSkeleton />;
  if (isError || !listing) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
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
  const available = formatAvailable(listing.availableFrom);
  const ownerName = listing.owner.fullName ?? 'Owner';

  async function handleStatusChange(status: 'pending' | 'approved' | 'rented') {
    setError(null);
    try {
      await updateListing.mutateAsync({ status });
      toast(STATUS_DONE[status] ?? 'Listing updated');
    } catch (e: unknown) {
      setError(friendlyError(e, 'We couldn’t update this listing. Please try again.'));
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
      setError(friendlyError(e, 'We couldn’t open a chat with this owner. Please try again.'));
    }
  }

  function handleCall() {
    // Non-null: only ever runs after the `!listing` guard above.
    const phone = listing!.owner.phone;
    trackEvent({ eventName: 'contact_tap', listingId: listing!.id, channel: 'call' });
    if (!phone) {
      setError("This owner hasn't added a phone number yet. Send them a message instead.");
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
        toast('Link copied — paste it anywhere to share');
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      // user dismissed the share sheet
    }
  }

  const statusAction =
    listing.status === 'draft' ? { label: 'Submit for review', to: 'pending' as const, variant: 'primary' as const } :
    listing.status === 'rejected' ? { label: 'Resubmit for review', to: 'pending' as const, variant: 'primary' as const } :
    listing.status === 'approved' ? { label: 'Mark as rented', to: 'rented' as const, variant: 'navy' as const } :
    listing.status === 'rented' ? { label: 'Mark as available again', to: 'approved' as const, variant: 'primary' as const } :
    null;

  const ownerBanner: Record<string, { tone: string; icon: typeof Clock; title: string; body: string } | undefined> = {
    draft: { tone: 'bg-white ring-1 ring-inset ring-navy/10 text-body', icon: Pencil, title: 'Draft — only you can see this', body: 'Add at least 3 photos, then submit it for review.' },
    pending: { tone: 'bg-warning-pale text-warning-deep', icon: Clock, title: 'In review', body: 'We check every listing before it goes live. You’ll get a notification when it’s approved.' },
    rejected: { tone: 'bg-destructive-pale text-destructive-pressed', icon: XCircle, title: 'Needs changes', body: 'This listing wasn’t approved. Edit the details, then resubmit it for review.' },
    rented: { tone: 'bg-navy text-white', icon: Check, title: 'Marked as rented', body: 'It’s hidden from search. Mark it available again when the room frees up.' },
  };
  const banner = isOwner ? ownerBanner[listing.status] : undefined;

  return (
    <div className="pb-32 lg:pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 sm:pt-6 lg:px-8">
        {/* Desktop top row */}
        <div className="mb-5 hidden items-center justify-between sm:flex">
          <button onClick={() => router.back()} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-body hover:bg-white">
            <ArrowLeft size={17} aria-hidden /> Back to homes
          </button>
          <div className="flex items-center gap-1">
            <button onClick={handleShare} className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-body underline-offset-4 hover:bg-white hover:underline">
              <Share2 size={16} aria-hidden /> {shared ? 'Link copied' : 'Share'}
            </button>
            {!isOwner && (
              <button onClick={() => setReportOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-body underline-offset-4 hover:bg-white hover:underline">
                <Flag size={15} aria-hidden /> Report
              </button>
            )}
          </div>
        </div>

        {banner && (
          <div className={cx('mb-5 mt-4 flex items-start gap-3 rounded-2xl p-4 sm:mt-0', banner.tone)}>
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
          mobileActions={
            <>
              <IconButton icon={ArrowLeft} label="Back" tone="solid" onClick={() => router.back()} />
              <IconButton icon={shared ? Check : Share2} label={shared ? 'Link copied' : 'Share listing'} tone="solid" onClick={handleShare} />
            </>
          }
        />

        <div className="mt-8 grid grid-cols-1 gap-10 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16">
          {/* ---------------------------------------------------- Main column */}
          <div className="min-w-0">
            <ListingHeadline
              title={listing.title}
              propertyType={listing.propertyType}
              locality={listing.locality}
              city={listing.city}
              verified={listing.status === 'approved'}
              propertyVerified={listing.propertyVerified}
              rating={
                listing.avgRating != null ? (
                  <a href="#reviews" className="hover:underline">
                    <RatingDisplay avgRating={listing.avgRating} reviewCount={listing.reviewCount} />
                  </a>
                ) : null
              }
            />

            <KeyFacts propertyType={listing.propertyType} rent={listing.rent} deposit={listing.deposit} availableFrom={listing.availableFrom} />

            {/* Owner strip — the person, right under the facts */}
            <Link href={`/owner/${listing.ownerId}`} className="group mt-8 flex items-center gap-4 rounded-2xl p-1 pr-3">
              <Avatar name={listing.owner.fullName} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink group-hover:underline">Listed by {ownerName}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                  {listing.owner.phoneVerified && (
                    <span className="inline-flex items-center gap-1 font-semibold text-success-deep"><BadgeCheck size={14} aria-hidden /> Phone verified</span>
                  )}
                  {responseTime && <span>{responseTime}</span>}
                  {!responseTime && lastActive && <span>{lastActive}</span>}
                </p>
              </div>
            </Link>

            {listing.description && (
              <DetailSection title="About this place">
                <AboutText text={listing.description} />
              </DetailSection>
            )}

            {amenities.length > 0 && (
              <DetailSection title="What’s included">
                <AmenityList amenities={amenities} />
              </DetailSection>
            )}

            {listing.institutions.length > 0 && (
              <DetailSection title="Nearby">
                <div className="flex flex-wrap gap-2">
                  {listing.institutions.map((tag) => (
                    <span key={tag.institution.id} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-navy ring-1 ring-inset ring-navy/10">
                      <GraduationCap size={17} className="text-primary" aria-hidden /> {tag.institution.name}
                    </span>
                  ))}
                </div>
              </DetailSection>
            )}

            {listing.latitude != null && listing.longitude != null && (
              <DetailSection title="Where it is" id="location">
                <p className="-mt-2 mb-4 text-muted">{listing.locality}, {listing.city} · approximate area. The owner shares the exact address when you arrange a visit.</p>
                <div className="relative isolate h-72 overflow-hidden rounded-2xl ring-1 ring-inset ring-navy/[0.08] sm:h-80">
                  <LocationMap lat={listing.latitude} lng={listing.longitude} />
                </div>
              </DetailSection>
            )}

            {/* Meet the owner — a person, not a card */}
            <DetailSection title="Meet the owner">
              <div className="flex items-start gap-5">
                <Avatar name={listing.owner.fullName} size="xl" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-xl font-bold text-navy">{ownerName}</p>
                  <p className="text-sm text-muted">
                    Property owner{owner ? ` · on GHOR since ${new Date(owner.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}` : ''}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {listing.owner.phoneVerified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-pale px-2.5 py-1 text-xs font-bold text-success-deep"><BadgeCheck size={13} aria-hidden /> Phone verified</span>
                    )}
                    {listing.owner.idVerificationStatus === 'verified' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-pale px-2.5 py-1 text-xs font-bold text-success-deep"><ShieldCheck size={13} aria-hidden /> ID verified</span>
                    )}
                  </div>
                </div>
              </div>
              {(responseTime || owner?.responseRate != null || lastActive || (owner && owner.reviewCount > 0)) && (
                <ul className="mt-6 grid grid-cols-1 gap-x-8 gap-y-3 text-[15px] text-body sm:grid-cols-2">
                  {responseTime && <li className="flex items-center gap-2.5"><MessageCircle size={17} className="shrink-0 text-primary" aria-hidden /> {responseTime}</li>}
                  {owner?.responseRate != null && <li className="flex items-center gap-2.5"><Check size={17} className="shrink-0 text-primary" aria-hidden /> Replies to {owner.responseRate}% of enquiries</li>}
                  {lastActive && <li className="flex items-center gap-2.5"><Clock size={17} className="shrink-0 text-primary" aria-hidden /> {lastActive}</li>}
                  {owner && owner.reviewCount > 0 && (
                    <li className="flex items-center gap-2.5"><RatingDisplay avgRating={owner.avgRating} reviewCount={owner.reviewCount} size="sm" /> across their listings</li>
                  )}
                </ul>
              )}
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
                <Link href={`/owner/${listing.ownerId}`} className={buttonClass('secondary', 'sm')}>View {ownerName.split(' ')[0]}’s profile</Link>
                {!isOwner && (
                  <button onClick={() => setReportOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted underline-offset-4 hover:text-destructive-pressed hover:underline sm:hidden">
                    <Flag size={14} aria-hidden /> Report this listing
                  </button>
                )}
              </div>
            </DetailSection>

            {!isOwner && (
              <DetailSection title="Before you visit">
                <ul className="space-y-4 text-[15px] leading-6 text-body">
                  <li className="flex gap-3">
                    <IndianRupee size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                    <span><strong className="font-semibold text-ink">See the place before paying anything.</strong> GHOR never charges renters, and owners here shouldn’t ask for a fee to show a room.</span>
                  </li>
                  <li className="flex gap-3">
                    <MessageCircle size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                    <span><strong className="font-semibold text-ink">Get the exact address in chat.</strong> Visit in daylight, and take someone with you if you can.</span>
                  </li>
                  <li className="flex gap-3">
                    <Check size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                    <span><strong className="font-semibold text-ink">Agree the details in writing.</strong> Rent, deposit, and what’s included — electricity, water, Wi-Fi — before you move in.</span>
                  </li>
                </ul>
                <p className="mt-5 text-sm text-muted">
                  Something not right?{' '}
                  <button onClick={() => setReportOpen(true)} className="font-semibold text-navy underline underline-offset-4">
                    Report this listing
                  </button>
                  {' '}— a person at GHOR checks every report.
                </p>
              </DetailSection>
            )}

            <ReviewsSection listingId={listing.id} avgRating={listing.avgRating} reviewCount={listing.reviewCount} />

            {/* Owner-only: their listing's stats. */}
            {isOwner && <ListingInsights listingId={listing.id} />}
          </div>

          {/* ---------------------------------------------------- Contact card */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-2xl bg-white p-7 shadow-lift ring-1 ring-inset ring-navy/[0.08]">
              <PriceHeading rent={listing.rent} deposit={listing.deposit} />
              {available && (
                <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-cream px-3 py-1.5 text-sm font-semibold text-navy">
                  <Clock size={15} aria-hidden /> {available}
                </p>
              )}
              {error && <p role="alert" className="mt-4 rounded-xl bg-destructive-pale px-3 py-2 text-sm text-destructive-pressed">{error}</p>}
              <div className="mt-6 space-y-3">
                {isOwner ? (
                  <>
                    <div className="flex items-center justify-between rounded-xl bg-cream px-4 py-3">
                      <span className="text-sm font-semibold text-muted">Status</span>
                      <StatusBadge status={listing.status} />
                    </div>
                    <Link href={`/listing/${listing.id}/edit`} className={buttonClass('secondary', 'lg', true)}>
                      <Pencil size={18} aria-hidden /> Edit details
                    </Link>
                    {statusAction && (
                      <Button variant={statusAction.variant} size="lg" block onClick={() => handleStatusChange(statusAction.to)} disabled={updateListing.isPending}>
                        {updateListing.isPending ? 'Updating…' : statusAction.label}
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Button size="lg" block icon={MessageCircle} onClick={handleChat} disabled={createConversation.isPending}>
                      {createConversation.isPending ? 'Opening chat…' : 'Chat with owner'}
                    </Button>
                    <Button variant="secondary" size="lg" block icon={Phone} onClick={handleCall}>
                      Call owner
                    </Button>
                  </>
                )}
              </div>
              {!isOwner && (
                <ul className="mt-6 space-y-2.5 border-t border-navy/[0.08] pt-5 text-sm text-body">
                  <li className="flex items-center gap-2.5"><ShieldCheck size={16} className="shrink-0 text-success-deep" aria-hidden /> Reviewed by GHOR before going live</li>
                  <li className="flex items-center gap-2.5"><IndianRupee size={16} className="shrink-0 text-primary" aria-hidden /> No brokerage, no viewing fee</li>
                </ul>
              )}
            </div>
          </aside>
        </div>

        {!isOwner && <SimilarListings listingId={listing.id} />}
      </div>

      {/* ---------------------------------------------------- Mobile sticky bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-navy/[0.08] bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md lg:hidden">
        {error && <p role="alert" className="mb-2 text-sm text-destructive-pressed">{error}</p>}
        {isOwner ? (
          <div className="flex items-center gap-3">
            <StatusBadge status={listing.status} />
            <Link href={`/listing/${listing.id}/edit`} className={cx(buttonClass('secondary'), 'ml-auto')}>
              <Pencil size={17} aria-hidden /> Edit
            </Link>
            {statusAction && (
              <Button variant={statusAction.variant} onClick={() => handleStatusChange(statusAction.to)} disabled={updateListing.isPending}>
                {statusAction.to === 'pending' ? 'Submit' : statusAction.to === 'rented' ? 'Mark rented' : 'Relist'}
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <p className="font-display leading-none text-navy">
                <span className="text-xl font-bold">{formatRent(listing.rent)}</span>
                <span className="text-xs font-medium text-muted">/month</span>
              </p>
              <p className="mt-1 truncate text-xs text-muted">{listing.deposit != null ? `Deposit ${formatRent(listing.deposit)}` : 'No brokerage'}</p>
            </div>
            <button onClick={handleCall} aria-label="Call owner" className="press ml-auto inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-navy ring-1 ring-inset ring-hairline">
              <Phone size={19} />
            </button>
            <Button size="lg" icon={MessageCircle} onClick={handleChat} disabled={createConversation.isPending} className="!h-12 !px-5">
              Chat
            </Button>
          </div>
        )}
      </div>

      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} listingId={listing.id} />
    </div>
  );
}
