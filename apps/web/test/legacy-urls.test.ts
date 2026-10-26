/** Cut-over: the previous site's addresses redirect, and the noindex header follows the indexing gate. */
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { legacyCategoryPath, legacyRedirects } from "@/lib/seo/legacy-urls";
import { GET } from "@/app/products.php/route";

describe("old safuney.com addresses", () => {
  it("send every category the old site linked to, in either spelling, to its new page", () => {
    const seen: Record<string, string> = {
      "Bactro (Biological Range)": "/products/bactro",
      "Cleaning Equipment": "/products/equipment",
      "Disinfection and Sanitization": "/products/disinfection",
      "Personal Hygiene": "/products/personal-hygiene",
      "Specialty Products": "/products/specialty",
      "Warewashing Systems": "/products/warewashing",
      housekeeping: "/products/housekeeping",
      laundry: "/products/laundry",
      "warewashing systems": "/products/warewashing",
      "bactro (biological range)": "/products/bactro",
    };
    for (const [a, path] of Object.entries(seen)) expect(legacyCategoryPath(a), a).toBe(path);
  });

  it("reads the forms search engines indexed: plus for space, stray spaces, any case", () => {
    expect(legacyCategoryPath("Disinfection+and+Sanitization")).toBe("/products/disinfection");
    expect(legacyCategoryPath("  specialty   PRODUCTS ")).toBe("/products/specialty");
  });

  it("sends anything unrecognised to the full range, not a dead end", () => {
    expect(legacyCategoryPath("Foodservice")).toBe("/products");
    expect(legacyCategoryPath(null)).toBe("/products");
  });

  it("redirects products.php permanently with a clean address", () => {
    const res = GET(new NextRequest("https://safuney.com/products.php?a=Personal%20Hygiene"));
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("https://safuney.com/products/personal-hygiene");
  });

  it("redirects the plain pages permanently", () => {
    expect(legacyRedirects()).toEqual(
      expect.arrayContaining([
        { source: "/index.php", destination: "/", permanent: true },
        { source: "/about.php", destination: "/about", permanent: true },
        { source: "/services.php", destination: "/services", permanent: true },
        { source: "/contact.php", destination: "/contact", permanent: true },
      ]),
    );
  });
});

describe("X-Robots-Tag", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
    vi.resetModules();
  });

  async function robotsHeader(env: Record<string, string | undefined>): Promise<string | undefined> {
    process.env = { ...original, ...env };
    vi.resetModules();
    const config = (await import("@/next.config")).default;
    const rules = await config.headers!();
    return rules.flatMap((r) => r.headers).find((h) => h.key === "X-Robots-Tag")?.value;
  }

  it("says noindex until the site is live on its own domain with the flag set", async () => {
    expect(await robotsHeader({ VERCEL_ENV: "production", SITE_INDEXABLE: undefined, NEXT_PUBLIC_SITE_URL: "https://safuney.com" })).toBe("noindex, nofollow");
    expect(await robotsHeader({ VERCEL_ENV: "production", SITE_INDEXABLE: "1", NEXT_PUBLIC_SITE_URL: "https://safuney-website-2026.vercel.app" })).toBe("noindex, nofollow");
    expect(await robotsHeader({ VERCEL_ENV: "preview", SITE_INDEXABLE: "1", NEXT_PUBLIC_SITE_URL: "https://safuney.com" })).toBe("noindex, nofollow");
  });

  it("is gone once SITE_INDEXABLE=1 on production on the real domain", async () => {
    expect(await robotsHeader({ VERCEL_ENV: "production", SITE_INDEXABLE: "1", NEXT_PUBLIC_SITE_URL: "https://safuney.com" })).toBeUndefined();
  });
});
