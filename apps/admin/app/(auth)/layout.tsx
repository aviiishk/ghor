import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-[calc(100vh-24px)] place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center font-display text-xl font-bold text-navy">
          GHOR <span className="font-semibold text-muted">Admin</span>
        </p>
        <div className="rounded-2xl bg-canvas p-6 shadow-card ring-1 ring-hairline">{children}</div>
        <p className="mt-6 text-center text-xs text-muted">Authorised GHOR staff only. Every action is recorded.</p>
      </div>
    </main>
  );
}
