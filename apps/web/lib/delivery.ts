/**
 * Delivery fee engine. Rules live on DeliveryZone.feeRules as JSON so the PO can change them in admin:
 *   [{ "maxWeightGrams": 10000, "maxOrderMinorUnits": "500000", "feeMinorUnits": "35000" }, ...]
 * Rules are evaluated in order; the first rule whose limits the order fits (or that has no limits) wins.
 * `freeAboveMinorUnits` waives the fee for large orders. Pickup is always free.
 */
import * as money from "@safuney/db/money";

export interface FeeRule {
  maxWeightGrams?: number;
  maxOrderMinorUnits?: bigint;
  feeMinorUnits: bigint;
}

export interface ZoneLike {
  id: string;
  slug: string;
  name: string;
  counties: string[];
  feeRules: unknown;
  freeAboveMinorUnits: bigint | null;
  leadTimeDays: number;
  slots: string[];
  isActive: boolean;
}

export function parseFeeRules(json: unknown): FeeRule[] {
  if (!Array.isArray(json)) return [];
  const rules: FeeRule[] = [];
  for (const r of json) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const fee = o["feeMinorUnits"];
    if (fee === undefined || fee === null) continue;
    try {
      rules.push({
        maxWeightGrams: typeof o["maxWeightGrams"] === "number" ? o["maxWeightGrams"] : undefined,
        maxOrderMinorUnits: o["maxOrderMinorUnits"] !== undefined && o["maxOrderMinorUnits"] !== null ? money.deserializeMoney(o["maxOrderMinorUnits"] as string | number) : undefined,
        feeMinorUnits: money.deserializeMoney(fee as string | number),
      });
    } catch {
      // skip malformed rule
    }
  }
  return rules;
}

export type FeeQuote = { ok: true; feeMinorUnits: bigint; free: boolean; rule?: FeeRule } | { ok: false; reason: "NO_RULE" };

export function quoteFee(zone: ZoneLike, weightGrams: number, subtotalMinorUnits: bigint): FeeQuote {
  if (zone.freeAboveMinorUnits !== null && subtotalMinorUnits >= zone.freeAboveMinorUnits) return { ok: true, feeMinorUnits: 0n, free: true };
  for (const rule of parseFeeRules(zone.feeRules)) {
    if (rule.maxWeightGrams !== undefined && weightGrams > rule.maxWeightGrams) continue;
    if (rule.maxOrderMinorUnits !== undefined && subtotalMinorUnits > rule.maxOrderMinorUnits) continue;
    return { ok: true, feeMinorUnits: rule.feeMinorUnits, free: rule.feeMinorUnits === 0n, rule };
  }
  return { ok: false, reason: "NO_RULE" };
}

/** Which active zone serves a county. The catch-all zone (no counties) matches last. */
export function zoneForCounty(zones: ZoneLike[], county: string): ZoneLike | null {
  const active = zones.filter((z) => z.isActive);
  const c = county.trim().toLowerCase();
  return active.find((z) => z.counties.some((x) => x.toLowerCase() === c)) ?? active.find((z) => z.counties.length === 0) ?? null;
}
