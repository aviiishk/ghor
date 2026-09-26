import Image from 'next/image';
import Link from 'next/link';
import { BadgeCheck, CalendarCheck, Camera, MapPin, ShieldCheck } from 'lucide-react';
import type { Listing } from '../api';
import { amenityIcon, amenityLabel } from '../amenities';
import { RatingDisplay } from '@/features/reviews/components/RatingDisplay';
import { formatRent } from '@/components/ui';

// DESIGN.md `listing-card`, redesign 2026-09-26. The photo leads: 4:3, overlays carry
// type / trust / price / photo count so the text block below can stay short. Answers
// "what, where, how much, why care, can I trust it" without a wall of text.
function availability(iso: string | null): string | null {
  if (!iso) return null; // unknown — never claim "available now" without data
  const d = new Date(iso);
  if (d.getTime() <= Date.now()) return 'Available now';
  return `From ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
}

export function ListingCard({
  listing,
  variant = 'grid',
  priority = false,
}: {
  listing: Listing;
  variant?: 'grid' | 'rail';
  priority?: boolean;
}) {
  const photo = listing.images[0]?.cloudinaryUrl;
  const amenities = Object.entries(listing.amenities ?? {})
    .filter(([, on]) => on)
    .map(([key]) => key);
  const shown = amenities.slice(0, 3);
  const extra = amenities.length - shown.length;
  const avail = availability(listing.availableFrom);
  const verified = listing.status === 'approved';

  return (
    <Link
      href={`/listing/${listing.id}`}
      className={`press group block overflow-hidden rounded-3xl bg-white ring-1 ring-navy/[0.06] transition-shadow hover:shadow-[0_18px_40px_-18px_rgba(11,27,63,0.35)] ${
        variant === 'rail' ? 'w-[280px] shrink-0 snap-start sm:w-[300px]' : ''
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-sunken">
        {photo ? (
          <Image
            src={photo}
            alt={listing.title}
            fill
            priority={priority}
            sizes={variant === 'rail' ? '300px' : '(min-width: 1280px) 400px, (min-width: 640px) 50vw, 100vw'}
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-soft">No photo yet</div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-navy/55 to-transparent" />

        <div className="absolute left-3 top-3 flex gap-1.5">
          <span className="glass-chip rounded-full px-2.5 py-1 text-xs font-bold capitalize">{listing.propertyType}</span>
          {verified && (
            <span className="glass-chip inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-success-deep" title="Reviewed and approved by GHOR">
              <ShieldCheck size={13} aria-hidden /> Verified
            </span>
          )}
        </div>
        {listing.images.length > 1 && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-navy/60 px-2 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            <Camera size={12} aria-hidden /> {listing.images.length}
          </span>
        )}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
          <span className="glass-chip rounded-2xl px-3 py-1.5 font-display leading-none">
            <span className="text-lg font-bold tracking-tight text-ink">{formatRent(listing.rent)}</span>
            <span className="text-xs font-medium text-muted">/mo</span>
          </span>
          {avail && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-navy">
              <CalendarCheck size={12} aria-hidden /> {avail}
            </span>
          )}
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-1 font-display text-base font-bold text-ink">{listing.title}</h3>
          <RatingDisplay avgRating={listing.avgRating} reviewCount={listing.reviewCount} size="sm" />
        </div>
        <p className="mt-1 flex items-center gap-1 text-sm text-muted">
          <MapPin size={14} className="shrink-0" aria-hidden />
          <span className="truncate">
            {listing.locality}, {listing.city}
          </span>
        </p>

        {shown.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-xs font-semibold text-body">
            {shown.map((key) => {
              const Icon = amenityIcon(key);
              return (
                <li key={key} className="inline-flex items-center gap-1">
                  <Icon size={14} className="text-primary" aria-hidden /> {amenityLabel(key)}
                </li>
              );
            })}
            {extra > 0 && <li className="text-muted">+{extra} more</li>}
          </ul>
        )}

        <div className="mt-3 flex items-center gap-1.5 border-t border-hairline-soft pt-3 text-xs text-muted">
          <span className="truncate">{listing.owner.fullName ?? 'Owner'}</span>
          {listing.owner.phoneVerified && (
            <span className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-success-deep">
              <BadgeCheck size={13} aria-hidden /> Phone verified
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
