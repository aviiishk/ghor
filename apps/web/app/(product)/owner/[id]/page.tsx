'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BadgeCheck, CalendarDays, Clock, Home, MessageCircle, ShieldCheck, Star, UserX } from 'lucide-react';
import { useOwner } from '@/features/owners/hooks';
import { describeLastActive, describeResponseTime } from '@/features/owners/api';
import { ListingCard } from '@/features/listings/components/ListingCard';
import { Avatar, EmptyState, Skeleton, SkeletonListingCard } from '@/components/ui';

// Root CLAUDE.md §2 "Owner profile page" — the host-profile analog. Redesign v2
// (2026-09-27): a trust card (identity, verification, the numbers a renter weighs — all
// real, computed by apps/api, hidden rather than shown as 0 when there isn't enough data)
// beside the owner's live homes. No phone number or other contact details here.
export default function OwnerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: owner, isLoading, isError } = useOwner(id);

  if (isLoading) {
    return (
      <div className="mx-auto grid grid-cols-1 max-w-7xl gap-10 px-4 pt-10 sm:px-6 lg:grid-cols-[340px_1fr] lg:px-8" aria-busy="true">
        <Skeleton className="h-[420px] rounded-2xl" />
        <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => <SkeletonListingCard key={i} />)}
        </div>
      </div>
    );
  }
  if (isError || !owner) {
    return <EmptyState icon={UserX} title="This profile isn’t available" body="The owner may have left GHOR." action={{ label: 'Browse homes', href: '/browse' }} />;
  }

  const memberSince = new Date(owner.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const responseTime = describeResponseTime(owner.responseTimeMinutes);
  const lastActive = describeLastActive(owner.lastActiveAt);
  const name = owner.fullName ?? 'GHOR owner';
  const firstName = owner.fullName?.split(' ')[0] ?? 'this owner';

  const stats = [
    { icon: Home, value: String(owner.listings.length), label: `Live listing${owner.listings.length === 1 ? '' : 's'}` },
    owner.avgRating != null && { icon: Star, value: owner.avgRating.toFixed(1), label: `${owner.reviewCount} review${owner.reviewCount === 1 ? '' : 's'}` },
    owner.responseRate != null && { icon: MessageCircle, value: `${owner.responseRate}%`, label: 'Response rate' },
  ].filter(Boolean) as { icon: typeof Star; value: string; label: string }[];

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
      <button onClick={() => router.back()} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-body hover:bg-white">
        <ArrowLeft size={17} aria-hidden /> Back
      </button>

      <div className="mt-4 grid grid-cols-1 gap-10 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-14">
        {/* Trust card */}
        <aside>
          <div className="rounded-2xl bg-white p-7 ring-1 ring-inset ring-navy/[0.08] lg:sticky lg:top-24">
            <div className="flex items-center gap-4 lg:flex-col lg:items-start">
              <Avatar name={owner.fullName} size="xl" />
              <div>
                <h1 className="font-display text-[1.9rem] font-bold leading-tight tracking-[-0.025em] text-navy">{name}</h1>
                <p className="text-sm font-semibold text-primary">Property owner in Guwahati</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {owner.phoneVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-pale px-2.5 py-1 text-xs font-bold text-success-deep"><BadgeCheck size={13} aria-hidden /> Phone verified</span>
              )}
              {owner.idVerificationStatus === 'verified' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-pale px-2.5 py-1 text-xs font-bold text-success-deep"><ShieldCheck size={13} aria-hidden /> ID verified</span>
              )}
            </div>

            <dl className="mt-6 grid grid-cols-3 gap-2 border-y border-navy/[0.08] py-5">
              {stats.map((s) => (
                <div key={s.label}>
                  <dd className="font-display text-2xl font-bold text-navy">{s.value}</dd>
                  <dt className="text-xs font-semibold text-muted">{s.label}</dt>
                </div>
              ))}
            </dl>

            <ul className="mt-5 space-y-3 text-[15px] text-body">
              {responseTime && <li className="flex items-center gap-2.5"><MessageCircle size={17} className="text-primary" aria-hidden /> {responseTime}</li>}
              {lastActive && <li className="flex items-center gap-2.5"><Clock size={17} className="text-primary" aria-hidden /> {lastActive}</li>}
              <li className="flex items-center gap-2.5"><CalendarDays size={17} className="text-primary" aria-hidden /> On GHOR since {memberSince}</li>
            </ul>

            <p className="mt-6 rounded-xl bg-cream p-4 text-sm leading-6 text-body">
              <ShieldCheck size={16} className="mb-1 text-success-deep" aria-hidden />
              Every listing by {firstName} was reviewed by GHOR before going live. To get in touch, open a listing and tap “Chat with owner”.
            </p>
          </div>
        </aside>

        {/* Listings */}
        <section>
          <h2 className="font-display text-[clamp(1.75rem,3vw,2.4rem)] font-bold tracking-[-0.03em] text-navy">Homes by {firstName}</h2>
          <p className="mt-1 text-muted">{owner.listings.length ? `${owner.listings.length} available now` : 'Nothing available right now'}</p>
          {owner.listings.length === 0 ? (
            <EmptyState compact icon={Home} title="No live listings right now" body={`${firstName} doesn’t have anything available at the moment. Check back later.`} action={{ label: 'Browse other homes', href: '/browse' }} />
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
              {owner.listings.map((l, i) => <ListingCard key={l.id} listing={l} priority={i < 3} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
