// GHOR product UI kit (redesign 2026-09-26). One implementation of each primitive, used
// by every product screen — see root DESIGN.md "Components". Server-safe (no hooks), so
// both server and client components can import it.
import type { ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import { BadgeCheck, Clock, FileEdit, Home, ShieldCheck, XCircle, type LucideProps } from 'lucide-react';

type Icon = ComponentType<LucideProps>;
const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

// ---------------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------------

const BADGE_TONES = {
  neutral: 'bg-surface-sunken text-body',
  primary: 'bg-primary-light text-primary',
  success: 'bg-success-pale text-success-deep',
  warning: 'bg-warning-pale text-warning-deep',
  danger: 'bg-destructive-pale text-destructive-pressed',
  navy: 'bg-navy text-white',
  glass: 'glass-chip',
} as const;

export function Badge({
  tone = 'neutral',
  icon: IconCmp,
  children,
  className,
}: {
  tone?: keyof typeof BADGE_TONES;
  icon?: Icon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold leading-none whitespace-nowrap',
        BADGE_TONES[tone],
        className,
      )}
    >
      {IconCmp && <IconCmp size={13} strokeWidth={2.5} aria-hidden />}
      {children}
    </span>
  );
}

// "Verified by GHOR" = the listing passed moderation (status approved). DESIGN.md: green is
// reserved for verification — never decorative.
export function VerifiedBadge({ overlay = false }: { overlay?: boolean }) {
  return (
    <Badge tone={overlay ? 'glass' : 'success'} icon={ShieldCheck} className={overlay ? 'text-success-deep' : ''}>
      Verified by GHOR
    </Badge>
  );
}

export function PhoneVerifiedBadge() {
  return (
    <Badge tone="success" icon={BadgeCheck}>
      Phone verified
    </Badge>
  );
}

export type ListingStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'rented';

const STATUS: Record<ListingStatus, { tone: keyof typeof BADGE_TONES; label: string; icon: Icon }> = {
  draft: { tone: 'neutral', label: 'Draft', icon: FileEdit },
  pending: { tone: 'warning', label: 'In review', icon: Clock },
  approved: { tone: 'success', label: 'Live', icon: ShieldCheck },
  rejected: { tone: 'danger', label: 'Needs changes', icon: XCircle },
  rented: { tone: 'navy', label: 'Rented', icon: Home },
};

// One status grammar for owner screens and the admin queue (DESIGN.md "Status pills").
export function StatusBadge({ status }: { status: ListingStatus }) {
  const s = STATUS[status];
  return (
    <Badge tone={s.tone} icon={s.icon}>
      {s.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------------
// Price
// ---------------------------------------------------------------------------------

export function formatRent(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

// DESIGN.md: the rent is the one loud number. `lg` is reserved for listing detail.
export function PriceTag({
  amount,
  size = 'md',
  className,
}: {
  amount: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const num = { sm: 'text-base', md: 'text-xl', lg: 'text-4xl' }[size];
  const per = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' }[size];
  return (
    <span className={cx('inline-flex items-baseline gap-0.5 font-display', className)}>
      <span className={cx(num, 'font-bold tracking-tight text-ink')}>{formatRent(amount)}</span>
      <span className={cx(per, 'font-medium text-muted')}>/month</span>
    </span>
  );
}

// ---------------------------------------------------------------------------------
// Chip (filter / quick-filter)
// ---------------------------------------------------------------------------------

export function Chip({
  active = false,
  icon: IconCmp,
  children,
  onClick,
  className,
}: {
  active?: boolean;
  icon?: Icon;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'press inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 h-10 text-sm font-semibold transition-colors',
        active
          ? 'border-navy bg-navy text-white'
          : 'border-hairline bg-white text-ink hover:border-ink/30',
        className,
      )}
    >
      {IconCmp && <IconCmp size={16} aria-hidden />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------------

export function SectionHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <div className={cx('flex items-end justify-between gap-4 mb-4', className)}>
      <div className="min-w-0">
        <h2 className="text-xl sm:text-2xl font-bold text-ink">{title}</h2>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {action &&
        (action.href ? (
          <Link href={action.href} className="shrink-0 text-sm font-semibold text-primary hover:underline">
            {action.label}
          </Link>
        ) : (
          <button onClick={action.onClick} className="shrink-0 text-sm font-semibold text-primary hover:underline">
            {action.label}
          </button>
        ))}
    </div>
  );
}

export function IconTile({
  icon: IconCmp,
  tone = 'primary',
  size = 'md',
}: {
  icon: Icon;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'navy' | 'cream';
  size?: 'sm' | 'md' | 'lg';
}) {
  const tones = {
    primary: 'bg-primary-light text-primary',
    success: 'bg-success-pale text-success-deep',
    warning: 'bg-warning-pale text-warning-deep',
    danger: 'bg-destructive-pale text-destructive-pressed',
    navy: 'bg-navy text-white',
    cream: 'bg-cream-deep text-navy',
  };
  const box = { sm: 'w-9 h-9 rounded-xl', md: 'w-11 h-11 rounded-2xl', lg: 'w-16 h-16 rounded-3xl' }[size];
  const icon = { sm: 18, md: 20, lg: 28 }[size];
  return (
    <span className={cx('inline-flex shrink-0 items-center justify-center', box, tones[tone])}>
      <IconCmp size={icon} aria-hidden />
    </span>
  );
}

// Deterministic initials avatar — no profile images exist (root CLAUDE.md §2 cuts them).
const AVATAR_TONES = ['bg-primary text-white', 'bg-navy text-white', 'bg-primary-tint text-navy', 'bg-cream-deep text-navy'];
export function Avatar({ name, size = 'md' }: { name: string | null | undefined; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const label = (name ?? '').trim() || 'G';
  const initials = label
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  let h = 0;
  for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const box = { sm: 'w-8 h-8 text-xs', md: 'w-11 h-11 text-sm', lg: 'w-14 h-14 text-lg', xl: 'w-20 h-20 text-2xl' }[size];
  return (
    <span
      aria-hidden
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold', box, AVATAR_TONES[h % AVATAR_TONES.length])}
    >
      {initials}
    </span>
  );
}

// ---------------------------------------------------------------------------------
// Empty & loading states
// ---------------------------------------------------------------------------------

// Every meaningful empty state gets an icon composition, a human title, a one-line
// explanation, and (usually) the next action — never a bare "No data found".
export function EmptyState({
  icon: IconCmp,
  title,
  body,
  action,
  compact = false,
}: {
  icon: Icon;
  title: string;
  body?: ReactNode;
  action?: { label: string; href?: string; onClick?: () => void };
  compact?: boolean;
}) {
  return (
    <div className={cx('flex flex-col items-center text-center', compact ? 'py-10' : 'py-16 sm:py-20')}>
      <div className="relative mb-5">
        <span className="absolute -inset-3 rounded-[28px] bg-primary-light/70 rotate-6" aria-hidden />
        <span className="absolute -inset-3 rounded-[28px] bg-cream-deep -rotate-3" aria-hidden />
        <span className="relative inline-flex w-16 h-16 items-center justify-center rounded-3xl bg-white shadow-card text-primary">
          <IconCmp size={28} aria-hidden />
        </span>
      </div>
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted">{body}</p>}
      {action &&
        (action.href ? (
          <Link href={action.href} className="press mt-5 inline-flex items-center rounded-full bg-primary px-5 h-11 text-sm font-semibold text-white hover:bg-primary-pressed">
            {action.label}
          </Link>
        ) : (
          <button onClick={action.onClick} className="press mt-5 inline-flex items-center rounded-full bg-primary px-5 h-11 text-sm font-semibold text-white hover:bg-primary-pressed">
            {action.label}
          </button>
        ))}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} aria-hidden />;
}

export function SkeletonListingCard() {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-card" aria-hidden>
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}
