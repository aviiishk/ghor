'use client';

import { Fragment, useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/overlay';
import { buttonClass } from '@/components/ui';
import { AMENITIES, amenityIcon, amenityLabel } from '../amenities';
import { useInstitutions } from '@/features/institutions/hooks';

export type ExtraFilters = {
  rentMin?: number;
  rentMax?: number;
  amenities: string[];
  institutionIds: string[];
};

export const EMPTY_FILTERS: ExtraFilters = { amenities: [], institutionIds: [] };

export function countActiveFilters(f: ExtraFilters): number {
  return (
    (f.rentMin != null || f.rentMax != null ? 1 : 0) + f.amenities.length + f.institutionIds.length
  );
}

const RENT_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: 'Under ₹5k', max: 5000 },
  { label: '₹5k–10k', min: 5000, max: 10000 },
  { label: '₹10k–20k', min: 10000, max: 20000 },
  { label: '₹20k+', min: 20000 },
];

function toInt(value: string): number | undefined {
  const n = parseInt(value.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : undefined;
}

// Redesign v2 (2026-09-27): a bottom sheet on phones (near full height, grab handle,
// safe-area footer), a centred modal on larger screens. Edits a draft; nothing refetches
// until "Show homes". The same filters drive List and Map.
export function FiltersDialog({
  open,
  value,
  onApply,
  onClose,
}: {
  open: boolean;
  value: ExtraFilters;
  onApply: (next: ExtraFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<ExtraFilters>(value);
  const { data: institutions } = useInstitutions('');

  // Re-sync the draft each time the dialog opens, so closing really discards edits.
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  function toggle(list: 'amenities' | 'institutionIds', key: string) {
    setDraft((d) => ({
      ...d,
      [list]: d[list].includes(key) ? d[list].filter((k) => k !== key) : [...d[list], key],
    }));
  }

  const rentInvalid =
    draft.rentMin != null && draft.rentMax != null && draft.rentMin > draft.rentMax;
  const draftCount = countActiveFilters(draft);

  const pill = (active: boolean) =>
    `press h-10 rounded-full px-4 text-sm font-semibold ring-1 ring-inset transition-colors ${
      active ? 'bg-navy text-white ring-navy' : 'bg-white text-ink ring-hairline hover:ring-ink/30'
    }`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Filters"
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setDraft(EMPTY_FILTERS)}
            disabled={!draftCount}
            className="rounded-lg px-1 font-semibold text-ink underline underline-offset-4 disabled:text-muted-soft disabled:no-underline"
          >
            Clear all
          </button>
          <button
            type="button"
            disabled={rentInvalid}
            onClick={() => {
              onApply(draft);
              onClose();
            }}
            className={buttonClass('navy', 'lg')}
          >
            Show homes{draftCount ? ` · ${draftCount} filter${draftCount === 1 ? '' : 's'}` : ''}
          </button>
        </div>
      }
    >
      <div className="-mt-3 divide-y divide-hairline-soft">
          <section className="py-6">
            <h3 className="font-display text-lg font-bold text-navy">Monthly rent</h3>
            <p className="mt-0.5 text-sm text-muted">Pick a range or type your own.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {RENT_PRESETS.map((p) => {
                const active = draft.rentMin === p.min && draft.rentMax === p.max;
                return (
                  <button
                    key={p.label}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setDraft((d) =>
                        active
                          ? { ...d, rentMin: undefined, rentMax: undefined }
                          : { ...d, rentMin: p.min, rentMax: p.max },
                      )
                    }
                    className={pill(active)}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex items-center gap-3">
              {(['rentMin', 'rentMax'] as const).map((k, i) => (
                <Fragment key={k}>
                  {i === 1 && <span className="text-muted" aria-hidden>–</span>}
                  <label className="block flex-1 rounded-xl px-4 py-2 ring-1 ring-inset ring-hairline focus-within:ring-2 focus-within:ring-primary">
                    <span className="block text-xs font-semibold text-muted">{k === 'rentMin' ? 'Minimum' : 'Maximum'}</span>
                    <span className="flex items-center gap-1 text-ink">
                      ₹
                      <input
                        inputMode="numeric"
                        placeholder={k === 'rentMin' ? 'No min' : 'No max'}
                        value={draft[k] ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, [k]: toInt(e.target.value) }))}
                        className="w-full bg-transparent py-0.5 font-semibold outline-none placeholder:font-normal placeholder:text-muted-soft"
                      />
                    </span>
                  </label>
                </Fragment>
              ))}
            </div>
            {rentInvalid && <p className="mt-2 text-sm text-destructive-pressed">Minimum is higher than maximum.</p>}
          </section>

          <section className="py-6">
            <h3 className="font-display text-lg font-bold text-navy">Amenities</h3>
            <p className="mt-0.5 text-sm text-muted">Show places that have all of these.</p>
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {AMENITIES.map((key) => {
                const Icon = amenityIcon(key);
                const active = draft.amenities.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggle('amenities', key)}
                    className={`press flex items-center gap-2.5 rounded-xl p-3 text-left text-sm font-semibold ring-inset transition ${
                      active ? 'bg-primary-light text-navy ring-2 ring-primary' : 'bg-white text-ink ring-1 ring-hairline hover:ring-ink/30'
                    }`}
                  >
                    <Icon size={18} className={active ? 'text-primary' : 'text-muted'} aria-hidden />
                    {amenityLabel(key)}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Hidden until the founder seeds the curated institutions list (root CLAUDE.md
              §2) — an empty "Near" section would just look broken. */}
          {!!institutions?.length && (
            <section className="py-6">
              <h3 className="font-display text-lg font-bold text-navy">Near a college or school</h3>
              <p className="mt-0.5 text-sm text-muted">Show places near any of these.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {institutions.map((inst) => (
                  <button
                    key={inst.id}
                    type="button"
                    aria-pressed={draft.institutionIds.includes(inst.id)}
                    onClick={() => toggle('institutionIds', inst.id)}
                    className={pill(draft.institutionIds.includes(inst.id))}
                  >
                    {inst.name}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
    </Dialog>
  );
}
