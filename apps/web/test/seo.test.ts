/** The indexing gate and the structured data that depends on it. */
import { afterEach, describe, expect, it, vi } from "vitest";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
  vi.resetModules();
});

async function indexable(env: Record<string, string | undefined>): Promise<boolean> {
  process.env = { ...original, ...env };
  vi.resetModules();
  const { isIndexable } = await import("@/lib/seo/indexing");
  return isIndexable();
}

describe("indexing gate", () => {
  it("is off by default, everywhere", async () => {
    expect(await indexable({ VERCEL_ENV: undefined, SITE_INDEXABLE: undefined })).toBe(false);
  });

  it("stays off on a preview even when the flag is set", async () => {
    expect(await indexable({ VERCEL_ENV: "preview", SITE_INDEXABLE: "1", NEXT_PUBLIC_SITE_URL: "https://safuney.com" })).toBe(false);
  });

  it("stays off on production while the site is still on the preview host", async () => {
    // The whole point of ADR 0002: the interim site must never be indexed, even after the flag is set.
    expect(await indexable({ VERCEL_ENV: "production", SITE_INDEXABLE: "1", NEXT_PUBLIC_SITE_URL: "https://safuney-website-2026.vercel.app" })).toBe(false);
  });

  it("stays off on the real domain until someone sets the flag", async () => {
    expect(await indexable({ VERCEL_ENV: "production", SITE_INDEXABLE: undefined, NEXT_PUBLIC_SITE_URL: "https://safuney.com" })).toBe(false);
    expect(await indexable({ VERCEL_ENV: "production", SITE_INDEXABLE: "0", NEXT_PUBLIC_SITE_URL: "https://safuney.com" })).toBe(false);
  });

  it("is on only for production, on the real domain, with the flag set", async () => {
    expect(await indexable({ VERCEL_ENV: "production", SITE_INDEXABLE: "1", NEXT_PUBLIC_SITE_URL: "https://safuney.com" })).toBe(true);
  });
});

describe("robots", () => {
  it("blocks everything while the site is not indexable", async () => {
    process.env = { ...original, VERCEL_ENV: undefined, SITE_INDEXABLE: undefined };
    vi.resetModules();
    const robots = (await import("@/app/robots")).default;
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });

  it("keeps crawlers out of the account, admin and checkout paths once it is live", async () => {
    process.env = { ...original, VERCEL_ENV: "production", SITE_INDEXABLE: "1", NEXT_PUBLIC_SITE_URL: "https://safuney.com" };
    vi.resetModules();
    const robots = (await import("@/app/robots")).default;
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0]! : result.rules;
    expect(rules.allow).toBe("/");
    expect(rules.disallow).toEqual(expect.arrayContaining(["/admin", "/checkout", "/account", "/api/", "/warehouse"]));
    expect(result.sitemap).toBe("https://safuney.com/sitemap.xml");
  });
});

describe("structured data", () => {
  it("asserts nothing about the business that the PO has not confirmed", async () => {
    const { localBusinessJsonLd } = await import("@/lib/seo/jsonld");
    // Every contact fact in config/site.ts is still poConfirmed: false, so there is nothing to claim.
    expect(localBusinessJsonLd()).toBeNull();
    expect(localBusinessJsonLd({ kraPin: "P051234567X" })).toBeNull();
  });

  it("escapes a closing tag so structured data cannot break out of its script element", async () => {
    const { jsonLdString } = await import("@/lib/seo/jsonld");
    const out = jsonLdString({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c");
  });
});
