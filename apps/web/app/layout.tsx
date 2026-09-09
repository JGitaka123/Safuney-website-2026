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
import { PwaRegister } from "@/components/site/pwa-register";
import { flagEnabled } from "@/lib/flags";

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
  // No `alternates` here on purpose. Metadata is inherited, so a canonical set on the root layout
  // would make every page that does not override it declare the home page as its canonical — which
  // tells a search engine the whole site is one page, and drops the SEO audit to 0.88. Canonicals and
  // hreflang belong on the pages that know their own address; `metadataBase` is what resolves them.
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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pwa = await flagEnabled("pwa.enabled");
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
        <PwaRegister enabled={pwa} />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
