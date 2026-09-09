import type { MetadataRoute } from "next";

// Interim site on *.vercel.app: block all crawlers. Replaced with a real robots policy at cut-over (Phase 9).
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
