'use client';

// Leaflet touches `window` at import time, so this module must only ever be loaded
// client-side — import it via next/dynamic with { ssr: false } (see browse/page.tsx).
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import { X } from 'lucide-react';
import type { MapPin } from '../api';

// Guwahati — the only launch city (root CLAUDE.md §2).
const DEFAULT_CENTER: [number, number] = [26.1445, 91.7362];
const DEFAULT_ZOOM = 12;

// OSM's public tiles are fine for dev/low traffic but their tile usage policy forbids
// heavy production use — point NEXT_PUBLIC_MAP_TILE_URL at a real provider (MapTiler,
// Stadia, etc.) before launch. Attribution is legally required by OSM's licence.
const TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ??
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function formatRentShort(rent: number): string {
  if (rent < 1000) return `₹${rent}`;
  const k = rent / 1000;
  return `₹${Number.isInteger(k) ? k : k.toFixed(1)}k`;
}

// DESIGN.md `map-pin` / `map-pin-active`: rent pill, ink fill, primary when its preview
// card is open. Styles live in globals.css (.ghor-pin) since divIcon HTML sits outside
// React's tree.
function pinIcon(rent: number, active: boolean) {
  return L.divIcon({
    className: '',
    html: `<span class="ghor-pin${active ? ' ghor-pin--active' : ''}">${formatRentShort(rent)}</span>`,
    // Zero-size anchor at the coordinate; .ghor-pin centres itself on it with a
    // translate, so pills of any width ("₹5k" vs "₹12.5k") sit exactly on the point.
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

// Fit the viewport to the current pin set whenever the filtered set changes, and again
// when the container is resized (phone rotation, desktop window resize).
function FitToPins({ pins }: { pins: MapPin[] }) {
  const map = useMap();
  const [size, setSize] = useState(0);
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => setSize(el.clientWidth * 10000 + el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  const key = `${pins.map((p) => p.id).join(',')}@${size}`;
  useEffect(() => {
    // Leaflet caches the container size; a layout change (rotation, window resize,
    // the tab switching from hidden) leaves the viewport stale until told.
    map.invalidateSize();
    if (!pins.length) return;
    if (pins.length === 1) {
      map.setView([pins[0].latitude, pins[0].longitude], 15);
      return;
    }
    map.fitBounds(
      L.latLngBounds(pins.map((p) => [p.latitude, p.longitude])),
      { padding: [48, 48], maxZoom: 15 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

export default function ListingsMap({
  pins,
  activeId,
  onSelect,
  highlightId = null,
  className = 'h-[70vh] min-h-[420px] rounded-2xl',
}: {
  pins: MapPin[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  /** A card hovered in the split-view list — its pin lights up without opening a preview. */
  highlightId?: string | null;
  className?: string;
}) {
  const active = useMemo(() => pins.find((p) => p.id === activeId) ?? null, [pins, activeId]);

  return (
    <div className={`relative isolate overflow-hidden ring-1 ring-inset ring-navy/[0.08] ${className}`}>
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <FitToPins pins={pins} />
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            position={[pin.latitude, pin.longitude]}
            icon={pinIcon(pin.rent, pin.id === activeId || pin.id === highlightId)}
            zIndexOffset={pin.id === activeId || pin.id === highlightId ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(pin.id) }}
            title={`${pin.title}, ${formatRentShort(pin.rent)} per month`}
          />
        ))}
      </MapContainer>

      {/* DESIGN.md `map-preview-card`: photo + price + title. */}
      {active && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000] sm:right-auto sm:w-[340px]">
          <div className="relative overflow-hidden rounded-2xl bg-white shadow-float">
            <button
              onClick={() => onSelect(null)}
              aria-label="Close preview"
              className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-sm"
            >
              <X size={16} className="text-ink" />
            </button>
            <Link href={`/listing/${active.id}`} className="flex">
              <div className="relative w-32 shrink-0 bg-cream-deep">
                {active.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={active.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full min-h-24 items-center justify-center text-xs text-muted">No photo</div>
                )}
              </div>
              <div className="min-w-0 p-3.5 pr-10">
                <p className="font-display text-xl font-bold leading-none text-navy">
                  ₹{active.rent.toLocaleString('en-IN')}
                  <span className="text-xs font-medium text-muted">/month</span>
                </p>
                <p className="mt-1.5 line-clamp-2 text-sm font-semibold text-ink">{active.title}</p>
                <p className="mt-1 truncate text-xs text-muted">{active.locality} · approximate area</p>
              </div>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
