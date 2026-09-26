'use client';

// Leaflet touches `window` at import time — load via next/dynamic({ ssr: false }).
import 'leaflet/dist/leaflet.css';
import { Circle, MapContainer, TileLayer } from 'react-leaflet';

const TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ??
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Listing-detail location: an APPROXIMATE area circle (~400m), never an exact pin — the
// coordinates are geocoded from the locality name, and the privacy policy promises
// approximate locations only. Static (no scroll-zoom) so it never hijacks page scroll.
export default function LocationMap({ lat, lng }: { lat: number; lng: number }) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={14}
      scrollWheelZoom={false}
      dragging={false}
      doubleClickZoom={false}
      zoomControl={false}
      attributionControl
      className="h-full w-full"
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      <Circle
        center={[lat, lng]}
        radius={400}
        pathOptions={{ color: '#2563EB', weight: 2, fillColor: '#2563EB', fillOpacity: 0.15 }}
      />
    </MapContainer>
  );
}
