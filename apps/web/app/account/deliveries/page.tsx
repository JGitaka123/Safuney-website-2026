import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@safuney/db";
import { Input, Select } from "@safuney/ui";
import { requireViewer } from "@/lib/auth/session";
import { readCart } from "@/lib/cart/cookies";
import { orderService, paymentRegistry } from "@/lib/orders/context";
import { creditPosition } from "@/lib/b2b/credit";
import { INTERVALS, SubscriptionService } from "@/lib/b2b/subscriptions";
import { scheduleFromCartAction } from "@/lib/b2b/subscription-actions";
import { AccountNav } from "@/components/account/account-nav";
import { ActionForm } from "@/components/account/action-form";
import { ScheduleCard } from "@/components/account/schedule-card";

export const metadata: Metadata = { title: "Scheduled deliveries", robots: { index: false } };
export const dynamic = "force-dynamic";

const INTERVAL_LABEL: Record<number, string> = { 7: "Every week", 14: "Every two weeks", 28: "Every four weeks", 56: "Every eight weeks" };

/** Default dates for the schedule form (a helper so the component body stays pure). */
function defaultDates(): { today: string; nextWeek: string } {
  const now = Date.now();
  return { today: new Date(now).toISOString().slice(0, 10), nextWeek: new Date(now + 7 * 86_400_000).toISOString().slice(0, 10) };
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeZone: "Africa/Nairobi" }).format(d);
}

export default async function DeliveriesPage() {
  const who = await requireViewer("/account/deliveries");
  const organisation = who.memberships.find((m) => m.customer.type === "ORGANISATION");
  const schedules = await new SubscriptionService(db(), orderService()).listFor(who.id);
  const cart = await readCart();
  const registry = paymentRegistry();
  const credit = organisation ? await creditPosition(db(), organisation.customerId) : null;
  const { today, nextWeek } = defaultDates();

  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <h1 className="text-h1">Scheduled deliveries</h1>
      <AccountNav current="/account/deliveries" organisation={Boolean(organisation)} />
      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <section aria-labelledby="schedules-heading" className="min-w-0 lg:col-span-7">
          <h2 id="schedules-heading" className="sr-only">
            Your schedules
          </h2>
          {schedules.length === 0 ? (
            <p className="text-body text-ink-muted">A schedule places the same order for you on a rhythm: the same packs, every four weeks, collected or delivered. We email you three days before each one so you can skip or change it.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {schedules.map((s) => (
                <ScheduleCard
                  key={s.id}
                  schedule={{
                    id: s.id,
                    status: s.status,
                    intervalLabel: INTERVAL_LABEL[s.intervalDays] ?? `Every ${s.intervalDays} days`,
                    nextRunLabel: formatDate(s.nextRunAt),
                    paymentMethod: s.paymentMethod,
                    items: s.items.map((i) => `${i.variant.product.name} ${i.variant.packLabel} × ${i.qty}`),
                    runs: s.runs.map((r) => ({ id: r.id, status: r.status, when: formatDate(r.ranAt), orderNumber: r.order?.number ?? null, href: r.order ? `/orders/${r.order.number}?token=${r.order.accessToken}` : null, error: r.error })),
                  }}
                />
              ))}
            </div>
          )}
        </section>
        <aside className="min-w-0 lg:col-span-5">
          <div className="border border-line bg-surface p-5">
            <h2 className="text-h3">Schedule your cart</h2>
            {!cart || cart.lines.length === 0 ? (
              <p className="mt-2 text-body text-ink-muted">
                Put the packs you want on repeat in your{" "}
                <Link href="/products" className="text-accent underline underline-offset-[3px]">
                  cart
                </Link>{" "}
                first, then set the rhythm here.
              </p>
            ) : (
              <>
                <ul className="mt-3 text-small text-ink">
                  {cart.lines.map((l) => (
                    <li key={l.variantId}>
                      {l.name} {l.packLabel} × {l.qty}
                    </li>
                  ))}
                </ul>
                <ActionForm action={scheduleFromCartAction} submitLabel="Start the schedule" busyLabel="Scheduling…" className="mt-4">
                  <Select name="intervalDays" label="How often" defaultValue="28">
                    {INTERVALS.map((d) => (
                      <option key={d} value={d}>
                        {INTERVAL_LABEL[d]}
                      </option>
                    ))}
                  </Select>
                  <Input name="firstRunAt" label="First delivery" type="date" defaultValue={nextWeek} min={today} required />
                  <Select name="paymentMethod" label="Paid by" defaultValue="COD" helper="M-Pesa sends a request to your phone on the day; cash is paid to the rider.">
                    <option value="COD">Cash or M-Pesa on delivery</option>
                    {registry.MPESA.isConfigured() ? <option value="MPESA">M-Pesa request on the day</option> : null}
                    {registry.CARD.isConfigured() ? <option value="CARD">Card link on the day</option> : null}
                    {credit?.approved ? <option value="INVOICE">Invoice (credit account)</option> : null}
                  </Select>
                  <p className="text-small text-ink-muted">Collected from Mombasa Road unless you add a delivery address to the account (coming with the account pages in Phase 5).</p>
                </ActionForm>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
