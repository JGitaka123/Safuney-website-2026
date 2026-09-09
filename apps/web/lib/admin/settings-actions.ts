"use server";

import { revalidatePath } from "next/cache";
import { db } from "@safuney/db";
import { hashPassword, newTotpSecret, totpUri } from "@/lib/auth/password";
import { adminAction, AdminError, type AdminResult } from "./action";

function parseKes(raw: string): bigint | null {
  const cleaned = raw.replace(/[,\s]|KES/gi, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return BigInt(whole!) * 100n + BigInt(frac.padEnd(2, "0"));
}

/**
 * The settings the PO actually needs before launch: how prices are shown, the minimum order, and the
 * company's tax identifiers, which the invoice snapshot needs to be KRA-compliant.
 */
export const saveSettings = adminAction(
  "settings.save",
  "content.write",
  "Setting",
  async (ctx, displayMode: string, minimumKes: string, kraPin: string, vatNumber: string): Promise<AdminResult> => {
    const mode = displayMode === "INC_VAT" ? "INC_VAT" : "EX_VAT";
    const minimum = minimumKes.trim() ? parseKes(minimumKes) : 0n;
    if (minimum === null) throw new AdminError("Enter the minimum order in shillings, or leave it empty for none.");
    // A KRA PIN is one letter, nine digits, one letter — checked so a typo is caught here rather than
    // on a tax invoice a customer has already been sent.
    const pin = kraPin.trim().toUpperCase();
    if (pin && !/^[A-Z]\d{9}[A-Z]$/.test(pin)) throw new AdminError("A KRA PIN looks like P051234567X: a letter, nine digits and a letter.");

    const values: Array<[string, unknown]> = [
      ["pricing.displayMode", mode],
      ["orders.minimumMinorUnits", minimum.toString()],
      ["company.kraPin", pin],
      ["company.vatNumber", vatNumber.trim()],
    ];
    const before = Object.fromEntries((await db().setting.findMany({ where: { key: { in: values.map(([k]) => k) } } })).map((s) => [s.key, s.value]));
    await db().$transaction(values.map(([key, value]) => db().setting.upsert({ where: { key }, create: { key, value: value as never }, update: { value: value as never } })));
    ctx.audit({ entity: "Setting", before, after: Object.fromEntries(values) });
    revalidatePath("/", "layout");
    return { ok: true, message: "Saved." };
  },
);

/**
 * Creates a staff account.
 *
 * The password is set here and the person is told to change it; the TOTP secret is shown once, on
 * screen, and never again — it is not emailed, and it is not in the audit row. A staff account is the
 * one thing in the console that can grant someone else's access, so it is ADMIN-only.
 */
export const createStaffAccount = adminAction(
  "staff.create",
  "staff.write",
  "User",
  async (ctx, email: string, name: string, role: string, password: string): Promise<AdminResult> => {
    const address = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) throw new AdminError("That is not an email address.");
    if (!["SALES", "WAREHOUSE", "FINANCE", "ADMIN"].includes(role)) throw new AdminError("Pick one of sales, warehouse, finance or admin.");
    if (password.length < 12) throw new AdminError("Use at least 12 characters. Staff sign-in also needs a code from an authenticator app, but the password still has to be a real one.");
    if (await db().user.findUnique({ where: { email: address }, select: { id: true } })) throw new AdminError(`${address} already has an account. Change its role instead of creating a second one.`);

    const secret = newTotpSecret();
    const user = await db().user.create({
      data: { email: address, name: name.trim() || null, role: role as never, passwordHash: hashPassword(password), totpSecret: secret, emailVerified: new Date(), isActive: true },
      select: { id: true },
    });
    // The secret itself is deliberately not in the audit row: the log is read by more people than
    // should be able to sign in as this person.
    ctx.audit({ entity: "User", entityId: user.id, after: { email: address, role } });
    return { ok: true, message: totpUri(secret, address), id: user.id };
  },
);

export const setStaffRole = adminAction(
  "staff.role",
  "staff.write",
  "User",
  async (ctx, userId: string, role: string, active: boolean): Promise<AdminResult> => {
    if (!["SALES", "WAREHOUSE", "FINANCE", "ADMIN", "CUSTOMER"].includes(role)) throw new AdminError("That is not a role.");
    const before = await db().user.findUnique({ where: { id: userId }, select: { email: true, role: true, isActive: true } });
    if (!before) throw new AdminError("That account no longer exists.");
    // Nobody removes their own access: it is how a site ends up with no administrator at all.
    if (userId === ctx.who.id && (role !== "ADMIN" || !active)) throw new AdminError("You cannot change your own role or switch off your own account. Ask another administrator.");
    if (before.role === "ADMIN" && role !== "ADMIN") {
      const admins = await db().user.count({ where: { role: "ADMIN", isActive: true } });
      if (admins <= 1) throw new AdminError("That is the last administrator. Make someone else an administrator first.");
    }
    await db().user.update({ where: { id: userId }, data: { role: role as never, isActive: active } });
    ctx.audit({ entity: "User", entityId: userId, before: { role: before.role, isActive: before.isActive }, after: { role, isActive: active } });
    revalidatePath("/admin/staff");
    return { ok: true, message: `${before.email} is now ${active ? role.toLowerCase() : "switched off"}.`, id: userId };
  },
);
