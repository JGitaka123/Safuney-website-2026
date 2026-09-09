import { describe, expect, it } from "vitest";
import { activeFilterCount, filtersToSearchParams, parseFilters, toggleFacet, withFilter } from "@/lib/catalogue/filters";

describe("catalogue filters", () => {
  it("parses and validates URL params", () => {
    const f = parseFilters({ zone: "kitchen", brand: "Acme,Beta", pack: ["5 L", "20 L"], min: "50", max: "10", stock: "in", sort: "price-desc", page: "3", q: " degreaser " });
    expect(f.zone).toBe("GREEN");
    expect(f.brands).toEqual(["Acme", "Beta"]);
    expect(f.packs).toEqual(["5 L", "20 L"]);
    expect(f.priceMin).toBe(10);
    expect(f.priceMax).toBe(50);
    expect(f.inStock).toBe(true);
    expect(f.sort).toBe("price-desc");
    expect(f.page).toBe(3);
    expect(f.q).toBe("degreaser");
  });

  it("drops junk instead of throwing", () => {
    const f = parseFilters({ zone: "purple", sort: "hack", page: "-4", min: "abc" });
    expect(f.zone).toBeUndefined();
    expect(f.sort).toBe("relevance");
    expect(f.page).toBe(1);
    expect(f.priceMin).toBeUndefined();
    expect(activeFilterCount(f)).toBe(0);
  });

  it("round-trips through a stable query string", () => {
    const f = parseFilters({ zone: "washrooms", brand: "Acme", sort: "name-asc", page: "2" });
    const qs = filtersToSearchParams(f).toString();
    expect(qs).toBe("zone=washrooms&brand=Acme&sort=name-asc&page=2");
    expect(parseFilters(Object.fromEntries(new URLSearchParams(qs)))).toEqual(f);
  });

  it("toggles facets and resets the page", () => {
    const f = parseFilters({ brand: "Acme", page: "4" });
    expect(toggleFacet(f, "brands", "Beta")).toBe("brand=Acme%2CBeta");
    expect(toggleFacet(f, "brands", "Acme")).toBe("");
    expect(withFilter(f, { sort: "newest" })).toBe("brand=Acme&sort=newest");
  });
});
