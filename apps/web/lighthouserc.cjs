/**
 * Lighthouse CI — non-negotiable #7: >= 95 on Performance, Accessibility, Best Practices and SEO on
 * mobile for the key pages. Runs against a local production build in CI (and against a Vercel preview
 * when SITE_URL is set). The "is-crawlable" audit is skipped until domain cut-over because the interim
 * site is deliberately noindex (ADR 0002).
 */
const base = process.env.SITE_URL || "http://127.0.0.1:3000";
const pages = (process.env.SITE_PAGES || "/,/products,/products/disinfection,/products/disinfection/saf-quartsan,/cart,/checkout,/contact,/sign-in,/quote").split(",");

module.exports = {
  ci: {
    collect: {
      url: pages.map((p) => `${base}${p}`),
      numberOfRuns: 3,
      settings: {
        // Throttled 4G-class profile applied for real (ADR 0007): the simulated model charged the whole
        // JS bundle against LCP whenever hydration on localhost happened to land before first paint,
        // which made the same page swing between 1.7 s and 2.3 s. LCP must stay under 2.0 s.
        throttlingMethod: process.env.LH_THROTTLING || "devtools",
        skipAudits: ["is-crawlable"],
        chromeFlags: "--no-sandbox --headless=new",
      },
      ...(process.env.SITE_URL ? {} : { startServerCommand: "pnpm exec next start -p 3000", startServerReadyPattern: "Ready", startServerReadyTimeout: 60000 }),
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.95 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["error", { minScore: 0.95 }],
        "categories:seo": ["error", { minScore: 0.95 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 2000 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.02 }],
      },
    },
    upload: { target: "temporary-public-storage" },
  },
};
