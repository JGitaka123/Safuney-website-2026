import { describe, expect, it } from "vitest";
import { parseFeeRules, quoteFee, zoneForCounty, type ZoneLike } from "@/lib/delivery";

const nairobi: ZoneLike = {
  id: "z1",
  slug: "nairobi-metro",
  name: "Nairobi metro",
  counties: ["Nairobi"],
  feeRules: [
    { maxWeightGrams: 10000, maxOrderMinorUnits: "500000", feeMinorUnits: "30000" },
    { maxWeightGrams: 50000, feeMinorUnits: "60000" },
    { feeMinorUnits: "120000" },
  ],
  freeAboveMinorUnits: 1500000n,
  leadTimeDays: 1,
  slots: ["Morning", "Afternoon"],
  isActive: true,
};
const other: ZoneLike = { ...nairobi, id: "z3", slug: "other-counties", name: "Other counties", counties: [], feeRules: [{ feeMinorUnits: "80000" }], freeAboveMinorUnits: null };

describe("delivery fee engine", () => {
  it("picks the first rule the order fits", () => {
    expect(quoteFee(nairobi, 5000, 200000n)).toMatchObject({ ok: true, feeMinorUnits: 30000n, free: false });
    expect(quoteFee(nairobi, 5000, 600000n)).toMatchObject({ ok: true, feeMinorUnits: 60000n }); // over the order cap of rule 1
    expect(quoteFee(nairobi, 80000, 200000n)).toMatchObject({ ok: true, feeMinorUnits: 120000n }); // over the weight cap of rules 1 and 2
  });
  it("waives the fee above the free threshold", () => {
    expect(quoteFee(nairobi, 90000, 1500000n)).toMatchObject({ ok: true, feeMinorUnits: 0n, free: true });
  });
  it("reports when no rule matches instead of guessing", () => {
    const strict: ZoneLike = { ...nairobi, feeRules: [{ maxWeightGrams: 1000, feeMinorUnits: "10000" }], freeAboveMinorUnits: null };
    expect(quoteFee(strict, 5000, 100n)).toEqual({ ok: false, reason: "NO_RULE" });
  });
  it("ignores malformed rules", () => {
    expect(parseFeeRules([{ feeMinorUnits: "abc" }, { nope: 1 }, null, { feeMinorUnits: 500 }])).toEqual([{ maxWeightGrams: undefined, maxOrderMinorUnits: undefined, feeMinorUnits: 500n }]);
    expect(parseFeeRules("x")).toEqual([]);
  });
  it("routes counties to zones with a catch-all", () => {
    expect(zoneForCounty([nairobi, other], "nairobi")?.slug).toBe("nairobi-metro");
    expect(zoneForCounty([nairobi, other], "Kisumu")?.slug).toBe("other-counties");
    expect(zoneForCounty([{ ...nairobi, isActive: false }], "Nairobi")).toBeNull();
  });
});
