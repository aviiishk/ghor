import Image from 'next/image';
import Link from 'next/link';
import { BadgeCheck, CalendarCheck, Images, MapPin, ShieldCheck } from 'lucide-react';
import type { Listing } from '../api';
import { amenityLabel } from '../amenities';
import { RatingDisplay } from '@/features/reviews/components/RatingDisplay';
import { cx, formatRent } from '@/components/ui';

// DESIGN.md `listing-card`, redesign v2 (2026-09-27). Inventory, not a SaaS card: the
// photo carries the card (no box around it), and the text below reads like a property
// ad — rent first and loud, then what it is, where, what's included, who's behind it.
// Every line is real listing data; unknown values are omitted, never guessed.
export function availability(iso: string | null): string | null {
  if (!iso) return null; // unknown — never claim "available now" without data
  const d = new Date(iso);
  if (d.getTime() <= Date.now()) return 'Available now';
  return `From ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
}

export function ListingCard({
  listing,
  variant = 'grid',
  priority = false,
  onHover,
  highlighted = false,
}: {
  listing: Listing;
  variant?: 'grid' | 'rail';
  priority?: boolean;
  /** Map split view: hovering a card highlights its pin. */
  onHover?: (id: string | null) => void;
  highlighted?: boolean;
}) {
  const photo = listing.images[0]?.cloudinaryUrl;
  const amenities = Object.entries(listing.amenities ?? {})
    .filter(([, on]) => on)
    .map(([key]) => amenityLabel(key));
  const avail = availability(listing.availableFrom);
  const verified = listing.status === 'approved';

  return (
    <Link
      href={`/listing/${listing.id}`}
      onMouseEnter={onHover ? () => onHover(listing.id) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      className={cx(
        'group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-cream',
        variant === 'rail' && 'w-[272px] shrink-0 snap-start sm:w-[300px]',
      )}
    >
      <div
        className={cx(
          'relative aspect-[4/3] overflow-hidden rounded-2xl bg-cream-deep transition-shadow duration-300',
          highlighted ? 'shadow-lift ring-2 ring-primary' : 'group-hover:shadow-lift',
        )}
      >
        {photo ? (
          <Image
            src={photo}
            // The title is the next heading inside this same link; repeating it as alt text
            // makes screen readers announce it twice.
            alt=""
            fill
            priority={priority}
            sizes={variant === 'rail' ? '300px' : '(min-width: 1280px) 320px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'}
            className={cx('object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]', listing.status === 'rented' && 'grayscale')}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-sm font-medium text-muted">
            <Images size={22} aria-hidden /> No photos yet
          </div>
        )}

        {verified && (
          <span
            className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-success-deep shadow-sm"
            title="Reviewed and approved by GHOR before going live"
          >
            <ShieldCheck size={13} strokeWidth={2.5} aria-hidden /> Verified
          </span>
        )}
        {listing.images.length > 1 && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-navy/70 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            <Images size={12} aria-hidden /> {listing.images.length}
            <span className="sr-only"> photos</span>
          </span>
        )}
        <div className="absolute bottom-3 left-3 flex gap-1.5">
          <span className="rounded-md bg-navy px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white">
            {listing.propertyType}
          </span>
          {avail && (
            <span className="inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-[11px] font-bold text-navy">
              <CalendarCheck size={12} aria-hidden /> {avail}
            </span>
          )}
        </div>
      </div>

      <div className="px-0.5 pt-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display leading-none text-navy">
            <span className="text-[1.375rem] font-bold tracking-[-0.02em]">{formatRent(listing.rent)}</span>
            <span className="ml-0.5 text-sm font-medium text-muted">/month</span>
          </p>
          <RatingDisplay avgRating={listing.avgRating} reviewCount={listing.reviewCount} size="sm" />
        </div>
        <h3 className="mt-2 line-clamp-1 font-semibold text-ink decoration-ink/30 underline-offset-4 group-hover:underline">{listing.title}</h3>
        <p className="mt-1 flex items-center gap-1 text-sm text-muted">
          <MapPin size={14} className="shrink-0 text-primary" aria-hidden />
          <span className="truncate">
            {listing.locality}, {listing.city}
          </span>
        </p>
        {amenities.length > 0 && (
          <p className="mt-1.5 line-clamp-1 text-[13px] text-body">
            {amenities.slice(0, 3).join(' · ')}
            {amenities.length > 3 && <span className="text-muted"> +{amenities.length - 3}</span>}
          </p>
        )}
        {listing.owner.phoneVerified && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-success-deep">
            <BadgeCheck size={14} aria-hidden /> Phone-verified owner
          </p>
        )}
      </div>
    </Link>
  );
}
