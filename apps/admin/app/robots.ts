import type { MetadataRoute } from "next";

// ADM-13: the admin console must never be indexed. Paired with the X-Robots-Tag header
// (next.config.ts) and the robots meta tag (app/layout.tsx).
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
