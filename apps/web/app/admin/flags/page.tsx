import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@safuney/db";
import { viewer } from "@/lib/auth/session";
import { can } from "@/lib/admin/permissions";
import { FLAGS, type FlagKey } from "@/lib/flags";
import { FlagToggle } from "@/components/admin/flag-toggle";
import { setFeatureFlag } from "@/lib/admin/flag-actions";

export const metadata: Metadata = { title: "Features" };

export default async function FlagsPage() {
  const who = await viewer();
  if (!who || !can(who.role, "staff.write")) redirect("/account?denied=1");
  const rows = await db().featureFlag.findMany();
  const enabled = new Map(rows.map((r) => [r.key, r.enabled]));

  return (
    <div>
      <h1 className="text-h1">Features</h1>
      <p className="mt-2 max-w-reading text-body text-ink-muted">
        Everything here is off until you switch it on, and switching one on makes it live for every customer
        immediately. Each change is recorded in the audit log with your name against it.
      </p>
      <ul className="mt-6 max-w-reading space-y-3">
        {(Object.keys(FLAGS) as FlagKey[]).map((key) => (
          <li key={key} className="border border-line bg-surface p-4">
            <p className="text-body text-ink">{FLAGS[key]}</p>
            <p className="mt-1 font-mono text-caption text-ink-muted">{key}</p>
            <FlagToggle flag={key} enabled={enabled.get(key) ?? false} action={setFeatureFlag} />
          </li>
        ))}
      </ul>
    </div>
  );
}
