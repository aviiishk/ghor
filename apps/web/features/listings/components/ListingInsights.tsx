'use client';

import { useState } from 'react';
import { useListingInsights } from '../hooks';
import type { ListingInsights as Insights } from '../api';

// Root CLAUDE.md §2 "Owner insights" — owner-only, rendered on their own listing's detail
// page. Chart follows the dataviz method: stat tiles for the headline numbers, ONE
// single-series column chart (daily views, primary blue — validated ≥3:1 on white) with
// no legend (the title names it), per-bar hover/focus tooltips that also carry that
// day's inquiries (a different scale → tooltip + tiles, never a second axis), and a
// table view so nothing is gated behind hover.

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function compact(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n);
}

function shortDate(iso: string): string {
  // iso is an IST calendar date; noon UTC keeps it on the same day in any locale.
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

// Clean y-axis max: 1, 2, 5 × 10^n at or above the data max.
function niceMax(max: number): number {
  if (max <= 4) return Math.max(max, 1);
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 5, 10]) if (m * pow >= max) return m * pow;
  return 10 * pow;
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white border border-hairline rounded-2xl px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-semibold text-ink mt-0.5">{value}</p>
      {hint && <p className="text-xs text-muted-soft mt-0.5">{hint}</p>}
    </div>
  );
}

function ViewsChart({ daily }: { daily: Insights['daily'] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(...daily.map((d) => d.views)));
  const ticks = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, max / 2, max];
  const hovered = active != null ? daily[active] : null;

  return (
    <div>
      <div className="flex gap-2">
        {/* Y-axis ticks — text tokens, never the series color. */}
        <div className="relative h-40 w-6 shrink-0 text-[10px] text-muted-soft">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `${100 - (t / max) * 100}%` }}
            >
              {compact(t)}
            </span>
          ))}
        </div>

        <div className="relative flex-1 h-40">
          {/* Recessive 1px solid gridlines, one step off surface. */}
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute inset-x-0 border-t border-hairline-soft"
              style={{ top: `${100 - (t / max) * 100}%` }}
            />
          ))}

          {/* 30 columns, 2px gap (surface separates touching bars), ≤24px thick. */}
          <div
            className="absolute inset-0 grid items-end"
            style={{ gridTemplateColumns: `repeat(${daily.length}, minmax(0, 1fr))`, columnGap: 2 }}
            onMouseLeave={() => setActive(null)}
          >
            {daily.map((d, i) => (
              <button
                key={d.date}
                type="button"
                // The whole column slot is the hit target, not just the (maybe 0px) bar.
                className="h-full flex items-end justify-center outline-none focus-visible:bg-primary-light rounded-sm"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                aria-label={`${shortDate(d.date)}: ${d.views} ${plural(d.views, 'view', 'views')}, ${d.inquiries} ${plural(d.inquiries, 'inquiry', 'inquiries')}`}
              >
                <span
                  className={`block w-full max-w-6 rounded-t ${
                    active === i ? 'bg-primary-pressed' : 'bg-primary'
                  }`}
                  // Zero-view days stay a hairline stub so the day still reads as "0", not missing.
                  style={{ height: d.views ? `${(d.views / max) * 100}%` : 1, opacity: d.views ? 1 : 0.35 }}
                />
              </button>
            ))}
          </div>

          {hovered && active != null && (
            <div
              role="status"
              className="pointer-events-none absolute -top-2 z-10 bg-white border border-hairline rounded-xl shadow-sheet px-3 py-2 text-xs whitespace-nowrap"
              style={{
                left: `${((active + 0.5) / daily.length) * 100}%`,
                transform: `translate(${active > daily.length * 0.7 ? '-100%' : active < daily.length * 0.3 ? '0' : '-50%'}, -100%)`,
              }}
            >
              <p className="text-muted mb-1">{shortDate(hovered.date)}</p>
              <p className="flex items-center gap-2">
                <span className="inline-block w-3 h-0.5 bg-primary" aria-hidden />
                <strong className="text-ink">{hovered.views}</strong>
                <span className="text-muted">{plural(hovered.views, 'view', 'views')}</span>
              </p>
              <p className="text-muted mt-0.5">
                <strong className="text-ink">{hovered.inquiries}</strong>{' '}
                {plural(hovered.inquiries, 'inquiry', 'inquiries')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* X-axis: first / middle / last dates only. */}
      <div className="flex justify-between pl-8 mt-1.5 text-[10px] text-muted-soft">
        <span>{shortDate(daily[0].date)}</span>
        <span>{shortDate(daily[Math.floor(daily.length / 2)].date)}</span>
        <span>Today</span>
      </div>

      <details className="mt-3">
        <summary className="text-xs text-muted cursor-pointer select-none">Show as table</summary>
        <div className="max-h-56 overflow-y-auto mt-2 border border-hairline rounded-xl">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-muted text-xs">
              <tr>
                <th className="text-left font-semibold px-3 py-2">Date</th>
                <th className="text-right font-semibold px-3 py-2">Views</th>
                <th className="text-right font-semibold px-3 py-2">Inquiries</th>
              </tr>
            </thead>
            <tbody>
              {[...daily].reverse().map((d) => (
                <tr key={d.date} className="border-t border-hairline-soft">
                  <td className="px-3 py-1.5 text-ink">{shortDate(d.date)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-ink">{d.views}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-ink">{d.inquiries}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function ListingInsights({ listingId }: { listingId: string }) {
  const { data, isLoading, isError } = useListingInsights(listingId, true);

  return (
    <section className="mt-12 border-t border-hairline pt-8">
      <div className="flex items-baseline justify-between gap-3 mb-5">
        <h2 className="text-xl font-semibold text-ink">Insights</h2>
        <span className="text-xs text-muted">Only you can see this</span>
      </div>

      {isLoading ? (
        <div className="h-40 rounded-2xl bg-surface animate-pulse" />
      ) : isError || !data ? (
        <p className="text-muted">Couldn&apos;t load insights right now.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatTile
              label="Views"
              value={compact(data.totals.views)}
              hint={`${compact(data.totals.uniqueViewers)} ${plural(data.totals.uniqueViewers, 'person', 'people')}`}
            />
            <StatTile label="Call / chat taps" value={compact(data.totals.contactTaps)} />
            <StatTile
              label="Inquiries"
              value={compact(data.totals.inquiries)}
              hint="people who messaged"
            />
            <StatTile
              label="Response rate"
              value={data.totals.responseRate != null ? `${data.totals.responseRate}%` : '—'}
              hint={data.totals.inquiries ? `${data.totals.replied} replied` : 'no inquiries yet'}
            />
          </div>

          <h3 className="text-sm font-semibold text-ink">Views per day</h3>
          <p className="text-xs text-muted mb-3">
            Last 30 days · {data.last30.views} {plural(data.last30.views, 'view', 'views')},{' '}
            {data.last30.inquiries} {plural(data.last30.inquiries, 'inquiry', 'inquiries')}
          </p>
          <ViewsChart daily={data.daily} />
        </>
      )}
    </section>
  );
}
