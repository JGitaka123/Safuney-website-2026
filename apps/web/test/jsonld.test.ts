import { describe, expect, it } from "vitest";
import { faqJsonLd, jsonLdString, productJsonLd } from "@/lib/seo/jsonld";

describe("JSON-LD", () => {
  it("builds a Product with Offers and AggregateRating", () => {
    const p = productJsonLd({
      name: "QAC sanitiser",
      description: "d",
      path: "/products/disinfection/qac",
      brand: null,
      images: [],
      sku: "QAC-5L",
      offers: [{ sku: "QAC-5L", priceKes: "1450.00", availability: "InStock", name: "5 L", url: "https://x/y" }],
      rating: { average: 4.5, count: 3 },
    });
    expect(p["@type"]).toBe("Product");
    expect((p["offers"] as unknown[]).length).toBe(1);
    expect((p["aggregateRating"] as Record<string, unknown>)["reviewCount"]).toBe(3);
    expect(p).not.toHaveProperty("brand");
  });
  it("escapes < so script injection through product copy is impossible", () => {
    const s = jsonLdString(faqJsonLd([{ q: "</script><script>alert(1)</script>", a: "x" }]));
    expect(s).not.toContain("</script>");
    expect(s).toContain("\\u003c/script");
  });
});
