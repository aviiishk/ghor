import Link from 'next/link';
import { Logo } from '@/components/logo';

// Public, no-login pages (not in middleware.ts's PROTECTED_PREFIXES) — the Play Store
// listing links here, so they must be reachable by anyone, signed in or not.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-hairline">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" aria-label="GHOR home">
            <Logo />
          </Link>
          <nav className="flex gap-4 text-sm font-semibold">
            <Link href="/privacy" className="text-muted hover:text-ink">
              Privacy
            </Link>
            <Link href="/terms" className="text-muted hover:text-ink">
              Terms
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <article className="legal-prose">{children}</article>
      </main>
    </div>
  );
}
