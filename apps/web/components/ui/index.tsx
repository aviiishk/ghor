// GHOR product UI kit (redesign 2026-09-26). One implementation of each primitive, used
// by every product screen — see root DESIGN.md "Components". Server-safe (no hooks), so
// both server and client components can import it.
import type { ButtonHTMLAttributes, ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import { Clock, FileEdit, Home, ShieldCheck, XCircle, type LucideProps } from 'lucide-react';

type Icon = ComponentType<LucideProps>;
export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

// ---------------------------------------------------------------------------------
// Buttons (redesign v2, 2026-09-27). One set of variants for every screen, so a primary
// action looks identical on the landing page, the wizard and the admin queue.
// ---------------------------------------------------------------------------------

const BUTTON_VARIANTS = {
  primary: 'bg-primary text-white hover:bg-primary-pressed shadow-[0_10px_24px_-12px_rgba(37,99,235,0.8)]',
  navy: 'bg-navy text-white hover:bg-navy-soft',
  secondary: 'bg-white text-ink ring-1 ring-inset ring-hairline hover:ring-ink/30',
  ghost: 'text-ink hover:bg-ink/[0.05]',
  destructive: 'bg-destructive-pressed text-white hover:bg-destructive',
  light: 'bg-white text-navy hover:bg-cream',
} as const;
const BUTTON_SIZES = {
  sm: 'h-9 px-3.5 text-sm gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-14 px-7 text-base gap-2',
} as const;

export type ButtonVariant = keyof typeof BUTTON_VARIANTS;
export function buttonClass(variant: ButtonVariant = 'primary', size: keyof typeof BUTTON_SIZES = 'md', block = false) {
  return cx(
    'press inline-flex shrink-0 items-center justify-center rounded-full font-bold transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-60',
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    block && 'w-full',
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  icon: IconCmp,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: keyof typeof BUTTON_SIZES;
  block?: boolean;
  icon?: Icon;
}) {
  return (
    <button type="button" {...rest} className={cx(buttonClass(variant, size, block), className)}>
      {IconCmp && <IconCmp size={size === 'lg' ? 20 : 17} aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  block = false,
  icon: IconCmp,
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: keyof typeof BUTTON_SIZES;
  block?: boolean;
  icon?: Icon;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cx(buttonClass(variant, size, block), className)}>
      {IconCmp && <IconCmp size={size === 'lg' ? 20 : 17} aria-hidden />}
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------------

export const inputBase =
  'w-full rounded-xl bg-white px-4 text-ink ring-1 ring-inset ring-hairline outline-none transition placeholder:text-muted-soft hover:ring-ink/25 focus:ring-2 focus:ring-primary';

// ---------------------------------------------------------------------------------
// Page header — the one title treatment for every signed-in screen.
// ---------------------------------------------------------------------------------

export function PageHeader({
  title,
  kicker,
  meta,
  actions,
  className,
}: {
  title: ReactNode;
  kicker?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx('flex flex-wrap items-end justify-between gap-x-6 gap-y-4', className)}>
      <div className="min-w-0">
        {kicker && <p className="mb-2 text-sm font-semibold text-primary">{kicker}</p>}
        <h1 className="font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.03em] text-navy sm:text-[2.75rem]">{title}</h1>
        {meta && <div className="mt-2 text-[15px] text-muted">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

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
        'press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors',
        active
          ? 'border-navy bg-navy text-white'
          : 'border-navy/[0.12] bg-white/70 text-body hover:border-navy/30 hover:bg-white',
        className,
      )}
    >
      {IconCmp && <IconCmp size={15} aria-hidden />}
      {children}
    </button>
  );
}

// Round, icon-only action (close, share, back). Always needs an accessible label.
export function IconButton({
  icon: IconCmp,
  label,
  onClick,
  tone = 'plain',
  className,
}: {
  icon: Icon;
  label: string;
  onClick?: () => void;
  tone?: 'plain' | 'solid';
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cx(
        'press inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors',
        tone === 'solid' ? 'bg-white/95 text-navy shadow-lift hover:bg-white' : 'text-navy hover:bg-navy/[0.06]',
        className,
      )}
    >
      <IconCmp size={19} aria-hidden />
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
    <div className={cx('mb-5 flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="font-display text-2xl font-bold tracking-[-0.025em] text-navy sm:text-[1.75rem]">{title}</h2>
        {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
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
      <h3 className="font-display text-xl font-bold tracking-tight text-navy">{title}</h3>
      {body && <p className="mt-2 max-w-md text-[15px] leading-6 text-muted">{body}</p>}
      {action &&
        (action.href ? (
          <Link href={action.href} className={cx(buttonClass('primary'), 'mt-6')}>
            {action.label}
          </Link>
        ) : (
          <button onClick={action.onClick} className={cx(buttonClass('primary'), 'mt-6')}>
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
    <div aria-hidden>
      <Skeleton className="aspect-[4/3] rounded-2xl" />
      <div className="space-y-2.5 pt-3.5">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}
