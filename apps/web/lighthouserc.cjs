/**
 * Lighthouse CI — non-negotiable #7: >= 95 on Performance, Accessibility, Best Practices and SEO on
 * mobile for the key pages. Runs against a local production build in CI (and against a Vercel preview
 * when SITE_URL is set). The "is-crawlable" audit is skipped until domain cut-over because the interim
 * site is deliberately noindex (ADR 0002).
 */
const base = process.env.SITE_URL || "http://127.0.0.1:3000";
const pages = (process.env.SITE_PAGES || "/,/products,/contact").split(",");

module.exports = {
  ci: {
    collect: {
      url: pages.map((p) => `${base}${p}`),
      numberOfRuns: 2,
      settings: {
        // Throttled 4G-class profile; LCP must stay under 2.0 s.
        throttlingMethod: "simulate",
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
