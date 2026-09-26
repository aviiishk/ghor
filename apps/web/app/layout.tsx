import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

// Native system fonts only (no next/font/google) — see ../../DESIGN.md's Typography
// section and root CLAUDE.md §16.2. This app used to load Plus Jakarta Sans + Playfair
// Display; switched to match the rest of the product (2026-07-23).

export const metadata: Metadata = {
  title: "GHOR - Find Rooms & PGs in Guwahati",
  description:
    "Find verified rooms and PGs in Guwahati. Join the GHOR waitlist and get early access before launch.",
  openGraph: {
    title: "GHOR - Find Rooms & PGs in Guwahati",
    description:
      "Find verified rooms and PGs in Guwahati. Join the GHOR waitlist and get early access before launch.",
    url: "https://ghor.app",
    siteName: "GHOR",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "GHOR - Find Rooms & PGs in Guwahati",
    description:
      "Find verified rooms and PGs in Guwahati. Join the GHOR waitlist and get early access before launch."
  },
  metadataBase: new URL("https://ghor.app")
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
