'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { cx } from './index';

// Overlay primitives (polish pass, 2026-09-27): one Dialog for every modal/sheet, one
// focus-trap hook, one toast system. Before this, four dialogs each hand-rolled a
// backdrop with no dialog semantics, no Escape, and no focus handling.

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Traps Tab inside `ref` while active, moves focus in on open (an element marked
// [data-autofocus] first), and puts it back where it was on close.
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement as HTMLElement | null;
    const first = root.querySelector<HTMLElement>('[data-autofocus]') ?? root.querySelector<HTMLElement>(FOCUSABLE) ?? root;
    first.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const firstEl = items[0]!;
      const lastEl = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [ref, active]);
}

// Escape to close + body scroll lock, for anything full-screen.
export function useOverlayBehaviour(active: boolean, onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [active]);
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = 'sheet',
  size = 'md',
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** 'sheet' = bottom sheet on phones, centred modal from sm up. 'modal' = centred everywhere. */
  variant?: 'sheet' | 'modal';
  size?: 'sm' | 'md' | 'lg';
  /** false while an irreversible action is in flight. */
  dismissible?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const safeClose = useCallback(() => {
    if (dismissible) onClose();
  }, [dismissible, onClose]);
  useOverlayBehaviour(open, safeClose);
  useFocusTrap(panel, open);
  if (!open) return null;

  const width = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-xl' }[size];
  const sheet = variant === 'sheet';

  return (
    <div
      className={cx(
        'fixed inset-0 z-[70] flex justify-center bg-navy/45 backdrop-blur-[2px] animate-[ghor-fade_160ms_ease-out] motion-reduce:animate-none',
        sheet ? 'items-end sm:items-center sm:px-4' : 'items-center px-4',
      )}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) safeClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx(
          'flex max-h-[92dvh] w-full flex-col bg-white shadow-float outline-none motion-reduce:animate-none',
          sheet
            ? 'rounded-t-[24px] animate-[ghor-sheet-in_260ms_cubic-bezier(0.2,0.8,0.2,1)] sm:rounded-2xl sm:animate-[ghor-pop-in_180ms_ease-out]'
            : 'rounded-2xl animate-[ghor-pop-in_180ms_ease-out]',
          width,
        )}
      >
        {sheet && <span className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-hairline sm:hidden" aria-hidden />}
        <div className="flex items-start gap-4 px-6 pb-2 pt-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-xl font-bold tracking-tight text-navy">
              {title}
            </h2>
            {description && (
              <div id={descId} className="mt-1 text-[15px] leading-6 text-muted">
                {description}
              </div>
            )}
          </div>
          {dismissible && (
            <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 rounded-full p-2 text-muted transition-colors hover:bg-cream hover:text-navy">
              <X size={20} />
            </button>
          )}
        </div>
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">{children}</div>}
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-navy/[0.07] px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------
// Toasts — short confirmation of an action ("Link copied", "Marked as rented").
// ---------------------------------------------------------------------------------

type Toast = { id: number; message: string; tone: 'success' | 'error' | 'info' };
const ToastContext = createContext<(message: string, tone?: Toast['tone']) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        role="status"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[80] flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {toasts.map((t) => {
          const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? AlertTriangle : Info;
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl bg-navy px-4 py-3 text-sm font-semibold text-white shadow-float animate-[ghor-toast-in_220ms_ease-out] motion-reduce:animate-none"
            >
              <Icon size={17} className={t.tone === 'success' ? 'text-success' : t.tone === 'error' ? 'text-[#FCA5A5]' : 'text-primary-tint'} aria-hidden />
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
