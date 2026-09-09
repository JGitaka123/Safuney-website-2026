import type { Metadata } from "next";
import { Input, PhoneInput, Textarea } from "@safuney/ui";
import { viewer } from "@/lib/auth/session";
import { readCart } from "@/lib/cart/cookies";
import { services } from "@/lib/env";
import { requestQuoteAction } from "@/lib/b2b/quote-actions";
import { ActionForm } from "@/components/account/action-form";

export const metadata: Metadata = {
  title: "Request a quote",
  description: "Large orders, uncatalogued products or a full site list: tell us what you need and we price it within one working day.",
};
export const dynamic = "force-dynamic";

export default async function QuotePage() {
  const who = services.database() ? await viewer() : null;
  const cart = services.database() ? await readCart() : null;
  const hasCart = Boolean(cart && cart.lines.length > 0);
  return (
    <div className="mx-auto max-w-page px-5 py-10 md:px-6 md:py-16">
      <div className="max-w-[44rem]">
        <h1 className="text-h1">Request a quote</h1>
        <p className="mt-3 text-body text-ink-muted">For pallet quantities, products we do not list, or a whole site&rsquo;s cleaning schedule. We price it within one working day and email you a link to accept; accepting places the order at the quoted prices.</p>
        <ActionForm action={requestQuoteAction} submitLabel="Send the request" busyLabel="Sending…" className="mt-8 border border-line bg-surface p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <Input name="name" label="Your name" defaultValue={who?.name ?? ""} required autoComplete="name" />
            <Input name="organisation" label="Organisation" optional autoComplete="organization" />
            <Input name="email" label="Email address" type="email" defaultValue={who?.email ?? ""} required autoComplete="email" helper="The quote link goes here." />
            <PhoneInput name="phone" label="Phone number" defaultValue={who?.phone?.replace(/^\+254/, "0") ?? ""} required />
          </div>
          {hasCart ? (
            <label className="flex items-start gap-3 border border-line p-4">
              <input type="checkbox" name="includeCart" defaultChecked className="mt-1 size-4 accent-accent" />
              <span className="text-body text-ink">
                Include the {cart!.lines.length} line{cart!.lines.length === 1 ? "" : "s"} in my cart
                <span className="block text-small text-ink-muted">{cart!.lines.map((l) => `${l.name} ${l.packLabel} × ${l.qty}`).join(" · ")}</span>
              </span>
            </label>
          ) : null}
          <fieldset className="flex flex-col gap-3">
            <legend className="text-body font-medium text-ink">What do you need?</legend>
            <p className="text-small text-ink-muted">Product, pack size and quantity per line. Brands you use today are fine; we will match or suggest.</p>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="grid grid-cols-[1fr_6rem] gap-3">
                <Input name={`line${i}`} label={`Line ${i}`} placeholder={i === 1 ? "Chlorine disinfectant 20 L" : ""} required={i === 1 && !hasCart} />
                <Input name={`qty${i}`} label="Qty" type="number" min={1} max={9999} defaultValue={1} inputMode="numeric" />
              </div>
            ))}
          </fieldset>
          <Textarea name="notes" label="Anything else" optional rows={3} helper="Delivery site, how often you order, dilution or dispensing needs." />
        </ActionForm>
      </div>
    </div>
  );
}
