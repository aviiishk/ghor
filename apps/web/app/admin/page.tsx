'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BadgeCheck, Camera, Check, ExternalLink, Inbox, MapPin, X } from 'lucide-react';
import { usePendingListings, useBulkSetListingStatus } from '@/features/admin/hooks';
import type { Listing } from '@/features/listings/api';
import { amenityIcon, amenityLabel } from '@/features/listings/amenities';
import { EmptyState, Skeleton, formatRent } from '@/components/ui';

function waitingFor(iso: string) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return 'Waiting < 1h';
  if (h < 24) return `Waiting ${h}h`;
  return `Waiting ${Math.floor(h / 24)}d`;
}

// Moderation queue (root CLAUDE.md §7.5: "moderation is a feature") — redesigned
// 2026-09-26 as review cards: the founder needs to SEE the photos and the key facts to
// make a trust decision, not scan a row of text. Oldest first (API order).
function QueueCard({
  listing,
  selected,
  onToggle,
  onDecide,
  busy,
}: {
  listing: Listing;
  selected: boolean;
  onToggle: () => void;
  onDecide: (s: 'approved' | 'rejected') => void;
  busy: boolean;
}) {
  const amenities = Object.entries(listing.amenities ?? {}).filter(([, on]) => on).map(([k]) => k);
  const tooFewPhotos = listing.images.length < 3;
  return (
    <article className={`overflow-hidden rounded-3xl bg-white ring-2 transition ${selected ? 'ring-primary' : 'ring-navy/[0.06]'}`}>
      <div className="flex gap-1 overflow-x-auto bg-surface-sunken p-1 [scrollbar-width:none]">
        {listing.images.length ? (
          listing.images.map((img) => (
            <span key={img.id} className="relative h-32 w-44 shrink-0 overflow-hidden rounded-2xl">
              <Image src={img.cloudinaryUrl} alt="" fill sizes="176px" className="object-cover" />
            </span>
          ))
        ) : (
          <span className="flex h-32 w-full items-center justify-center gap-2 text-sm text-muted"><Camera size={18} aria-hidden /> No photos</span>
        )}
      </div>
      <div className="p-5">
        <div className="flex items-start gap-3">
          <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${listing.title}`} className="mt-1.5 h-4 w-4 shrink-0 accent-primary" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h3 className="font-display text-lg font-bold text-ink">{listing.title}</h3>
              <span className="font-display font-bold text-ink">{formatRent(listing.rent)}<span className="text-xs font-medium text-muted">/mo</span></span>
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
              <span className="inline-flex items-center gap-1"><MapPin size={13} aria-hidden /> {listing.locality}, {listing.city}</span>
              <span className="capitalize">· {listing.propertyType}</span>
              {listing.deposit != null && <span>· Deposit {formatRent(listing.deposit)}</span>}
              <span className="rounded-full bg-warning-pale px-2 py-0.5 text-xs font-bold text-warning-deep">{waitingFor(listing.updatedAt)}</span>
            </p>
            {listing.description && <p className="mt-2 line-clamp-2 text-sm text-body">{listing.description}</p>}
            {amenities.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-body">
                {amenities.map((k) => {
                  const Icon = amenityIcon(k);
                  return <li key={k} className="inline-flex items-center gap-1"><Icon size={13} className="text-primary" aria-hidden /> {amenityLabel(k)}</li>;
                })}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-ink">{listing.owner.fullName ?? 'Owner'}</span>
              {listing.owner.phoneVerified && <span className="inline-flex items-center gap-0.5 font-semibold text-success-deep"><BadgeCheck size={13} aria-hidden /> Phone verified</span>}
              <span className={tooFewPhotos ? 'font-bold text-destructive-pressed' : 'text-muted'}>
                · {listing.images.length} photo{listing.images.length === 1 ? '' : 's'}{tooFewPhotos ? ' (below minimum)' : ''}
              </span>
              <Link href={`/listing/${listing.id}`} target="_blank" className="ml-auto inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                Open <ExternalLink size={12} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-2 border-t border-hairline-soft pt-4">
          <button onClick={() => onDecide('approved')} disabled={busy} className="press inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-success-deep text-sm font-bold text-white disabled:opacity-60 sm:flex-none sm:px-5">
            <Check size={16} aria-hidden /> Approve
          </button>
          <button onClick={() => onDecide('rejected')} disabled={busy} className="press inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-bold text-destructive-pressed ring-1 ring-destructive/40 hover:bg-destructive-pale disabled:opacity-60 sm:flex-none sm:px-5">
            <X size={16} aria-hidden /> Reject
          </button>
        </div>
      </div>
    </article>
  );
}

export default function AdminListingsQueuePage() {
  const { data: listings, isLoading, isError, refetch } = usePendingListings();
  const bulkSet = useBulkSetListingStatus();
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  async function handleBulk(status: 'approved' | 'rejected') {
    if (!selected.length) return;
    await bulkSet.mutateAsync({ ids: selected, status });
    setSelected([]);
  }
  const allSelected = !!listings?.length && selected.length === listings.length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Listings queue</h1>
          <p className="mt-1 text-muted">{listings?.length ? `${listings.length} waiting for review · oldest first` : 'New listings wait here until you approve them'}</p>
        </div>
        {!!listings?.length && (
          <button onClick={() => setSelected(allSelected ? [] : listings.map((l) => l.id))} className="text-sm font-semibold text-primary hover:underline">
            {allSelected ? 'Clear selection' : 'Select all'}
          </button>
        )}
      </div>

      {selected.length > 0 && (
        <div className="sticky top-20 z-30 mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-navy px-4 py-3 text-white shadow-sheet">
          <span className="text-sm font-semibold">{selected.length} selected</span>
          <div className="ml-auto flex gap-2">
            <button onClick={() => handleBulk('approved')} disabled={bulkSet.isPending} className="press h-9 rounded-full bg-success px-4 text-sm font-bold text-navy disabled:opacity-60">Approve all</button>
            <button onClick={() => handleBulk('rejected')} disabled={bulkSet.isPending} className="press h-9 rounded-full bg-white/10 px-4 text-sm font-bold text-white ring-1 ring-white/20 disabled:opacity-60">Reject all</button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {isLoading ? (
          Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-72 rounded-3xl" />)
        ) : isError ? (
          <EmptyState icon={Inbox} title="Couldn’t load the queue" action={{ label: 'Try again', onClick: () => refetch() }} />
        ) : listings?.length ? (
          listings.map((l) => (
            <QueueCard
              key={l.id}
              listing={l}
              selected={selected.includes(l.id)}
              onToggle={() => toggle(l.id)}
              onDecide={(s) => bulkSet.mutate({ ids: [l.id], status: s })}
              busy={bulkSet.isPending}
            />
          ))
        ) : (
          <EmptyState icon={Inbox} title="Queue is clear" body="Nothing is waiting for review. New listings appear here as soon as owners submit them." />
        )}
      </div>
    </div>
  );
}
