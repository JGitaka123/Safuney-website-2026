import type { Metadata } from "next";
import { db } from "@safuney/db";
import { Input, PhoneInput } from "@safuney/ui";
import { requireViewer } from "@/lib/auth/session";
import { deleteAccountAction, updateProfileAction } from "@/lib/account/profile-actions";
import { AccountNav } from "@/components/account/account-nav";
import { ActionForm } from "@/components/account/action-form";

export const metadata: Metadata = { title: "Profile and privacy", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const who = await requireViewer("/account/profile");
  const user = await db().user.findUniqueOrThrow({ where: { id: who.id }, select: { name: true, email: true, phone: true, marketingOptInAt: true } });
  const organisation = who.memberships.some((m) => m.customer.type === "ORGANISATION");
  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <h1 className="text-h1">Profile and privacy</h1>
      <AccountNav current="/account/profile" organisation={organisation} />
      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <section className="min-w-0 lg:col-span-7">
          <h2 className="text-h3">Your details</h2>
          <ActionForm action={updateProfileAction} submitLabel="Save" className="mt-3 border border-line bg-surface p-5">
            <Input name="name" label="Name" defaultValue={user.name ?? ""} optional autoComplete="name" />
            <Input name="email" label="Email address" type="email" defaultValue={user.email ?? ""} optional autoComplete="email" helper="Order confirmations, invoices and sign-in links go here." />
            <PhoneInput name="phone" label="Mobile number" defaultValue={user.phone?.replace(/^\+254/, "0") ?? ""} optional helper="Sign-in codes and delivery updates by SMS." />
            <label className="flex items-start gap-3 text-body text-ink">
              <input type="checkbox" name="marketingOptIn" defaultChecked={Boolean(user.marketingOptInAt)} className="mt-1 size-4 accent-accent" />
              <span>
                Send me product news and offers by email.
                <span className="block text-small text-ink-muted">Order and delivery messages are sent regardless. You can change this any time.</span>
              </span>
            </label>
          </ActionForm>
        </section>
        <aside className="min-w-0 lg:col-span-5">
          <h2 className="text-h3">Your data</h2>
          <p className="mt-2 text-body text-ink-muted">Under the Data Protection Act 2019 you can take a copy of what we hold about you, or ask us to erase it.</p>
          <a href="/account/export" className="mt-4 inline-flex min-h-11 items-center rounded-button border border-stainless bg-surface px-4 text-button text-ink hover:bg-ground-deep">
            Download my data (JSON)
          </a>
          <div className="mt-8 border border-line bg-surface p-5">
            <h3 className="text-h4">Delete this account</h3>
            <p className="mt-2 text-small text-ink-muted">Your name, contact details and addresses are removed and you are signed out. Orders and invoices are kept for tax records without your personal details. Orders still in progress must finish first.</p>
            <ActionForm action={deleteAccountAction} submitLabel="Delete my account" busyLabel="Deleting…" className="mt-4">
              <Input name="confirm" label="Type DELETE to confirm" required autoComplete="off" className="max-w-[12rem] font-mono uppercase" />
            </ActionForm>
          </div>
        </aside>
      </div>
    </div>
  );
}
