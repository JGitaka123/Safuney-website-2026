import { describe, expect, it } from "vitest";
import { calculate, litresPerPack, parseGuidance, parseRatio, ratioLabel } from "@/lib/catalogue/dilution";

describe("dilution maths", () => {
  it("parses ratios", () => {
    expect(parseRatio("1:40")).toBe(40);
    expect(parseRatio(" 1 : 100 ")).toBe(100);
    expect(parseRatio("neat")).toBe(0);
    expect(parseRatio("40:1")).toBeNull();
    expect(ratioLabel(0)).toBe("Use neat");
  });
  it("turns litres of solution into product and water", () => {
    expect(calculate(10, 40)).toEqual({ productMl: 243.9, waterMl: 9756.1 });
    expect(calculate(5, 0)).toEqual({ productMl: 5000, waterMl: 0 });
    expect(calculate(-1, 40)).toEqual({ productMl: 0, waterMl: 0 });
    expect(litresPerPack(5, 40)).toBe(205);
  });
  it("tolerates hand-typed guidance JSON", () => {
    const rows = parseGuidance([{ use: "General", ratio: "1:40", contactTimeMinutes: 5 }, { use: "Heavy soil", ratio: 10 }, { bad: true }, null]);
    expect(rows).toEqual([{ use: "General", ratio: 40, contactTimeMinutes: 5, note: undefined }, { use: "Heavy soil", ratio: 10, contactTimeMinutes: undefined, note: undefined }]);
    expect(parseGuidance("nope")).toEqual([]);
  });
});
