/**
 * Money = integer minor units (KES cents) as bigint. Non-negotiable #2.
 * Nothing in this module ever touches a float for arithmetic; formatting happens only at the edge.
 */
export type Money = bigint;

export const ZERO: Money = 0n;

/** Parse a user-entered KES amount ("1,250.50", "1250") into minor units. Throws on malformed input. */
export function parseKes(input: string): Money {
  const cleaned = input.replace(/[,\s]/g, "").replace(/^KES/i, "");
  const m = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!m) throw new RangeError(`Not a KES amount: "${input}"`);
  const [, sign, whole, frac = ""] = m;
  const cents = BigInt(whole!) * 100n + BigInt(frac.padEnd(2, "0"));
  return sign ? -cents : cents;
}

/** Construct minor units from whole shillings and cents without going through floats. */
export function kes(shillings: number | bigint, cents: number | bigint = 0): Money {
  return BigInt(shillings) * 100n + BigInt(cents);
}

/** Multiply an amount by an integer quantity. */
export function times(amount: Money, qty: number | bigint): Money {
  return amount * BigInt(qty);
}

export function sum(amounts: Iterable<Money>): Money {
  let total = 0n;
  for (const a of amounts) total += a;
  return total;
}

/** Round-half-up division by an integer divisor (used for VAT and percentage maths). */
export function divRound(numerator: Money, divisor: bigint): Money {
  if (divisor === 0n) throw new RangeError("division by zero");
  const neg = (numerator < 0n) !== (divisor < 0n);
  const n = numerator < 0n ? -numerator : numerator;
  const d = divisor < 0n ? -divisor : divisor;
  const q = (n * 2n + d) / (2n * d);
  return neg ? -q : q;
}

/** VAT on an ex-VAT amount at a rate in basis points (1600 = 16 %). Round half up to the cent. */
export function vatOn(exVat: Money, rateBps: number): Money {
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10000) throw new RangeError(`bad VAT bps ${rateBps}`);
  return divRound(exVat * BigInt(rateBps), 10000n);
}

/** Extract the VAT portion from a VAT-inclusive amount. */
export function vatInside(incVat: Money, rateBps: number): Money {
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10000) throw new RangeError(`bad VAT bps ${rateBps}`);
  return divRound(incVat * BigInt(rateBps), BigInt(10000 + rateBps));
}

/** Percentage of an amount in basis points, round half up. */
export function percentOf(amount: Money, bps: number | bigint): Money {
  return divRound(amount * BigInt(bps), 10000n);
}

export function max(a: Money, b: Money): Money {
  return a > b ? a : b;
}

export function min(a: Money, b: Money): Money {
  return a < b ? a : b;
}

/** Format for display: "KES 1,250.50". Locale is fixed so server and client render identically. */
export function formatKes(amount: Money, opts: { symbol?: boolean; cents?: "always" | "auto" } = {}): string {
  const { symbol = true, cents = "always" } = opts;
  const neg = amount < 0n;
  const abs = neg ? -amount : amount;
  const whole = abs / 100n;
  const frac = abs % 100n;
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const showCents = cents === "always" || frac !== 0n;
  const body = showCents ? `${wholeStr}.${frac.toString().padStart(2, "0")}` : wholeStr;
  return `${neg ? "-" : ""}${symbol ? "KES " : ""}${body}`;
}

/** Safe transport across the RSC / JSON boundary: bigint -> decimal string. */
export function serializeMoney(amount: Money): string {
  return amount.toString();
}

export function deserializeMoney(value: string | number | bigint): Money {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new RangeError(`unsafe money number ${value}`);
    return BigInt(value);
  }
  if (!/^-?\d+$/.test(value)) throw new RangeError(`bad money string "${value}"`);
  return BigInt(value);
}
