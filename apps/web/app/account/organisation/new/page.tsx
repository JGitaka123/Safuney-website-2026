import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Input } from "@safuney/ui";
import { requireViewer } from "@/lib/auth/session";
import { createOrganisationAction } from "@/lib/b2b/actions";
import { AccountNav } from "@/components/account/account-nav";
import { ActionForm } from "@/components/account/action-form";

export const metadata: Metadata = { title: "New organisation", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewOrganisationPage() {
  const who = await requireViewer("/account/organisation/new");
  if (who.memberships.some((m) => m.customer.type === "ORGANISATION")) redirect("/account/organisation");
  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <h1 className="text-h1">Create an organisation</h1>
      <AccountNav current="/account/organisation" organisation={false} />
      <div className="mt-6 max-w-[40rem]">
        <p className="text-body text-ink-muted">You become the owner. Add buyers and approvers next; apply for a credit account when you are ready to pay on invoice.</p>
        <ActionForm action={createOrganisationAction} submitLabel="Create the organisation" busyLabel="Creating…" className="mt-6 border border-line bg-surface p-6">
          <Input name="displayName" label="Organisation name" helper="The name your team knows, for example Nairobi Hospital Stores." required autoFocus />
          <Input name="legalName" label="Registered company name" optional helper="For tax invoices; you can add it later." />
          <Input name="kraPin" label="KRA PIN" optional helper="A letter, nine digits and a letter, for example P051234567X." className="font-mono uppercase" />
          <Input name="approvalThreshold" label="Approval threshold (KES)" optional helper="Buyers' orders at or above this amount wait for an approver. Leave empty for no approvals." inputMode="decimal" />
        </ActionForm>
      </div>
    </div>
  );
}
