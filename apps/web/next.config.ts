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
  }
};

export default nextConfig;
