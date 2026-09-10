import type { Metadata } from "next";
import { Input, PhoneInput, Textarea } from "@safuney/ui";
import { site } from "@/config/site";
import { viewer } from "@/lib/auth/session";
import { readCart } from "@/lib/cart/cookies";
import { telHref, whatsappHref } from "@/lib/contact";
import { services } from "@/lib/env";
import { requestQuoteAction } from "@/lib/b2b/quote-actions";
import { ActionForm } from "@/components/account/action-form";
import { btn } from "@/components/marketing/buttons";
import { Crumbs } from "@/components/marketing/crumbs";
import { Icon } from "@/components/marketing/icons";
import { QuickQuote } from "@/components/marketing/quick-quote";

export const metadata: Metadata = {
  title: "Request a quote",
  description: "Large orders, uncatalogued products or a full site list: tell us what you need and we price it within one working day.",
};
export const dynamic = "force-dynamic";

/** Whatever the visitor was looking at when they asked, turned into the first line of the request. */
function prefillFrom(params: Record<string, string | string[] | undefined>): string {
  const one = (k: string) => (Array.isArray(params[k]) ? params[k]?.[0] : params[k])?.trim() || "";
  const sku = one("sku");
  const product = one("product");
  const pack = one("pack");
  const category = one("category");
  const q = one("q");
  if (sku) return sku;
  if (product) return pack ? `${product} ${pack}` : product;
  if (category) return category.replace(/-/g, " ");
  return q;
}

const NEXT_STEPS = [
  { title: "We read it the same day", body: "A person on the sales team, not an auto-reply." },
  { title: "You get a priced quote", body: "Within one working day, with pack sizes, dilutions and delivery." },
  { title: "Accept and we deliver", body: "Accept online, pay by M-Pesa, card or on account, and it is on its way." },
];

export default async function QuotePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const prefill = prefillFrom(await searchParams);
  // The full line-by-line form needs the database to store the quote; without it the short form hands
  // the request to email or WhatsApp instead of failing (lib/env.ts `services.leads`).
  const full = services.database();
  const who = full ? await viewer() : null;
  const cart = full ? await readCart() : null;
  const hasCart = Boolean(cart && cart.lines.length > 0);

  return (
    <>
      <section aria-labelledby="quote-heading" className="on-dark bg-hero">
        <div className="mx-auto max-w-page px-5 py-10 md:px-6 md:py-14">
          <Crumbs items={[{ label: "Request a quote" }]} />
          <h1 id="quote-heading" className="mt-4 text-h1 text-white">
            Request a quote
          </h1>
          <p className="mt-3 max-w-[60ch] text-body-lg text-white/75">
            Pallet quantities, a whole site&rsquo;s cleaning list, or a product we do not list. We price it within one working day.
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-page gap-10 px-5 py-10 md:px-6 md:py-14 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="rounded-[20px] border border-line bg-surface p-6 shadow-card md:p-8">
            {full ? (
              <ActionForm action={requestQuoteAction} submitLabel="Send the request" busyLabel="Sending…">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Input name="name" label="Your name" defaultValue={who?.name ?? ""} required autoComplete="name" />
                  <Input name="organisation" label="Organisation" optional autoComplete="organization" />
                  <Input name="email" label="Email address" type="email" defaultValue={who?.email ?? ""} required autoComplete="email" helper="The quote link goes here." />
                  <PhoneInput name="phone" label="Phone number" defaultValue={who?.phone?.replace(/^\+254/, "0") ?? ""} required />
                </div>
                {hasCart ? (
                  <label className="flex items-start gap-3 rounded-chip border border-line p-4">
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
                      <Input name={`line${i}`} label={`Line ${i}`} defaultValue={i === 1 ? prefill : ""} placeholder={i === 1 ? "Chlorine disinfectant 20 L" : ""} required={i === 1 && !hasCart} />
                      <Input name={`qty${i}`} label="Qty" type="number" min={1} max={9999} defaultValue={1} inputMode="numeric" />
                    </div>
                  ))}
                </fieldset>
                <Textarea name="notes" label="Anything else" optional rows={3} helper="Delivery site, how often you order, dilution or dispensing needs." />
              </ActionForm>
            ) : (
              <>
                <h2 className="text-h3 text-ink">Send us your list</h2>
                <p className="mt-1 text-small text-ink-muted">A name and what you need is enough. A person on the sales team replies.</p>
                <div className="mt-6">
                  <QuickQuote leadsEnabled={services.leads()} initialNeed={prefill} />
                </div>
              </>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-6 lg:col-span-5">
          <section aria-labelledby="next-steps" className="rounded-[20px] border border-line bg-surface p-6 shadow-card md:p-7">
            <h2 id="next-steps" className="text-h3 text-ink">
              What happens next
            </h2>
            <ol className="mt-5 flex flex-col gap-5">
              {NEXT_STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-small font-medium text-white tnum">{i + 1}</span>
                  <div>
                    <p className="text-h4 text-ink">{s.title}</p>
                    <p className="text-small text-ink-muted">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <section aria-labelledby="faster" className="on-dark bg-hero rounded-[20px] p-6 text-white shadow-lift md:p-7">
            <h2 id="faster" className="text-h3 text-white">
              Faster on WhatsApp
            </h2>
            <p className="mt-2 text-small text-white/75">Send your list, or a photo of your store room or last delivery note. We price from that.</p>
            <div className="mt-5 flex flex-col gap-3">
              <a href={whatsappHref(prefill ? `Hello Safuney, please quote for: ${prefill}` : "Hello Safuney, please quote for the following:")} target="_blank" rel="noopener noreferrer" className={btn.whatsapp}>
                <Icon name="whatsapp" className="size-5" />
                Send it on WhatsApp
              </a>
              <a href={telHref} className={btn.ghost}>
                <Icon name="phone" className="size-4" />
                Call {site.contact.phone.display}
              </a>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
