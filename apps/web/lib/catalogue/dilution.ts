/**
 * Dilution maths, shared by the server (product page) and the client calculator.
 * A ratio "1:40" means 1 part product to 40 parts water. Litres of solution needed → product to measure.
 */
export interface DilutionRow {
  use: string;
  /** Parts of water per part of product. 0 = use neat. */
  ratio: number;
  contactTimeMinutes?: number;
  note?: string;
}

export function parseRatio(text: string): number | null {
  const m = /^\s*1\s*:\s*(\d+(?:\.\d+)?)\s*$/.exec(text);
  if (m) return Number(m[1]);
  if (/^\s*neat\s*$/i.test(text)) return 0;
  return null;
}

export function ratioLabel(ratio: number): string {
  return ratio === 0 ? "Use neat" : `1:${ratio}`;
}

/** Product needed (ml) and water needed (ml) for `solutionLitres` of ready-to-use solution. */
export function calculate(solutionLitres: number, ratio: number): { productMl: number; waterMl: number } {
  if (!Number.isFinite(solutionLitres) || solutionLitres < 0) return { productMl: 0, waterMl: 0 };
  const totalMl = solutionLitres * 1000;
  if (ratio === 0) return { productMl: Math.round(totalMl), waterMl: 0 };
  const productMl = totalMl / (ratio + 1);
  return { productMl: Math.round(productMl * 10) / 10, waterMl: Math.round((totalMl - productMl) * 10) / 10 };
}

/** How many litres of solution one pack makes at a ratio. */
export function litresPerPack(packLitres: number, ratio: number): number {
  if (!Number.isFinite(packLitres) || packLitres <= 0) return 0;
  return Math.round(packLitres * (ratio + 1) * 10) / 10;
}

/** Parse the JSON stored in Product.dilutionGuidance, tolerating hand-typed variants. */
export function parseGuidance(json: unknown): DilutionRow[] {
  if (!Array.isArray(json)) return [];
  const rows: DilutionRow[] = [];
  for (const item of json) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const ratio = typeof r["ratio"] === "number" ? r["ratio"] : typeof r["ratio"] === "string" ? parseRatio(r["ratio"]) : null;
    if (ratio === null || typeof r["use"] !== "string") continue;
    rows.push({
      use: r["use"],
      ratio,
      contactTimeMinutes: typeof r["contactTimeMinutes"] === "number" ? r["contactTimeMinutes"] : undefined,
      note: typeof r["note"] === "string" ? r["note"] : undefined,
    });
  }
  return rows;
}
