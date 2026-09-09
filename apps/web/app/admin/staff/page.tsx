import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@safuney/db";
import { viewer } from "@/lib/auth/session";
import { can } from "@/lib/admin/permissions";
import { StaffManager } from "@/components/admin/staff-manager";
import { createStaffAccount, setStaffRole } from "@/lib/admin/settings-actions";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const who = await viewer();
  if (!who || !can(who.role, "staff.write")) redirect("/account?denied=1");
  const staff = await db().user.findMany({
    where: { role: { in: ["SALES", "WAREHOUSE", "FINANCE", "ADMIN"] } },
    select: { id: true, name: true, email: true, role: true, isActive: true, totpSecret: true },
    orderBy: [{ role: "asc" }, { email: "asc" }],
  });
  return (
    <div>
      <h1 className="text-h1">Staff</h1>
      <p className="mt-2 max-w-reading text-body text-ink-muted">
        Staff sign in with an email, a password and a six-digit code from an authenticator app. A new account&rsquo;s
        code is shown once, when you create it, and cannot be shown again — have the person scan it there and then.
      </p>
      <StaffManager
        staff={staff.map((s) => ({ id: s.id, name: s.name, email: s.email ?? "", role: s.role, isActive: s.isActive, hasTotp: s.totpSecret !== null, isSelf: s.id === who.id }))}
        create={createStaffAccount}
        setRole={setStaffRole}
      />
    </div>
  );
}
