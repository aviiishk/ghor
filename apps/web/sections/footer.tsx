import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/button";

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-hairline bg-white py-10 md:py-12">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-200 to-transparent" />
      <div className="absolute -right-24 top-0 size-64 rounded-full bg-brand-50 blur-3xl" />
      <div className="container-page relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div className="max-w-md">
          <Logo />
          <p className="mt-4 text-sm font-medium leading-6 text-muted">
            A launch waitlist for verified rooms and PGs in Guwahati. Built for students,
            professionals, and owners who want fewer calls and faster move-ins.
          </p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Copyright {new Date().getFullYear()} GHOR
          </p>
          <div className="mt-3 flex gap-4 text-sm font-semibold text-muted">
            <Link href="/privacy" className="hover:text-ink">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-ink">
              Terms of Service
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-hairline bg-surface/80 p-5 shadow-sm md:min-w-[340px]">
          <div className="inline-flex rounded-full bg-primary-light px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary ring-1 ring-brand-100">
            Launching soon in Guwahati
          </div>
          <p className="mt-4 text-lg font-semibold leading-7 text-ink">
            First 100 waitlist spots are open now.
          </p>
          <div className="mt-5">
            <Button href="#waitlist" className="w-full">
              Join Waitlist
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}
