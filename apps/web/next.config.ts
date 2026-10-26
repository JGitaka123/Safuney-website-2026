import type { NextConfig } from "next";
import { isIndexable } from "./lib/seo/indexing";
import { legacyRedirects } from "./lib/seo/legacy-urls";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@safuney/db", "@safuney/ui", "@safuney/config", "@safuney/payments"],
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  images: { formats: ["image/avif", "image/webp"] },
  async redirects() {
    return legacyRedirects();
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Interim site on *.vercel.app must not be indexed (ADR 0002). Follows the same gate as robots.txt
          // and the page metadata, so SITE_INDEXABLE=1 at cut-over lifts all three; read at build time, so
          // changing it needs a redeploy, which a Vercel environment change needs anyway.
          ...(isIndexable() ? [] : [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]),
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
