/** The planner's arithmetic. These numbers become someone's monthly order, so they get checked. */
import { describe, expect, it } from "vitest";
import { FACILITY_TYPES, MAX_UNITS, plan } from "@/lib/planner/model";

describe("facility hygiene planner", () => {
  it("knows every facility type it offers, and none it does not", () => {
    expect(FACILITY_TYPES.length).toBeGreaterThan(0);
    for (const f of FACILITY_TYPES) {
      expect(plan(f.slug, 10)).not.toBeNull();
      expect(f.tasks.length).toBeGreaterThan(0);
      for (const t of f.tasks) {
        expect(t.ratio).toBeGreaterThanOrEqual(1);
        expect(t.frequency).toBeGreaterThan(0);
        expect(t.litresPerUnit).toBeGreaterThan(0);
      }
    }
    expect(plan("submarine", 10)).toBeNull();
  });

  it("turns solution volume into concentrate at the task's own dilution", () => {
    const p = plan("hotel", 100)!;
    const bathroom = p.tasks.find((t) => t.key === "bathroom")!;
    // 0.5 L per room per clean × 100 rooms × 30 cleans = 1,500 L of made-up solution.
    expect(bathroom.solutionLitres).toBe(1500);
    // At 1:40, one part concentrate makes 41 parts solution: 1500 / 41 = 36.59 L, shown as 37 —
    // figures of ten litres and up are whole litres, because nobody orders 36.6 L of anything.
    expect(bathroom.ratio).toBe(40);
    expect(bathroom.concentrateLitres).toBe(37);
    // Small figures keep one decimal, where the difference is a bottle rather than a rounding error.
    const small = plan("hotel", 1)!.tasks.find((t) => t.key === "bathroom")!;
    expect(small.concentrateLitres).toBe(0.4);
  });

  it("does not halve a product that is used neat", () => {
    const p = plan("clinic", 50)!;
    const hands = p.tasks.find((t) => t.key === "hands")!;
    // 0.05 L per bed per day × 50 beds × 30 days = 75 L of hand gel, applied neat. Running that
    // through the (ratio + 1) arithmetic would order 37.5 L and run the ward out in week three.
    expect(hands.ratio).toBe(1);
    expect(hands.solutionLitres).toBe(75);
    expect(hands.concentrateLitres).toBe(75);
  });

  it("scales linearly with size", () => {
    const small = plan("school", 200)!;
    const big = plan("school", 400)!;
    expect(big.totalConcentrateLitres).toBeCloseTo(small.totalConcentrateLitres * 2, 0);
  });

  it("clamps a size below one and above the ceiling rather than returning nonsense", () => {
    expect(plan("office", 0)!.units).toBe(1);
    expect(plan("office", -50)!.units).toBe(1);
    expect(plan("office", MAX_UNITS * 10)!.units).toBe(MAX_UNITS);
    expect(plan("office", 12.7)!.units).toBe(12);
  });

  it("lists each zone once, however many tasks use it", () => {
    const p = plan("hotel", 50)!;
    expect(p.zones).toEqual([...new Set(p.zones)]);
    // A hotel cleans washrooms, general areas and a kitchen.
    expect(p.zones).toEqual(expect.arrayContaining(["RED", "BLUE", "GREEN"]));
  });

  it("shows a total that equals the column above it", () => {
    // Someone will add the rows up. If the total disagrees, they stop trusting the whole plan.
    for (const facility of FACILITY_TYPES) {
      for (const units of [1, 37, 300, 5000]) {
        const p = plan(facility.slug, units)!;
        const sum = p.tasks.reduce((s, t) => s + t.concentrateLitres, 0);
        const shown = sum < 10 ? Math.round(sum * 10) / 10 : Math.round(sum);
        expect(p.totalConcentrateLitres, `${facility.slug} at ${units}`).toBe(shown);
      }
    }
  });

  it("points every task at a category the shop actually has", () => {
    // A dead link from the planner is worse than no link: it is a promise the catalogue does not keep.
    const known = new Set(["housekeeping", "disinfection", "laundry", "foodservice", "specialty", "healthcare", "laboratory", "personal-hygiene"]);
    for (const f of FACILITY_TYPES) {
      for (const t of f.tasks) expect(known, `${f.slug}/${t.key}`).toContain(t.category);
    }
  });
});
