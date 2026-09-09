"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import Link from "next/link";
import { Button } from "@safuney/ui";
import { KENYAN_COUNTIES } from "@safuney/config";
import { site } from "@/config/site";
import { submitQuoteAction, type QuoteFormState } from "./actions";

interface QuoteFormProps {
  initialProduct?: string;
  initialPack?: string;
}

const control =
  "block w-full rounded-chip border border-stainless bg-surface px-3 text-body text-ink " +
  "focus:border-accent focus:shadow-[inset_0_0_0_1px_var(--color-accent)] aria-invalid:border-warning-ink";
const inputClass = `${control} h-12`;
const textareaClass = `${control} min-h-32 py-3`;

export function QuoteForm({ initialProduct, initialPack }: QuoteFormProps) {
  const [state, formAction, pending] = useActionState<QuoteFormState, FormData>(submitQuoteAction, { ok: null });
  const baseId = useId();
  const successRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.ok === true) successRef.current?.focus();
    else if (state.ok === false) summaryRef.current?.focus();
  }, [state]);

  const defaultItems = initialProduct
    ? `${initialPack ? `5x ` : ""}${initialProduct}${initialPack ? ` (${initialPack})` : ""}`
    : "";

  if (state.ok === true && state.quoteNumber) {
    return (
      <div ref={successRef} tabIndex={-1} className="rounded-chip border border-line bg-surface p-6 sm:p-8" aria-live="polite">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-accent text-white font-semibold">
            ✓
          </span>
          <h2 className="text-h3">Quote request received</h2>
        </div>
        <p className="mt-4 text-body text-ink">
          Reference: <span className="font-mono font-semibold text-accent">{state.quoteNumber}</span>
        </p>
        <p className="mt-2 text-ink-muted max-w-[62ch]">
          Our commercial sales team will review your specifications, prepare volume pricing, and email the priced quote within one working day.
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          <Link
            href={`/quotes/${state.quoteNumber}`}
            className="inline-flex min-h-11 items-center rounded-button bg-ink px-4 text-button text-white hover:bg-accent-deep"
          >
            Track quote status
          </Link>
          <Link
            href="/products"
            className="inline-flex min-h-11 items-center rounded-button border border-stainless bg-surface px-4 text-button text-ink hover:bg-ground-deep"
          >
            Continue browsing products
          </Link>
        </div>
      </div>
    );
  }

  const id = (f: string) => `${baseId}-${f}`;
  const values = state.values ?? {};
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="grid gap-6">
      {state.ok === false ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-chip border border-warning-ink bg-warning-wash p-4"
        >
          <h2 className="text-h4 font-medium text-ink">
            {state.formError ? state.formError : "Please correct the items highlighted below"}
          </h2>
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor={id("name")} className="block text-label">
            Contact name <span className="text-accent">*</span>
          </label>
          <input
            id={id("name")}
            name="name"
            type="text"
            required
            autoComplete="name"
            defaultValue={values.name ?? ""}
            className={inputClass}
            aria-invalid={errors.name ? true : undefined}
          />
          {errors.name ? <p className="mt-1 text-small text-warning-ink">{errors.name}</p> : null}
        </div>

        <div>
          <label htmlFor={id("organisation")} className="block text-label">
            Organisation / Company name <span className="text-small font-normal text-ink-muted">(optional)</span>
          </label>
          <input
            id={id("organisation")}
            name="organisation"
            type="text"
            autoComplete="organization"
            defaultValue={values.organisation ?? ""}
            className={inputClass}
            placeholder="e.g. Sarova Hotels, Nairobi Hospital"
          />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor={id("email")} className="block text-label">
            Business email <span className="text-accent">*</span>
          </label>
          <input
            id={id("email")}
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            defaultValue={values.email ?? ""}
            className={inputClass}
            aria-invalid={errors.email ? true : undefined}
          />
          {errors.email ? <p className="mt-1 text-small text-warning-ink">{errors.email}</p> : null}
        </div>

        <div>
          <label htmlFor={id("phone")} className="block text-label">
            Phone number <span className="text-accent">*</span>
          </label>
          <input
            id={id("phone")}
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            inputMode="tel"
            placeholder="07xx xxx xxx"
            defaultValue={values.phone ?? ""}
            className={inputClass}
            aria-invalid={errors.phone ? true : undefined}
          />
          {errors.phone ? <p className="mt-1 text-small text-warning-ink">{errors.phone}</p> : null}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor={id("county")} className="block text-label">
            Delivery county <span className="text-accent">*</span>
          </label>
          <select id={id("county")} name="county" required defaultValue={values.county ?? "Nairobi"} className={inputClass}>
            {KENYAN_COUNTIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {errors.county ? <p className="mt-1 text-small text-warning-ink">{errors.county}</p> : null}
        </div>

        <div>
          <label htmlFor={id("town")} className="block text-label">
            Town / Area / Site location
          </label>
          <input
            id={id("town")}
            name="town"
            type="text"
            placeholder="e.g. Westlands, Industrial Area, Ruiru"
            defaultValue={values.town ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor={id("items")} className="block text-label">
          Requested products & quantities <span className="text-accent">*</span>
        </label>
        <p className="mt-1 text-small text-ink-muted">
          List the items and pack sizes (e.g. 5x QAC surface sanitiser 20L, 2x Bleach 200L drum, 10x Kitchen degreaser 5L).
        </p>
        <textarea
          id={id("items")}
          name="items"
          required
          rows={4}
          defaultValue={values.items ?? defaultItems}
          className={textareaClass}
          aria-invalid={errors.items ? true : undefined}
        />
        {errors.items ? <p className="mt-1 text-small text-warning-ink">{errors.items}</p> : null}
      </div>

      <div className="space-y-3 rounded-chip border border-line bg-ground p-4">
        <p className="text-label font-medium text-ink">Commercial programmes & services</p>
        <div className="flex items-start gap-3">
          <input
            id={id("trialRequested")}
            name="trialRequested"
            type="checkbox"
            className="mt-1 size-5 shrink-0 rounded-chip border-stainless accent-accent"
          />
          <label htmlFor={id("trialRequested")} className="text-small text-ink">
            <strong>Request free 14-day on-site hygiene trial</strong>: Loaned dispenser or warewash/laundry dosing installed at Safuney's cost with trial product and comparative cost-in-use audit.
          </label>
        </div>

        <div className="flex items-start gap-3">
          <input
            id={id("dosingRequested")}
            name="dosingRequested"
            type="checkbox"
            className="mt-1 size-5 shrink-0 rounded-chip border-stainless accent-accent"
          />
          <label htmlFor={id("dosingRequested")} className="text-small text-ink">
            <strong>Automated dosing equipment installation</strong>: Wall-mounted dilution stations or multi-pump commercial dishwasher/laundry dosing units under annual contract.
          </label>
        </div>
      </div>

      <div>
        <label htmlFor={id("notes")} className="block text-label">
          Special requirements / Audit notes <span className="text-small font-normal text-ink-muted">(optional)</span>
        </label>
        <textarea
          id={id("notes")}
          name="notes"
          rows={2}
          placeholder="e.g. Need food safety COA certificates, KRA eTIMS invoice required, specific contact times."
          defaultValue={values.notes ?? ""}
          className={textareaClass}
        />
      </div>

      {/* Honeypot field */}
      <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor={id("website")}>Leave empty</label>
        <input id={id("website")} name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <div>
        <Button type="submit" busy={pending} busyLabel="Submitting quote request…" className="w-full sm:w-auto">
          Send quote request
        </Button>
        <p className="mt-3 text-small text-ink-muted">
          Need an immediate quote by phone? Call our commercial desk on{" "}
          <a href={`tel:${site.contact.phone.e164}`} className="text-accent underline underline-offset-[3px]">
            {site.contact.phone.display}
          </a>
          .
        </p>
      </div>
    </form>
  );
}
