import type { Metadata } from "next";
import { db } from "@safuney/db";
import { requireViewer } from "@/lib/auth/session";
import { AddressService } from "@/lib/account/addresses";
import { createAddressAction, updateAddressAction } from "@/lib/account/address-actions";
import { AccountNav } from "@/components/account/account-nav";
import { AddressCard } from "@/components/account/address-card";
import { AddressForm } from "@/components/account/address-form";

export const metadata: Metadata = { title: "Delivery addresses", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AddressesPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const who = await requireViewer("/account/addresses");
  const list = await new AddressService(db()).listFor(who.id);
  const editing = edit ? (list.find((a) => a.id === edit) ?? null) : null;
  const organisation = who.memberships.some((m) => m.customer.type === "ORGANISATION");
  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <h1 className="text-h1">Delivery addresses</h1>
      <AccountNav current="/account/addresses" organisation={organisation} />
      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <section aria-labelledby="addresses-heading" className="min-w-0 lg:col-span-7">
          <h2 id="addresses-heading" className="sr-only">
            Saved addresses
          </h2>
          {list.length === 0 ? (
            <p className="text-body text-ink-muted">Save the places we deliver to: the kitchen store, the receiving bay, a second site. Checkout and scheduled deliveries pick from this list.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {list.map((a) => (
                <AddressCard key={a.id} address={{ id: a.id, label: a.label, recipientName: a.recipientName, phone: a.phone, lines: [a.line1, a.landmark ? `near ${a.landmark}` : null, a.town, a.county].filter((x): x is string => Boolean(x)), isDefault: a.isDefault }} editHref={`/account/addresses?edit=${a.id}#address-form`} />
              ))}
            </div>
          )}
        </section>
        <aside className="min-w-0 lg:col-span-5" id="address-form">
          <h2 className="text-h3">{editing ? `Edit ${editing.label ?? editing.recipientName}` : "Add an address"}</h2>
          <div className="mt-3">
            {editing ? <AddressForm key={editing.id} action={updateAddressAction.bind(null, editing.id)} address={editing} submitLabel="Save changes" /> : <AddressForm action={createAddressAction} submitLabel="Save address" />}
          </div>
        </aside>
      </div>
    </div>
  );
}
