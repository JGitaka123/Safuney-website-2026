import { cache } from "react";
import { db } from "@safuney/db";
import { services } from "./env";
import type { PriceDisplayMode } from "./pricing";

const DEFAULTS = {
  "pricing.displayMode": "EX_VAT" as PriceDisplayMode,
  "orders.minimumMinorUnits": "0",
  "delivery.configured": false,
  "company.legalName": "Safuney Limited",
  "company.kraPin": "",
  "company.vatNumber": "",
} as const;

export type SettingKey = keyof typeof DEFAULTS;

/** Site settings from the Setting table with safe defaults when the database is off or a key is missing. */
export const getSetting = cache(async <K extends SettingKey>(key: K): Promise<(typeof DEFAULTS)[K]> => {
  if (!services.database()) return DEFAULTS[key];
  try {
    const row = await db().setting.findUnique({ where: { key } });
    if (!row) return DEFAULTS[key];
    return row.value as (typeof DEFAULTS)[K];
  } catch (error) {
    console.error(`getSetting(${key}) failed; using default`, error);
    return DEFAULTS[key];
  }
});

export async function getPriceDisplayMode(): Promise<PriceDisplayMode> {
  const v = await getSetting("pricing.displayMode");
  return v === "INC_VAT" ? "INC_VAT" : "EX_VAT";
}

export const isFeatureEnabled = cache(async (key: string): Promise<boolean> => {
  if (!services.database()) return false;
  try {
    const row = await db().featureFlag.findUnique({ where: { key } });
    return row?.enabled ?? false;
  } catch {
    return false;
  }
});
