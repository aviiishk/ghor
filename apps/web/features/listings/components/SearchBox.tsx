'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Clock, MapPin, Search, TrendingUp, X } from 'lucide-react';
import type { PopularLocality } from '../api';
import { suggestLocalities } from '../localities';
import { cx, formatRent } from '@/components/ui';

// Browse search, redesign v2. Free text still runs the existing server-side search (title,
// locality, description); picking a suggestion sets the locality filter instead. The
// dropdown only shows things that are true: this device's recent searches, areas with real
// live listings (GET /listings/localities), and plain locality names.
const RECENT_KEY = 'ghor.recentSearches';

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 5) : [];
  } catch {
    return [];
  }
}
export function rememberSearch(term: string) {
  const t = term.trim();
  if (t.length < 2) return;
  try {
    const next = [t, ...readRecent().filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable (private mode) — recents are a convenience only
  }
}

type Option =
  | { kind: 'recent'; label: string }
  | { kind: 'popular'; label: string; meta: string }
  | { kind: 'locality'; label: string };

export function SearchBox({
  value,
  onChange,
  onSubmit,
  onPickLocality,
  popular,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (q: string) => void;
  onPickLocality: (locality: string) => void;
  popular: PopularLocality[] | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const wrap = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const options: Option[] = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) {
      return [
        ...recent.map((label) => ({ kind: 'recent' as const, label })),
        ...(popular ?? []).slice(0, 5).map((p) => ({
          kind: 'popular' as const,
          label: p.locality,
          meta: `${p.count} ${p.count === 1 ? 'home' : 'homes'} · from ${formatRent(p.minRent)}`,
        })),
      ];
    }
    const pop = (popular ?? []).filter((p) => p.locality.toLowerCase().includes(q));
    const popNames = new Set(pop.map((p) => p.locality.toLowerCase()));
    return [
      ...pop.slice(0, 4).map((p) => ({
        kind: 'popular' as const,
        label: p.locality,
        meta: `${p.count} ${p.count === 1 ? 'home' : 'homes'} · from ${formatRent(p.minRent)}`,
      })),
      ...suggestLocalities(q)
        .filter((l) => !popNames.has(l.toLowerCase()))
        .map((label) => ({ kind: 'locality' as const, label })),
    ].slice(0, 7);
  }, [value, recent, popular]);

  function pick(o: Option) {
    setOpen(false);
    setActive(-1);
    rememberSearch(o.label);
    if (o.kind === 'recent') {
      onChange(o.label);
      onSubmit(o.label);
    } else {
      onChange('');
      onPickLocality(o.label);
    }
  }

  const showList = open && options.length > 0;

  return (
    <div ref={wrap} className="relative">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (showList && active >= 0 && options[active]) return pick(options[active]!);
          rememberSearch(value);
          setOpen(false);
          onSubmit(value.trim());
        }}
        className={cx(
          'flex h-16 items-center gap-3 rounded-2xl bg-white pl-5 pr-2 ring-1 ring-inset transition-shadow focus-within:ring-2 focus-within:ring-primary',
          open ? 'shadow-float ring-navy/15' : 'shadow-lift ring-navy/[0.08]',
        )}
      >
        <Search size={21} className="shrink-0 text-navy" aria-hidden />
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onFocus={() => {
            setRecent(readRecent());
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            if (!showList) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i) => (i + 1) % options.length);
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
            }
          }}
          placeholder="Search a locality, landmark or college"
          aria-label="Search homes"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          className="min-w-0 flex-1 bg-transparent text-base font-medium text-ink outline-none placeholder:font-normal placeholder:text-muted"
        />
        {value && (
          <button type="button" onClick={() => { onChange(''); setOpen(false); setActive(-1); }} aria-label="Clear search" className="rounded-full p-2 text-muted hover:bg-surface hover:text-ink">
            <X size={18} />
          </button>
        )}
        <button type="submit" className="press hidden h-12 shrink-0 rounded-xl bg-primary px-7 text-sm font-bold text-white hover:bg-primary-pressed sm:block">
          Search
        </button>
      </form>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+8px)] z-40 max-h-[60vh] overflow-y-auto rounded-2xl bg-white p-2 shadow-float ring-1 ring-navy/[0.08]"
        >
          {options.map((o, i) => {
            const Icon = o.kind === 'recent' ? Clock : o.kind === 'popular' ? TrendingUp : MapPin;
            const heading =
              i === 0 || options[i - 1]!.kind !== o.kind
                ? o.kind === 'recent'
                  ? 'Recent searches'
                  : o.kind === 'popular'
                    ? 'Areas with homes on GHOR'
                    : 'Localities'
                : null;
            return (
              <li key={`${o.kind}-${o.label}`} role="presentation">
                {heading && <p className="px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-wider text-muted first:pt-1">{heading}</p>}
                <button
                  id={`${listId}-${i}`}
                  type="button"
                  role="option"
                  aria-selected={active === i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o)}
                  className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left', active === i && 'bg-cream')}
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cream-deep text-navy">
                    <Icon size={17} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">{o.label}</span>
                    {o.kind === 'popular' && <span className="block text-xs text-muted">{o.meta}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
