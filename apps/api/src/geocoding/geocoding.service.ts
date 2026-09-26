import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type Coordinates = { latitude: number; longitude: number };

// Per-city search box (minLon, maxLat, maxLon, minLat — Nominatim's viewbox order).
// Querying the bare locality *bounded* to the city resolves far better than a free-text
// "locality, city, state" string (tested 2026-09-25: "Ganeshguri, Guwahati, Assam, India"
// → no match; "Ganeshguri" bounded to Guwahati → the right suburb), and it can't land on a
// same-named place in another state. Add a row here when expanding to a new city.
const CITY_VIEWBOX: Record<string, string> = {
  guwahati: '91.55,26.25,91.95,26.00',
};

const MIN_INTERVAL_MS = 1100; // Nominatim usage policy: max 1 request/second.
const CACHE_MAX = 2000;

// Server-side geocoding for the map view (root CLAUDE.md §2 "Map view"). Owners only ever
// type a locality name; coordinates are derived here, never client-supplied. Defaults to
// OpenStreetMap's public Nominatim, whose usage policy requires an identifying
// User-Agent, ≤1 req/s, and caching — fine at GHOR's volume (one lookup per listing
// create/locality change), but switch GEOCODER_URL to a paid Nominatim-compatible
// provider (LocationIQ, MapTiler, self-hosted) before real scale.
@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly email?: string;
  private readonly enabled: boolean;
  private readonly cache = new Map<string, Coordinates | null>();
  // Serializes every outbound request so concurrent listing saves still respect the
  // 1 req/s limit — each call chains onto the previous one's completion.
  private queue: Promise<unknown> = Promise.resolve();
  private lastRequestAt = 0;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>(
      'GEOCODER_URL',
      'https://nominatim.openstreetmap.org',
    );
    this.userAgent = config.get<string>(
      'GEOCODER_USER_AGENT',
      'GHOR/1.0 (+https://ghor.co.in)',
    );
    this.email = config.get<string>('GEOCODER_EMAIL') || undefined;
    this.enabled = config.get<string>('GEOCODER_ENABLED', 'true') !== 'false';
  }

  // Never throws — a failed lookup just means "no pin", the listing still works in list
  // view (root CLAUDE.md §6: latitude/longitude are nullable for exactly this reason).
  async geocode(
    locality: string,
    city: string,
    state: string,
  ): Promise<Coordinates | null> {
    if (!this.enabled) return null;
    const key = `${locality}|${city}|${state}`.trim().toLowerCase();
    if (this.cache.has(key)) return this.cache.get(key)!;

    const viewbox = CITY_VIEWBOX[city.trim().toLowerCase()];
    const attempts: { q: string; viewbox?: string }[] = viewbox
      ? [
          { q: locality, viewbox },
          { q: `${locality}, ${city}`, viewbox },
        ]
      : [{ q: `${locality}, ${city}, ${state}, India` }];

    let result: Coordinates | null = null;
    try {
      for (const attempt of attempts) {
        result = await this.enqueue(() =>
          this.search(attempt.q, attempt.viewbox),
        );
        if (result) break;
      }
    } catch (e) {
      // Network/HTTP failure: don't cache, so a later edit can retry.
      this.logger.warn(
        `Geocoding failed for "${key}": ${(e as Error).message}`,
      );
      return null;
    }

    if (this.cache.size >= CACHE_MAX) {
      this.cache.delete(this.cache.keys().next().value!);
    }
    this.cache.set(key, result);
    return result;
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = async () => {
      const wait = this.lastRequestAt + MIN_INTERVAL_MS - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      try {
        return await task();
      } finally {
        this.lastRequestAt = Date.now();
      }
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async search(
    q: string,
    viewbox?: string,
  ): Promise<Coordinates | null> {
    const params = new URLSearchParams({
      q,
      format: 'jsonv2',
      limit: '1',
      countrycodes: 'in',
    });
    if (viewbox) {
      params.set('viewbox', viewbox);
      params.set('bounded', '1');
    }
    if (this.email) params.set('email', this.email);

    const res = await fetch(`${this.baseUrl}/search?${params}`, {
      headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = (await res.json()) as { lat: string; lon: string }[];
    if (!rows.length) return null;
    const latitude = Number(rows[0].lat);
    const longitude = Number(rows[0].lon);
    return Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { latitude, longitude }
      : null;
  }
}
