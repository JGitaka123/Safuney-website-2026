import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@safuney/db";
import { viewer } from "@/lib/auth/session";
import { can } from "@/lib/admin/permissions";
import { SettingsForm } from "@/components/admin/settings-form";
import { saveSettings } from "@/lib/admin/settings-actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const who = await viewer();
  if (!who || !can(who.role, "content.write")) redirect("/account?denied=1");
  const rows = Object.fromEntries((await db().setting.findMany()).map((s) => [s.key, s.value]));
  const minimum = String(rows["orders.minimumMinorUnits"] ?? "0");
  return (
    <div>
      <h1 className="text-h1">Settings</h1>
      <SettingsForm
        displayMode={rows["pricing.displayMode"] === "INC_VAT" ? "INC_VAT" : "EX_VAT"}
        minimumKes={minimum === "0" ? "" : (Number(minimum) / 100).toFixed(2)}
        kraPin={String(rows["company.kraPin"] ?? "")}
        vatNumber={String(rows["company.vatNumber"] ?? "")}
        save={saveSettings}
      />
    </div>
  );
}
