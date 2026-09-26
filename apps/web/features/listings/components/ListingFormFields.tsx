'use client';

import type { ReactNode } from 'react';
import { Building2, Check, GraduationCap, Home } from 'lucide-react';
import { AMENITIES, amenityIcon, amenityLabel } from '../amenities';
import type { Institution } from '@/features/institutions/api';

// Shared form pieces for Create (wizard) and Edit (single page) — one implementation of
// each so the two flows can't drift apart visually.

export const inputClass =
  'w-full rounded-2xl bg-white px-4 py-3.5 text-ink ring-1 ring-hairline outline-none transition placeholder:text-muted-soft focus:ring-2 focus:ring-primary';

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-bold text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function RupeeInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-muted">₹</span>
      <input
        id={id}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
        placeholder={placeholder}
        className={`${inputClass} pl-9`}
      />
    </div>
  );
}

export function TypePicker({
  value,
  onChange,
}: {
  value: 'room' | 'flat';
  onChange: (v: 'room' | 'flat') => void;
}) {
  const options = [
    { v: 'room' as const, label: 'Room', body: 'A room in a house or PG', icon: Home },
    { v: 'flat' as const, label: 'Flat', body: 'A whole apartment', icon: Building2 },
  ];
  return (
    <div role="radiogroup" aria-label="Property type" className="grid grid-cols-2 gap-3">
      {options.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.v)}
            className={`press relative rounded-2xl p-4 text-left ring-2 transition ${
              active ? 'bg-primary-light ring-primary' : 'bg-white ring-hairline hover:ring-ink/20'
            }`}
          >
            <o.icon size={24} className={active ? 'text-primary' : 'text-navy'} aria-hidden />
            <p className="mt-3 font-display font-bold text-ink">{o.label}</p>
            <p className="text-xs text-muted">{o.body}</p>
            {active && (
              <span className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                <Check size={14} aria-hidden />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function AmenityPicker({
  value,
  onToggle,
}: {
  value: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {AMENITIES.map((key) => {
        const Icon = amenityIcon(key);
        const active = value.includes(key);
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(key)}
            className={`press flex items-center gap-3 rounded-2xl p-3.5 text-left ring-2 transition ${
              active ? 'bg-primary-light ring-primary' : 'bg-white ring-hairline hover:ring-ink/20'
            }`}
          >
            <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-primary text-white' : 'bg-surface text-navy'}`}>
              <Icon size={20} aria-hidden />
            </span>
            <span className="text-sm font-bold text-ink">{amenityLabel(key)}</span>
          </button>
        );
      })}
    </div>
  );
}

// Curated list only (root CLAUDE.md §2) — renders nothing until institutions are seeded.
export function InstitutionPicker({
  institutions,
  value,
  onToggle,
}: {
  institutions: Institution[] | undefined;
  value: string[];
  onToggle: (id: string) => void;
}) {
  if (!institutions?.length) return null;
  return (
    <Field label="Nearby colleges and schools" hint="Renters can filter by these. Only tag places that are genuinely close.">
      <div className="flex flex-wrap gap-2">
        {institutions.map((inst) => {
          const active = value.includes(inst.id);
          return (
            <button
              key={inst.id}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(inst.id)}
              className={`press inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ring-1 ${
                active ? 'bg-navy text-white ring-navy' : 'bg-white text-ink ring-hairline'
              }`}
            >
              <GraduationCap size={15} aria-hidden /> {inst.name}
            </button>
          );
        })}
      </div>
    </Field>
  );
}
