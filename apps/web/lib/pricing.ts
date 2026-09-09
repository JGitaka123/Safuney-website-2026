import * as money from "@safuney/db/money";

export type PriceDisplayMode = "EX_VAT" | "INC_VAT";

export interface DisplayPrice {
  /** Headline amount as shown, e.g. "KES 1,250.00" */
  headline: string;
  /** Line under the headline, e.g. "+ VAT 16% (KES 200.00)" or "incl. VAT 16%" */
  vatLine: string;
  /** Machine-readable amounts for JSON-LD and tests, in minor units as decimal strings */
  exVatMinor: string;
  incVatMinor: string;
  vatMinor: string;
  vatRateBps: number;
}

/** Server-side price presentation. The mode is a site setting (question 7 for the PO); EX_VAT until answered. */
export function displayPrice(exVatMinor: bigint, vatRateBps: number, mode: PriceDisplayMode): DisplayPrice {
  const vat = money.vatOn(exVatMinor, vatRateBps);
  const inc = exVatMinor + vat;
  const pct = `${(vatRateBps / 100).toString().replace(/\.0$/, "")}%`;
  return {
    headline: money.formatKes(mode === "INC_VAT" ? inc : exVatMinor),
    vatLine: mode === "INC_VAT" ? `incl. VAT ${pct}` : vatRateBps === 0 ? "VAT exempt" : `+ VAT ${pct} (${money.formatKes(vat)})`,
    exVatMinor: exVatMinor.toString(),
    incVatMinor: inc.toString(),
    vatMinor: vat.toString(),
    vatRateBps,
  };
}

/** "From KES x" for cards with several packs. */
export function fromPrice(variants: Array<{ priceMinorUnits: bigint; vatRateBps: number }>, mode: PriceDisplayMode): { label: string; multiple: boolean } | null {
  const priced = variants.filter((v) => v.priceMinorUnits > 0n);
  if (priced.length === 0) return null;
  const amounts = priced.map((v) => (mode === "INC_VAT" ? v.priceMinorUnits + money.vatOn(v.priceMinorUnits, v.vatRateBps) : v.priceMinorUnits));
  const min = amounts.reduce((a, b) => (b < a ? b : a));
  const multiple = new Set(amounts.map(String)).size > 1;
  return { label: `${multiple ? "From " : ""}${money.formatKes(min)}`, multiple };
}

/** Price per litre / kilogram for comparing pack sizes, e.g. "KES 250.00 per L". */
export function unitPrice(exVatMinor: bigint, packSizeValue: string | number, unit: string, mode: PriceDisplayMode, vatRateBps: number): string | null {
  const size = Number(packSizeValue);
  if (!Number.isFinite(size) || size <= 0 || !["L", "KG", "ML", "G"].includes(unit)) return null;
  const base = mode === "INC_VAT" ? exVatMinor + money.vatOn(exVatMinor, vatRateBps) : exVatMinor;
  // Convert ml/g to L/kg for comparability; keep integer maths (size in thousandths).
  const perUnitMinor = unit === "ML" || unit === "G" ? money.divRound(base * 1000n, BigInt(Math.round(size))) : money.divRound(base, BigInt(Math.round(size)));
  const label = unit === "L" || unit === "ML" ? "L" : "kg";
  return `${money.formatKes(perUnitMinor)} per ${label}`;
}
