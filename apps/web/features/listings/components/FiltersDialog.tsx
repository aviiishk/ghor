'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { AMENITIES, amenityLabel } from '../amenities';
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

// Edits a draft; nothing refetches until "Show results". Same filters drive List and Map.
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

  // Re-sync the draft each time the dialog opens, so Cancel really discards edits.
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  if (!open) return null;

  function toggle(list: 'amenities' | 'institutionIds', key: string) {
    setDraft((d) => ({
      ...d,
      [list]: d[list].includes(key) ? d[list].filter((k) => k !== key) : [...d[list], key],
    }));
  }

  const rentInvalid =
    draft.rentMin != null && draft.rentMax != null && draft.rentMin > draft.rentMax;

  const chip = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-semibold ${
      active ? 'bg-primary text-white' : 'bg-surface text-ink'
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="filters-title"
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-hairline">
          <h2 id="filters-title" className="text-lg font-bold text-ink">
            Filters
          </h2>
          <button onClick={onClose} aria-label="Close filters" className="p-1 text-muted hover:text-ink">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 flex flex-col gap-7">
          <section>
            <h3 className="text-sm font-semibold text-ink mb-3">Monthly rent</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {RENT_PRESETS.map((p) => {
                const active = draft.rentMin === p.min && draft.rentMax === p.max;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() =>
                      setDraft((d) =>
                        active
                          ? { ...d, rentMin: undefined, rentMax: undefined }
                          : { ...d, rentMin: p.min, rentMax: p.max },
                      )
                    }
                    className={chip(active)}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3">
              <label className="flex-1">
                <span className="sr-only">Minimum rent</span>
                <input
                  inputMode="numeric"
                  placeholder="Min ₹"
                  value={draft.rentMin ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, rentMin: toInt(e.target.value) }))}
                  className="w-full border border-hairline rounded-xl px-4 py-2.5 text-ink"
                />
              </label>
              <span className="text-muted">–</span>
              <label className="flex-1">
                <span className="sr-only">Maximum rent</span>
                <input
                  inputMode="numeric"
                  placeholder="Max ₹"
                  value={draft.rentMax ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, rentMax: toInt(e.target.value) }))}
                  className="w-full border border-hairline rounded-xl px-4 py-2.5 text-ink"
                />
              </label>
            </div>
            {rentInvalid && (
              <p className="text-destructive text-sm mt-2">Minimum is higher than maximum.</p>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-ink mb-1">Amenities</h3>
            <p className="text-xs text-muted mb-3">Show places that have all of these.</p>
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle('amenities', key)}
                  className={chip(draft.amenities.includes(key))}
                >
                  {amenityLabel(key)}
                </button>
              ))}
            </div>
          </section>

          {/* Hidden until the founder seeds the curated institutions list (root CLAUDE.md
              §2) — an empty "Near" section would just look broken. */}
          {!!institutions?.length && (
            <section>
              <h3 className="text-sm font-semibold text-ink mb-1">Near</h3>
              <p className="text-xs text-muted mb-3">Show places near any of these.</p>
              <div className="flex flex-wrap gap-2">
                {institutions.map((inst) => (
                  <button
                    key={inst.id}
                    type="button"
                    onClick={() => toggle('institutionIds', inst.id)}
                    className={chip(draft.institutionIds.includes(inst.id))}
                  >
                    {inst.name}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-hairline">
          <button
            type="button"
            onClick={() => setDraft(EMPTY_FILTERS)}
            className="text-ink font-semibold underline"
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
            className="bg-primary text-white font-semibold rounded-full px-6 py-3 disabled:opacity-50"
          >
            Show results
          </button>
        </div>
      </div>
    </div>
  );
}
