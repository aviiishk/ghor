'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BadgeCheck, CalendarDays, Clock, Home, MessageCircle, ShieldCheck, Star, UserX } from 'lucide-react';
import { useOwner } from '@/features/owners/hooks';
import { describeLastActive, describeResponseTime } from '@/features/owners/api';
import { ListingCard } from '@/features/listings/components/ListingCard';
import { Avatar, Badge, EmptyState, Skeleton, SkeletonListingCard } from '@/components/ui';

// Root CLAUDE.md §2 "Owner profile page" — the host-profile analog, redesigned 2026-09-26
// around trust: identity + verification up top, then the numbers a renter weighs (all
// real, computed by apps/api; hidden rather than shown as 0 when there isn't enough data).
export default function OwnerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: owner, isLoading, isError } = useOwner(id);

  if (isLoading) {
    return (
      <div aria-busy="true">
        <div className="bg-navy px-4 py-12 sm:px-6">
          <div className="mx-auto flex max-w-6xl items-center gap-5">
            <Skeleton className="h-20 w-20 rounded-full bg-white/10" />
            <div className="space-y-2"><Skeleton className="h-7 w-48 bg-white/10" /><Skeleton className="h-4 w-32 bg-white/10" /></div>
          </div>
        </div>
        <div className="mx-auto grid max-w-6xl gap-5 px-4 pt-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
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
  const firstName = owner.fullName?.split(' ')[0] ?? 'this owner';

  const stats = [
    owner.avgRating != null && { icon: Star, value: owner.avgRating.toFixed(1), label: `${owner.reviewCount} review${owner.reviewCount === 1 ? '' : 's'}` },
    owner.responseRate != null && { icon: MessageCircle, value: `${owner.responseRate}%`, label: 'Response rate' },
    responseTime && { icon: Clock, value: responseTime.replace('Usually replies ', ''), label: 'Usually replies' },
    { icon: Home, value: String(owner.listings.length), label: `Live listing${owner.listings.length === 1 ? '' : 's'}` },
  ].filter(Boolean) as { icon: typeof Star; value: string; label: string }[];

  return (
    <div className="pb-20">
      <section className="relative overflow-hidden bg-navy px-4 pb-24 pt-6 text-white sm:px-6">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-primary/40 blur-3xl" />
        <div className="relative mx-auto max-w-6xl">
          <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-semibold text-white/80 hover:bg-white/10">
            <ArrowLeft size={17} aria-hidden /> Back
          </button>
          <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="rounded-full ring-4 ring-white/15"><Avatar name={owner.fullName} size="xl" /></span>
            <div>
              <p className="text-sm font-semibold text-white/60">Property owner</p>
              <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{owner.fullName ?? 'GHOR owner'}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                {owner.phoneVerified && <Badge tone="success" icon={BadgeCheck}>Phone verified</Badge>}
                {owner.idVerificationStatus === 'verified' && <Badge tone="success" icon={ShieldCheck}>ID verified</Badge>}
                <span className="inline-flex items-center gap-1 text-white/70"><CalendarDays size={14} aria-hidden /> Member since {memberSince}</span>
                {lastActive && <span className="inline-flex items-center gap-1 text-white/70"><Clock size={14} aria-hidden /> {lastActive}</span>}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="-mt-14 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-3xl bg-white p-5 shadow-[0_18px_40px_-24px_rgba(11,27,63,0.45)] ring-1 ring-navy/[0.06]">
              <s.icon size={20} className="text-primary" aria-hidden />
              <p className="mt-3 font-display text-2xl font-bold text-ink">{s.value}</p>
              <p className="text-xs font-semibold text-muted">{s.label}</p>
            </div>
          ))}
        </div>

        <section className="pt-12">
          <h2 className="font-display text-2xl font-bold text-ink">Listings by {firstName}</h2>
          <p className="mt-1 text-sm text-muted">Every listing is reviewed by GHOR before it goes live.</p>
          {owner.listings.length === 0 ? (
            <EmptyState compact icon={Home} title="No live listings right now" body={`${firstName} doesn’t have anything available at the moment.`} />
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {owner.listings.map((l) => <ListingCard key={l.id} listing={l} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
