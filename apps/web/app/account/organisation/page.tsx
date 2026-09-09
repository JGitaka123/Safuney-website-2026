import type { Metadata } from "next";
import Link from "next/link";
import { db, money } from "@safuney/db";
import { Input, Select } from "@safuney/ui";
import { requireViewer } from "@/lib/auth/session";
import { inviteMemberAction, removeMemberAction, setMemberRoleAction, updateOrganisationAction } from "@/lib/b2b/actions";
import { AccountNav } from "@/components/account/account-nav";
import { ActionForm } from "@/components/account/action-form";
import { MemberRow } from "@/components/account/member-row";

export const metadata: Metadata = { title: "Organisation", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OrganisationPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const { created } = await searchParams;
  const who = await requireViewer("/account/organisation");
  const membership = who.memberships.find((m) => m.customer.type === "ORGANISATION");

  if (!membership) {
    return (
      <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
        <h1 className="text-h1">Organisation</h1>
        <AccountNav current="/account/organisation" organisation={false} />
        <div className="mt-6 max-w-[40rem] border border-line bg-surface p-6">
          <h2 className="text-h3">Set up an organisation account</h2>
          <p className="mt-2 text-body text-ink-muted">One account for a hotel, hospital, school, contractor or business: colleagues order under it, an approver signs off on large orders, every order carries your purchase-order number, and you can apply to pay on invoice.</p>
          <Link href="/account/organisation/new" className="mt-5 inline-flex min-h-12 items-center rounded-button bg-ink px-5 text-button text-white hover:bg-accent-deep">
            Create the organisation
          </Link>
        </div>
      </div>
    );
  }

  const customer = await db().customer.findUniqueOrThrow({
    where: { id: membership.customerId },
    include: { members: { include: { user: { select: { id: true, name: true, email: true, phone: true } } }, orderBy: { createdAt: "asc" } } },
  });
  const isOwner = membership.role === "OWNER";

  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <h1 className="text-h1">{customer.displayName}</h1>
      <AccountNav current="/account/organisation" organisation />
      {created ? (
        <p role="status" className="mt-6 border border-line bg-surface p-4 text-body text-ink">
          Organisation created. Add your colleagues below and, when you are ready, apply for a credit account.
        </p>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <section aria-labelledby="members-heading" className="min-w-0 lg:col-span-7">
          <h2 id="members-heading" className="text-h2">
            Members
          </h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {customer.members.map((m) => (
              <MemberRow key={m.id} customerId={customer.id} member={{ userId: m.user.id, label: m.user.name ?? m.user.email ?? m.user.phone ?? "Member", detail: m.user.name ? (m.user.email ?? m.user.phone ?? "") : "", role: m.role }} isSelf={m.user.id === who.id} canEdit={isOwner} setRole={setMemberRoleAction} remove={removeMemberAction} />
            ))}
          </ul>
          {isOwner ? (
            <div className="mt-6 border border-line bg-surface p-5">
              <h3 className="text-h4">Add a colleague</h3>
              <p className="mt-1 text-small text-ink-muted">Buyers place orders. Approvers decide orders above the threshold. Owners manage the account.</p>
              <ActionForm action={inviteMemberAction.bind(null, customer.id)} submitLabel="Add member" busyLabel="Adding…" className="mt-4">
                <Input name="email" label="Work email" type="email" required autoComplete="off" />
                <Select name="role" label="Role" defaultValue="BUYER">
                  <option value="BUYER">Buyer</option>
                  <option value="APPROVER">Approver</option>
                  <option value="OWNER">Owner</option>
                </Select>
              </ActionForm>
            </div>
          ) : null}
        </section>

        <aside className="min-w-0 lg:col-span-5">
          <h2 className="text-h2">Settings</h2>
          {isOwner ? (
            <ActionForm action={updateOrganisationAction.bind(null, customer.id)} submitLabel="Save settings" className="mt-4 border border-line bg-surface p-5">
              <Input name="displayName" label="Organisation name" defaultValue={customer.displayName} required />
              <Input name="legalName" label="Registered company name" defaultValue={customer.legalName ?? ""} optional helper="As it should appear on tax invoices." />
              <Input name="kraPin" label="KRA PIN" defaultValue={customer.kraPin ?? ""} optional helper="A letter, nine digits and a letter, for example P051234567X." className="font-mono uppercase" />
              <Input name="approvalThreshold" label="Approval threshold (KES)" defaultValue={customer.approvalThresholdMinorUnits !== null ? money.formatKes(customer.approvalThresholdMinorUnits).replace(/^KES\s/, "") : ""} optional helper="Buyers' orders at or above this amount wait for an approver. Leave empty for no approvals." inputMode="decimal" />
            </ActionForm>
          ) : (
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border border-line bg-surface p-5 text-body">
              <dt className="text-ink-muted">Registered name</dt>
              <dd>{customer.legalName ?? "Not set"}</dd>
              <dt className="text-ink-muted">KRA PIN</dt>
              <dd className="font-mono">{customer.kraPin ?? "Not set"}</dd>
              <dt className="text-ink-muted">Approval threshold</dt>
              <dd className="tabular-nums">{customer.approvalThresholdMinorUnits !== null ? money.formatKes(customer.approvalThresholdMinorUnits) : "No approvals"}</dd>
            </dl>
          )}
        </aside>
      </div>
    </div>
  );
}
