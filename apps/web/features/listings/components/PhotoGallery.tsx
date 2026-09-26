'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Grid2x2, X } from 'lucide-react';
import type { ListingImage } from '../api';

// DESIGN.md "Photography" + root CLAUDE.md §2's full-screen lightbox. Desktop: a mosaic
// (one hero + up to four tiles). Mobile: a swipeable strip with a "1 / N" counter. Either
// opens the lightbox (arrow keys / Escape supported). Overlays (badges) are passed in by
// the page so this stays a pure photo component.
export function PhotoGallery({
  images,
  title,
  overlay,
}: {
  images: ListingImage[];
  title: string;
  overlay?: React.ReactNode;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [mobileIndex, setMobileIndex] = useState(0);
  const count = images.length;

  const step = useCallback(
    (d: number) => setOpen((i) => (i == null ? i : (i + d + count) % count)),
    [count],
  );

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
      <div className="flex aspect-[16/9] items-center justify-center rounded-3xl bg-surface-sunken text-muted-soft">
        No photos yet
      </div>
    );
  }

  const tiles = images.slice(1, 5);

  return (
    <>
      {/* Mobile: swipe strip */}
      <div className="relative -mx-4 sm:hidden">
        <div
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
          onScroll={(e) => {
            const el = e.currentTarget;
            setMobileIndex(Math.round(el.scrollLeft / el.clientWidth));
          }}
        >
          {images.map((img, i) => (
            <button key={img.id} onClick={() => setOpen(i)} className="relative aspect-[4/3] w-full shrink-0 snap-center" aria-label={`Open photo ${i + 1} of ${count}`}>
              <Image src={img.cloudinaryUrl} alt={i === 0 ? title : ''} fill priority={i === 0} sizes="100vw" className="object-cover" />
            </button>
          ))}
        </div>
        {overlay && <div className="pointer-events-none absolute left-4 top-4">{overlay}</div>}
        <span className="absolute bottom-3 right-4 rounded-full bg-navy/70 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          {mobileIndex + 1} / {count}
        </span>
      </div>

      {/* Desktop: mosaic */}
      <div className={`relative hidden gap-2 overflow-hidden rounded-3xl sm:grid ${tiles.length ? 'grid-cols-4 grid-rows-2' : 'grid-cols-1'} h-[420px] lg:h-[480px]`}>
        <button
          onClick={() => setOpen(0)}
          className={`group relative overflow-hidden ${tiles.length ? 'col-span-2 row-span-2' : ''}`}
          aria-label={`Open photo 1 of ${count}`}
        >
          <Image src={images[0]!.cloudinaryUrl} alt={title} fill priority sizes="(min-width: 1024px) 600px, 60vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
        </button>
        {tiles.map((img, i) => (
          <button
            key={img.id}
            onClick={() => setOpen(i + 1)}
            className={`group relative overflow-hidden ${tiles.length === 1 ? 'col-span-2 row-span-2' : tiles.length === 2 ? 'col-span-2' : tiles.length === 3 && i === 2 ? 'col-span-2' : ''}`}
            aria-label={`Open photo ${i + 2} of ${count}`}
          >
            <Image src={img.cloudinaryUrl} alt="" fill sizes="300px" className="object-cover transition-transform duration-700 group-hover:scale-105" />
          </button>
        ))}
        {overlay && <div className="pointer-events-none absolute left-4 top-4">{overlay}</div>}
        <button
          onClick={() => setOpen(0)}
          className="press absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-ink shadow-card"
        >
          <Grid2x2 size={16} aria-hidden /> Show all {count} photos
        </button>
      </div>

      {/* Lightbox */}
      {open != null && (
        <div role="dialog" aria-modal="true" aria-label="Photo viewer" className="fixed inset-0 z-[60] flex flex-col bg-navy/95">
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <span className="text-sm font-semibold">{open + 1} / {count}</span>
            <button onClick={() => setOpen(null)} aria-label="Close photos" className="rounded-full p-2 hover:bg-white/10">
              <X size={22} />
            </button>
          </div>
          <div className="relative flex-1">
            <Image src={images[open]!.cloudinaryUrl} alt={`${title}, photo ${open + 1}`} fill sizes="100vw" className="object-contain" />
            {count > 1 && (
              <>
                <button onClick={() => step(-1)} aria-label="Previous photo" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-3 text-white hover:bg-white/25">
                  <ChevronLeft size={24} />
                </button>
                <button onClick={() => step(1)} aria-label="Next photo" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-3 text-white hover:bg-white/25">
                  <ChevronRight size={24} />
                </button>
              </>
            )}
          </div>
          <div className="flex justify-center gap-2 overflow-x-auto px-4 py-4">
            {images.map((img, i) => (
              <button key={img.id} onClick={() => setOpen(i)} aria-label={`Photo ${i + 1}`} className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-2 ${i === open ? 'ring-white' : 'ring-transparent opacity-60 hover:opacity-100'}`}>
                <Image src={img.cloudinaryUrl} alt="" fill sizes="80px" className="object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
