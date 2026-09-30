import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { Providers } from "./providers";

// Body text stays on the native system stack; headings use Geist (self-hosted by the
// `geist` package — no third-party request, no layout shift) via --font-geist-sans.
// Redesign 2026-09-26: the all-system-font product read as generic; DESIGN.md's
// Typography section was amended to allow one display face on web only.

export const metadata: Metadata = {
  title: "GHOR - Find Rooms & PGs in Guwahati",
  description:
    "Find GHOR-approved rooms and PGs in Guwahati. Join the GHOR waitlist and get early access before launch.",
  openGraph: {
    title: "GHOR - Find Rooms & PGs in Guwahati",
    description:
      "Find GHOR-approved rooms and PGs in Guwahati. Join the GHOR waitlist and get early access before launch.",
    url: "https://ghor.app",
    siteName: "GHOR",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "GHOR - Find Rooms & PGs in Guwahati",
    description:
      "Find GHOR-approved rooms and PGs in Guwahati. Join the GHOR waitlist and get early access before launch."
  },
  metadataBase: new URL("https://ghor.app")
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
