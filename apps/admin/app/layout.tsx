import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "GHOR Admin",
  robots: { index: false, follow: false }
};

// Every admin page is per-request (auth-gated, CSP nonce) — never statically cached.
export const dynamic = "force-dynamic";

const ENV = process.env.NEXT_PUBLIC_ADMIN_ENV ?? "development";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        {ENV !== "production" && (
          <div className={`px-4 py-1 text-center text-xs font-bold uppercase tracking-wide ${ENV === "staging" ? "bg-warning text-ink" : "bg-surface-dark text-white"}`}>
            {ENV === "staging" ? "Staging — not real data" : "Development environment"}
          </div>
        )}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
