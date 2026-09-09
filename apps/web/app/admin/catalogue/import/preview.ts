"use server";

import { viewer } from "@/lib/auth/session";
import { can } from "@/lib/admin/permissions";
import { planImport, type ImportPlan } from "@/lib/admin/catalogue-csv";

/**
 * Reads the uploaded file and says what would change. This writes nothing, so it is not an
 * `adminAction` (there is nothing to audit) — but it reads prices and stock, so it still checks the
 * permission itself.
 */
export async function previewImport(csv: string): Promise<ImportPlan | { error: string }> {
  const who = await viewer();
  if (!who || !can(who.role, "catalogue.write")) return { error: "You do not have permission to do that." };
  if (csv.length > 4_000_000) return { error: "That file is larger than 4 MB. Split it into two." };
  try {
    return await planImport(csv);
  } catch (e) {
    console.error("import preview failed", e);
    return { error: "That file could not be read as CSV. Export the catalogue and edit that file." };
  }
}
