'use client';

import type { ReactNode } from 'react';
import { AlertCircle, Building2, Check, GraduationCap, Home } from 'lucide-react';
import { AMENITIES, amenityIcon, amenityLabel } from '../amenities';
import type { Institution } from '@/features/institutions/api';

// Shared form pieces for Create (wizard) and Edit (single page) — one implementation of
// each so the two flows can't drift apart visually.

export const inputClass =
  'w-full rounded-xl bg-white px-4 py-3.5 text-[16px] text-ink ring-1 ring-inset ring-hairline outline-none transition placeholder:text-muted-soft hover:ring-ink/25 focus:ring-2 focus:ring-primary';

// Pass `error` to show a field-level message; give the control
// aria-describedby={errorId(htmlFor)} so screen readers read it with the field.
export const errorId = (id?: string) => (id ? `${id}-error` : undefined);

export function Field({
  label,
  hint,
  htmlFor,
  optional = false,
  error,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  optional?: boolean;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 flex items-baseline gap-2 font-semibold text-navy">
        {label}
        {optional && <span className="text-sm font-normal text-muted">Optional</span>}
      </label>
      {children}
      {error && (
        <p id={errorId(htmlFor)} className="mt-2 flex items-start gap-1.5 text-sm font-medium text-destructive-pressed">
          <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden /> {error}
        </p>
      )}
      {hint && !error && <p className="mt-2 text-sm text-muted">{hint}</p>}
    </div>
  );
}

export function RupeeInput({
  id,
  value,
  onChange,
  placeholder,
  invalid = false,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display text-lg font-bold text-navy">₹</span>
      <input
        id={id}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId(id) : undefined}
        className={`${inputClass} pl-10 font-display text-lg font-bold ${invalid ? '!ring-2 !ring-destructive' : ''}`}
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
    { v: 'room' as const, label: 'A room', body: 'A private room in a house, flat or PG. Kitchen and other spaces may be shared.', icon: Home },
    { v: 'flat' as const, label: 'A whole flat', body: 'A complete apartment the renter has to themselves — 1RK, 1BHK or larger.', icon: Building2 },
  ];
  return (
    <div role="radiogroup" aria-label="Property type" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {options.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.v)}
            className={`press relative flex gap-4 rounded-2xl p-5 text-left ring-inset transition sm:flex-col ${
              active ? 'bg-primary-light ring-2 ring-primary' : 'bg-white ring-1 ring-hairline hover:ring-ink/30'
            }`}
          >
            <span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-primary text-white' : 'bg-cream-deep text-navy'}`}>
              <o.icon size={24} aria-hidden />
            </span>
            <span className="pr-6 sm:pr-0">
              <span className="block font-display text-lg font-bold text-navy">{o.label}</span>
              <span className="mt-1 block text-sm leading-5 text-muted">{o.body}</span>
            </span>
            <span
              className={`absolute right-4 top-4 inline-flex h-6 w-6 items-center justify-center rounded-full ring-inset ${active ? 'bg-primary text-white' : 'ring-2 ring-hairline'}`}
              aria-hidden
            >
              {active && <Check size={14} strokeWidth={3} />}
            </span>
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
            className={`press relative flex flex-col items-start gap-4 rounded-2xl p-4 text-left ring-inset transition ${
              active ? 'bg-primary-light ring-2 ring-primary' : 'bg-white ring-1 ring-hairline hover:ring-ink/30'
            }`}
          >
            <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${active ? 'bg-primary text-white' : 'bg-cream-deep text-navy'}`}>
              <Icon size={21} aria-hidden />
            </span>
            <span className="font-semibold text-navy">{amenityLabel(key)}</span>
            {active && (
              <span className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white" aria-hidden>
                <Check size={14} strokeWidth={3} />
              </span>
            )}
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
              className={`press inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ring-1 ring-inset ${
                active ? 'bg-navy text-white ring-navy' : 'bg-white text-ink ring-hairline hover:ring-ink/30'
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
