import { describe, expect, it } from "vitest";
import { deserializeMoney, divRound, formatKes, kes, parseKes, percentOf, serializeMoney, sum, times, vatInside, vatOn } from "../src/money";

describe("money (integer minor units)", () => {
  it("parses KES strings into cents without float error", () => {
    expect(parseKes("1,250.50")).toBe(125050n);
    expect(parseKes("KES 0.10")).toBe(10n);
    expect(parseKes("19.99")).toBe(1999n);
    expect(parseKes("-5")).toBe(-500n);
    expect(() => parseKes("12.345")).toThrow(RangeError);
    expect(() => parseKes("abc")).toThrow(RangeError);
  });

  it("computes VAT at 16 % with half-up rounding", () => {
    expect(vatOn(kes(100), 1600)).toBe(1600n);
    expect(vatOn(1n, 1600)).toBe(0n); // 0.16 cent rounds to 0
    expect(vatOn(4n, 1600)).toBe(1n); // 0.64 cent rounds to 1
    expect(vatOn(kes(1234, 56), 1600)).toBe(19753n); // 123456 * .16 = 19752.96
    expect(() => vatOn(1n, 10001)).toThrow(RangeError);
  });

  it("extracts VAT inside an inclusive amount so ex + vat == inc", () => {
    const inc = kes(1160);
    const vat = vatInside(inc, 1600);
    expect(vat).toBe(kes(160));
    expect(inc - vat + vatOn(inc - vat, 1600)).toBe(inc);
  });

  it("does line arithmetic in bigint", () => {
    expect(times(kes(12, 50), 3)).toBe(3750n);
    expect(sum([1n, 2n, 3n])).toBe(6n);
    expect(percentOf(kes(1000), 1250)).toBe(kes(125));
    expect(divRound(5n, 2n)).toBe(3n);
    expect(divRound(-5n, 2n)).toBe(-3n);
  });

  it("formats at the edge only", () => {
    expect(formatKes(125050n)).toBe("KES 1,250.50");
    expect(formatKes(0n)).toBe("KES 0.00");
    expect(formatKes(-99n)).toBe("-KES 0.99");
    expect(formatKes(kes(1000000), { cents: "auto" })).toBe("KES 1,000,000");
    expect(formatKes(kes(5), { symbol: false })).toBe("5.00");
  });

  it("round-trips across a JSON boundary as strings", () => {
    const m = 987654321012345n;
    expect(deserializeMoney(serializeMoney(m))).toBe(m);
    expect(deserializeMoney(42)).toBe(42n);
    expect(() => deserializeMoney(Number.MAX_SAFE_INTEGER + 2)).toThrow(RangeError);
    expect(() => deserializeMoney("1.5")).toThrow(RangeError);
  });
});
