import type { Metadata } from "next";
import { db } from "@safuney/db";
import { Input } from "@safuney/ui";
import { requireRole } from "@/lib/auth/session";
import { newTotpSecret } from "@/lib/auth/password";
import { changeAuthenticatorAction, changePasswordAction } from "@/lib/auth/staff-security-actions";
import { AccountNav } from "@/components/account/account-nav";
import { ActionForm } from "@/components/account/action-form";

export const metadata: Metadata = { title: "Sign-in security", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Groups of four, so a key typed into a phone by hand is easier to check. */
function grouped(key: string): string {
  return key.replace(/(.{4})/g, "$1 ").trim();
}

export default async function SecurityPage() {
  const who = await requireRole(["SALES", "WAREHOUSE", "FINANCE", "ADMIN"], "/account/security");
  const user = await db().user.findUniqueOrThrow({ where: { id: who.id }, select: { totpSecret: true, credentialsChangedAt: true } });
  const enrolled = Boolean(user.totpSecret);
  // A fresh key on every visit; it only replaces the current one when a code from it is confirmed.
  const newKey = newTotpSecret();
  const currentCode = (
    <Input
      name="currentCode"
      label="Code from your authenticator app"
      inputMode="numeric"
      autoComplete="one-time-code"
      required={enrolled}
      optional={!enrolled}
      helper={enrolled ? "The six digits showing now." : "You have no authenticator set up yet; leave this empty."}
      className="max-w-[12rem] font-mono tracking-[0.3em]"
    />
  );
  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <h1 className="text-h1">Sign-in security</h1>
      <AccountNav current="/account/security" organisation={false} staff />
      <p className="mt-6 max-w-[65ch] text-body text-ink-muted">
        Changing either of these signs you out everywhere, including here, and you sign in again with the new details. Both need your current password and code, so an unattended screen is not enough to change them.
        {user.credentialsChangedAt ? ` Last changed ${user.credentialsChangedAt.toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}.` : null}
      </p>
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section className="min-w-0">
          <h2 className="text-h3">Change password</h2>
          <ActionForm action={changePasswordAction} submitLabel="Change password" busyLabel="Changing…" className="mt-3 border border-line bg-surface p-5">
            <Input name="currentPassword" label="Current password" type="password" autoComplete="current-password" required />
            {currentCode}
            <Input name="newPassword" label="New password" type="password" autoComplete="new-password" required helper="At least 12 characters. A password manager can make one for you." />
            <Input name="confirmPassword" label="New password again" type="password" autoComplete="new-password" required />
          </ActionForm>
        </section>
        <section className="min-w-0">
          <h2 className="text-h3">{enrolled ? "Move to a new authenticator" : "Set up an authenticator"}</h2>
          <ActionForm action={changeAuthenticatorAction} submitLabel={enrolled ? "Switch to the new key" : "Turn on"} busyLabel="Checking…" className="mt-3 border border-line bg-surface p-5">
            <div className="text-body text-ink">
              <p>In Google Authenticator tap <strong>+</strong>, then <strong>Enter a setup key</strong>. Name it <strong>Safuney</strong>, type this key and choose <strong>Time based</strong>:</p>
              <p className="mt-3 select-all break-all border border-line bg-ground px-3 py-2 font-mono text-[1.0625rem] tracking-wider">{grouped(newKey)}</p>
              <p className="mt-2 text-small text-ink-muted">{enrolled ? "Keep the old entry until this is done: the code below comes from it." : "Spaces in the key do not matter."}</p>
            </div>
            <input type="hidden" name="newKey" value={newKey} />
            <Input name="currentPassword" label="Current password" type="password" autoComplete="current-password" required />
            {enrolled ? currentCode : null}
            <Input name="newCode" label="Code from the new entry" inputMode="numeric" autoComplete="off" required helper="Six digits from the entry you just added." className="max-w-[12rem] font-mono tracking-[0.3em]" />
          </ActionForm>
        </section>
      </div>
    </div>
  );
}
