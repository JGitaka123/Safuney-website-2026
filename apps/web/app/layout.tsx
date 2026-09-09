import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { site } from "@/config/site";
import { config } from "@/lib/env";
import { isIndexable } from "@/lib/seo/indexing";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";

export const metadata: Metadata = {
  metadataBase: new URL(config.siteUrl),
  title: {
    default: `${site.legalName} — professional cleaning and hygiene solutions, Kenya`,
    template: `%s — ${site.shortName}`,
  },
  description: site.tagline,
  // Interim site must not be indexed until domain cut-over (ADR 0002); the switch is SITE_INDEXABLE=1
  // on the production deployment, and a preview is never indexable whatever it says.
  robots: isIndexable() ? { index: true, follow: true } : { index: false, follow: false },
  alternates: { canonical: "/", languages: { en: "/", sw: "/sw" } },
  openGraph: {
    type: "website",
    siteName: site.legalName,
    locale: "en_KE",
    alternateLocale: ["sw_KE"],
    url: config.siteUrl,
    title: `${site.legalName} — professional cleaning and hygiene solutions, Kenya`,
    description: site.tagline,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#10202b",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Heading and body weights; with font-display: optional the preloads decide whether the first paint is
  // Plex or the metric-matched fallback (ADR 0005). Neither face is inlined, so the stylesheet stays small.
  preload("/fonts/plex-sans-600-core.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous", fetchPriority: "high" });
  preload("/fonts/plex-sans-400-core.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous", fetchPriority: "high" });
  return (
    <html lang="en-KE">
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-button focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to main content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
