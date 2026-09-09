import { describe, expect, it } from "vitest";
import { displayPrice, fromPrice, unitPrice } from "@/lib/pricing";

describe("price display", () => {
  it("shows ex-VAT with the VAT line by default", () => {
    const p = displayPrice(125000n, 1600, "EX_VAT");
    expect(p.headline).toBe("KES 1,250.00");
    expect(p.vatLine).toBe("+ VAT 16% (KES 200.00)");
    expect(p.incVatMinor).toBe("145000");
  });
  it("shows inclusive when the site setting says so", () => {
    const p = displayPrice(125000n, 1600, "INC_VAT");
    expect(p.headline).toBe("KES 1,450.00");
    expect(p.vatLine).toBe("incl. VAT 16%");
  });
  it("handles zero-rated products", () => {
    expect(displayPrice(100n, 0, "EX_VAT").vatLine).toBe("VAT exempt");
  });
  it("builds a From price only when packs differ", () => {
    expect(fromPrice([{ priceMinorUnits: 50000n, vatRateBps: 1600 }, { priceMinorUnits: 180000n, vatRateBps: 1600 }], "EX_VAT")).toEqual({ label: "From KES 500.00", multiple: true });
    expect(fromPrice([{ priceMinorUnits: 50000n, vatRateBps: 1600 }], "EX_VAT")).toEqual({ label: "KES 500.00", multiple: false });
    expect(fromPrice([{ priceMinorUnits: 0n, vatRateBps: 1600 }], "EX_VAT")).toBeNull();
  });
  it("computes unit prices per litre or kilogram", () => {
    expect(unitPrice(500000n, "20", "L", "EX_VAT", 1600)).toBe("KES 250.00 per L");
    expect(unitPrice(30000n, "500", "ML", "EX_VAT", 1600)).toBe("KES 600.00 per L");
    expect(unitPrice(30000n, "12", "PCS", "EX_VAT", 1600)).toBeNull();
  });
});
