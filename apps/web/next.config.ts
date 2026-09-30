import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  // Listing photos come from Cloudinary (apps/api only accepts res.cloudinary.com image
  // URLs). Routing them through next/image gives sized, AVIF/WebP-encoded variants — a
  // real bandwidth saving for budget phones on mobile data.
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" }]
  },
  poweredByHeader: false,
  // Baseline security headers (Phase 0 admin audit T-06/T-12). No Content-Security-Policy
  // yet: the marketplace loads map tiles, Cloudinary images and a socket connection, so a
  // CSP needs its own testing pass — the separate admin console ships a strict one.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=()" },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
            : [])
        ]
      }
    ];
  }
};

export default nextConfig;
