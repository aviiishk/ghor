'use client';

import { useState, type ReactNode } from 'react';
import { BadgeCheck, BedDouble, Building2, CalendarDays, IndianRupee, MapPin, ShieldCheck, Wallet, Zap } from 'lucide-react';
import type { ApprovalInfo } from '../approval';
import { amenityIcon, amenityLabel } from '../amenities';
import { cx, formatRent } from '@/components/ui';

// The building blocks of a listing page, shared by Listing Detail and the create-listing
// Preview step (redesign v2) so an owner previews exactly what renters will see — same
// components, not a lookalike.

export function formatAvailable(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.getTime() <= Date.now() ? 'Available now' : `From ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export function DetailSection({ title, id, children, className }: { title: string; id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cx('scroll-mt-24 border-t border-navy/[0.08] py-10', className)}>
      <h2 className="font-display text-[1.6rem] font-bold tracking-[-0.025em] text-navy">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function ListingHeadline({
  title,
  propertyType,
  locality,
  city,
  approval,
  propertyVerified,
  rating,
}: {
  title: string;
  propertyType: 'room' | 'flat';
  locality: string;
  city: string;
  approval?: ApprovalInfo | null;
  propertyVerified?: boolean;
  rating?: ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-navy px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-white">{propertyType}</span>
        {approval && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${approval.automatic ? 'bg-primary-light text-navy' : 'bg-success-pale text-success-deep'}`}
            title={approval.description}
          >
            {approval.automatic ? <Zap size={13} strokeWidth={2.5} aria-hidden /> : <ShieldCheck size={13} strokeWidth={2.5} aria-hidden />} {approval.label}
          </span>
        )}
        {propertyVerified && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success-pale px-2.5 py-1 text-xs font-bold text-success-deep">
            <BadgeCheck size={13} strokeWidth={2.5} aria-hidden /> Property verified
          </span>
        )}
        {rating}
      </div>
      <h1 className="mt-4 font-display text-[clamp(2rem,3.6vw,3rem)] font-bold leading-[1.05] tracking-[-0.03em] text-navy">{title}</h1>
      <p className="mt-3 flex items-center gap-1.5 text-lg text-body">
        <MapPin size={19} className="shrink-0 text-primary" aria-hidden /> {locality}, {city}
      </p>
    </div>
  );
}

export function KeyFacts({
  propertyType,
  rent,
  deposit,
  availableFrom,
  columns = 4,
}: {
  propertyType: 'room' | 'flat';
  rent: number;
  deposit: number | null | undefined;
  availableFrom: string | null | undefined;
  /** 2 in narrow containers (the create-listing preview). */
  columns?: 2 | 4;
}) {
  const four = columns === 4;
  const facts = [
    { icon: propertyType === 'room' ? BedDouble : Building2, label: 'Type', value: propertyType === 'room' ? 'Private room' : 'Whole flat' },
    { icon: IndianRupee, label: 'Rent', value: `${formatRent(rent)}/mo` },
    { icon: Wallet, label: 'Deposit', value: deposit != null ? formatRent(deposit) : 'Ask owner' },
    { icon: CalendarDays, label: 'Move-in', value: formatAvailable(availableFrom) ?? 'Ask owner' },
  ];
  return (
    <dl className={cx('mt-8 grid grid-cols-2 overflow-hidden rounded-2xl bg-white ring-1 ring-inset ring-navy/[0.08]', four && 'sm:grid-cols-4')}>
      {facts.map((f, i) => (
        <div
          key={f.label}
          className={cx(
            'p-5',
            i % 2 === 1 && 'border-l border-navy/[0.08]',
            i >= 2 && cx('border-t border-navy/[0.08]', four && 'sm:border-t-0'),
            i === 2 && four && 'sm:border-l',
          )}
        >
          <f.icon size={20} className="text-primary" aria-hidden />
          <dt className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted">{f.label}</dt>
          <dd className="mt-0.5 font-display text-lg font-bold text-navy">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AboutText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 420;
  return (
    <div>
      <p className={cx('whitespace-pre-line text-[17px] leading-8 text-body', long && !open && 'line-clamp-6')}>{text}</p>
      {long && (
        <button onClick={() => setOpen((o) => !o)} className="mt-3 font-semibold text-navy underline underline-offset-4">
          {open ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}

export function AmenityList({ amenities }: { amenities: string[] }) {
  return (
    <ul className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
      {amenities.map((key) => {
        const Icon = amenityIcon(key);
        return (
          <li key={key} className="flex items-center gap-4">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
              <Icon size={21} aria-hidden />
            </span>
            <span className="text-[17px] font-semibold text-ink">{amenityLabel(key)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function PriceHeading({ rent, deposit }: { rent: number; deposit: number | null | undefined }) {
  return (
    <div>
      <p className="font-display leading-none text-navy">
        <span className="text-[2.6rem] font-bold tracking-[-0.03em]">{formatRent(rent)}</span>
        <span className="ml-1 text-base font-medium text-muted">/month</span>
      </p>
      <p className="mt-2 text-sm text-muted">{deposit != null ? `Security deposit ${formatRent(deposit)}` : 'Deposit: ask the owner'}</p>
    </div>
  );
}
