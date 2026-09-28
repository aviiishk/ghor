'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Grid2x2, Images, X } from 'lucide-react';
import { cx } from '@/components/ui';
import { useFocusTrap } from '@/components/ui/overlay';

export type GalleryImage = { id: string; cloudinaryUrl: string };

// Blob URLs (the create-listing preview, before upload) can't go through the image
// optimizer; Cloudinary URLs always do.
const isLocal = (url: string) => url.startsWith('blob:') || url.startsWith('data:');

// Listing photos, redesign v2 (2026-09-27). Desktop: a tall mosaic (1 hero + up to 4).
// Phones: an edge-to-edge swipe strip with a counter and overlay controls. Both open a
// full-screen viewer: arrows, Escape, keyboard, touch swipe, a thumbnail strip.
export function PhotoGallery({
  images,
  title,
  overlay,
  mobileActions,
}: {
  images: GalleryImage[];
  title: string;
  /** Badges laid over the first photo. */
  overlay?: ReactNode;
  /** Round buttons over the top of the photo on phones (back / share). */
  mobileActions?: ReactNode;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [mobileIndex, setMobileIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const viewer = useRef<HTMLDivElement>(null);
  useFocusTrap(viewer, open != null);
  const count = images.length;

  const step = useCallback((d: number) => setOpen((i) => (i == null ? i : (i + d + count) % count)), [count]);

  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, step]);

  if (!count) {
    return (
      <div className="relative -mx-4 flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-cream-deep text-muted sm:mx-0 sm:aspect-[21/9] sm:rounded-2xl">
        <Images size={28} aria-hidden />
        <span className="font-semibold">No photos yet</span>
        {mobileActions && <div className="absolute inset-x-4 top-4 flex justify-between sm:hidden">{mobileActions}</div>}
      </div>
    );
  }

  const tiles = images.slice(1, 5);
  // 'priority' preloads (desktop hero only); 'eager' loads early without a <link preload>,
  // for the phone strip's first slide — preloading it on desktop, where that strip is
  // hidden, fetched an image that was never shown (QA 2026-09-27).
  const img = (url: string, alt: string, sizes: string, className: string, load: 'priority' | 'eager' | 'lazy' = 'lazy') => (
    <Image
      src={url}
      alt={alt}
      fill
      priority={load === 'priority'}
      loading={load === 'eager' ? 'eager' : undefined}
      sizes={sizes}
      unoptimized={isLocal(url)}
      className={className}
    />
  );

  return (
    <>
      {/* Phones: edge-to-edge swipe strip */}
      <div className="relative -mx-4 sm:hidden">
        <div
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
          onScroll={(e) => {
            const el = e.currentTarget;
            setMobileIndex(Math.round(el.scrollLeft / el.clientWidth));
          }}
        >
          {images.map((image, i) => (
            <button key={image.id} onClick={() => setOpen(i)} className="relative aspect-[4/3] w-full shrink-0 snap-center" aria-label={`Open photo ${i + 1} of ${count}`}>
              {/* The strip is display:none from `sm` up, but an eager image still downloads —
                  with '100vw' that was a 1920px copy of the cover on desktop (RC QA 2026-09-28).
                  A tiny size above the breakpoint keeps phones eager and desktop near-free. */}
              {img(image.cloudinaryUrl, i === 0 ? title : '', '(min-width: 640px) 16px, 100vw', 'object-cover', i === 0 ? 'eager' : 'lazy')}
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-navy/40 to-transparent" />
        {mobileActions && <div className="absolute inset-x-4 top-4 flex justify-between">{mobileActions}</div>}
        {overlay && <div className="pointer-events-none absolute bottom-4 left-4">{overlay}</div>}
        <span className="absolute bottom-4 right-4 rounded-full bg-navy/75 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          {mobileIndex + 1} / {count}
        </span>
      </div>

      {/* Desktop: mosaic */}
      <div
        className={cx(
          'relative hidden gap-2 overflow-hidden rounded-2xl sm:grid',
          tiles.length ? 'grid-cols-4 grid-rows-2' : 'grid-cols-1',
          'h-[440px] lg:h-[540px]',
        )}
      >
        <button onClick={() => setOpen(0)} className={cx('group relative overflow-hidden', tiles.length > 0 && 'col-span-2 row-span-2')} aria-label={`Open photo 1 of ${count}`}>
          {img(images[0]!.cloudinaryUrl, title, '(min-width: 1280px) 820px, (min-width: 640px) 60vw, 100vw', 'object-cover transition duration-700 ease-out group-hover:scale-[1.03] group-hover:brightness-95', 'priority')}
        </button>
        {tiles.map((image, i) => (
          <button
            key={image.id}
            onClick={() => setOpen(i + 1)}
            className={cx(
              'group relative overflow-hidden',
              tiles.length === 1 && 'col-span-2 row-span-2',
              tiles.length === 2 && 'col-span-2',
              tiles.length === 3 && i === 2 && 'col-span-2',
            )}
            aria-label={`Open photo ${i + 2} of ${count}`}
          >
            {/* `sizes` must match the real tile width (a tile can span two columns) plus
                headroom for object-cover cropping — '320px' everywhere fetched 384px images
                into 600px tiles (QA 2026-09-27). */}
            {img(
              image.cloudinaryUrl,
              '',
              tiles.length === 1 || tiles.length === 2 || (tiles.length === 3 && i === 2)
                ? '(min-width: 1280px) 640px, 50vw'
                : '(min-width: 1280px) 420px, 25vw',
              'object-cover transition duration-700 ease-out group-hover:scale-[1.04] group-hover:brightness-95')}
          </button>
        ))}
        {overlay && <div className="pointer-events-none absolute left-4 top-4">{overlay}</div>}
        <button
          onClick={() => setOpen(0)}
          className="press absolute bottom-4 right-4 inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-navy shadow-lift ring-1 ring-navy/10 hover:bg-cream"
        >
          <Grid2x2 size={16} aria-hidden /> Show all {count} photos
        </button>
      </div>

      {/* Full-screen viewer */}
      {open != null && (
        <div ref={viewer} role="dialog" aria-modal="true" aria-label="Photo viewer" className="fixed inset-0 z-[60] flex flex-col bg-[#060e22]">
          <div className="flex items-center justify-between px-4 py-3 text-white sm:px-6">
            <button onClick={() => setOpen(null)} aria-label="Close photos" className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold hover:bg-white/10">
              <X size={20} /> Close
            </button>
            <span className="text-sm font-semibold tabular-nums text-white/80">
              {open + 1} / {count}
            </span>
            <span className="hidden max-w-[40%] truncate text-sm text-white/60 sm:block">{title}</span>
          </div>
          <div
            className="relative flex-1"
            onTouchStart={(e) => (touchX.current = e.touches[0]!.clientX)}
            onTouchEnd={(e) => {
              if (touchX.current == null) return;
              const dx = e.changedTouches[0]!.clientX - touchX.current;
              if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
              touchX.current = null;
            }}
          >
            <div key={open} className="absolute inset-0 animate-[ghor-fade_220ms_ease-out] motion-reduce:animate-none">
              {img(images[open]!.cloudinaryUrl, `${title}, photo ${open + 1}`, '100vw', 'object-contain')}
            </div>
            {count > 1 && (
              <>
                <button onClick={() => step(-1)} aria-label="Previous photo" className="absolute left-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-navy shadow-lift hover:bg-cream sm:flex">
                  <ChevronLeft size={24} />
                </button>
                <button onClick={() => step(1)} aria-label="Next photo" className="absolute right-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-navy shadow-lift hover:bg-cream sm:flex">
                  <ChevronRight size={24} />
                </button>
              </>
            )}
          </div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-4 sm:justify-center">
            {images.map((image, i) => (
              <button
                key={image.id}
                onClick={() => setOpen(i)}
                aria-label={`Photo ${i + 1}`}
                aria-current={i === open}
                className={cx('relative h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-2 transition', i === open ? 'ring-white' : 'opacity-50 ring-transparent hover:opacity-100')}
              >
                {img(image.cloudinaryUrl, '', '80px', 'object-cover')}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
