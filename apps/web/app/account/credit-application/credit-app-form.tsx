"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import Link from "next/link";
import { Button } from "@safuney/ui";
import { site } from "@/config/site";
import { submitCreditAppAction, type CreditAppState } from "./actions";

const control =
  "block w-full rounded-chip border border-stainless bg-surface px-3 text-body text-ink " +
  "focus:border-accent focus:shadow-[inset_0_0_0_1px_var(--color-accent)] aria-invalid:border-warning-ink";
const inputClass = `${control} h-12`;

export function CreditAppForm() {
  const [state, formAction, pending] = useActionState<CreditAppState, FormData>(submitCreditAppAction, { ok: null });
  const baseId = useId();
  const successRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.ok === true) successRef.current?.focus();
    else if (state.ok === false) summaryRef.current?.focus();
  }, [state]);

  if (state.ok === true) {
    return (
      <div ref={successRef} tabIndex={-1} className="rounded-chip border border-line bg-surface p-6 sm:p-8" aria-live="polite">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-accent text-white font-semibold">
            ✓
          </span>
          <h2 className="text-h3">Credit application submitted</h2>
        </div>
        <p className="mt-4 text-body text-ink">
          Application Reference: <span className="font-mono font-semibold text-accent">{state.applicationId}</span>
        </p>
        <p className="mt-2 text-small text-ink-muted max-w-[62ch]">
          Thank you. Our finance team will review your trade references and KRA details. Corporate accounts are typically reviewed and approved within 2 working days.
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          <Link
            href="/products"
            className="inline-flex min-h-11 items-center rounded-button bg-ink px-4 text-button text-white hover:bg-accent-deep"
          >
            Browse products
          </Link>
          <Link
            href="/account"
            className="inline-flex min-h-11 items-center rounded-button border border-stainless bg-surface px-4 text-button text-ink hover:bg-ground-deep"
          >
            Go to Account dashboard
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
            {state.formError ? state.formError : "Please correct the errors below"}
          </h2>
        </div>
      ) : null}

      <div className="border-b border-line pb-4">
        <h2 className="text-h4 font-semibold text-ink">1. Entity & Tax details</h2>
        <p className="text-small text-ink-muted">Registered corporate details for eTIMS invoicing.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={id("legalName")} className="block text-label">
            Registered corporate name <span className="text-accent">*</span>
          </label>
          <input
            id={id("legalName")}
            name="legalName"
            type="text"
            required
            autoComplete="organization"
            placeholder="e.g. Sarova Hotels Management Limited"
            defaultValue={values.legalName ?? ""}
            className={inputClass}
            aria-invalid={errors.legalName ? true : undefined}
          />
          {errors.legalName ? <p className="mt-1 text-small text-warning-ink">{errors.legalName}</p> : null}
        </div>

        <div>
          <label htmlFor={id("kraPin")} className="block text-label">
            KRA PIN <span className="text-accent">*</span>
          </label>
          <input
            id={id("kraPin")}
            name="kraPin"
            type="text"
            required
            placeholder="P05..."
            defaultValue={values.kraPin ?? ""}
            className={inputClass}
            aria-invalid={errors.kraPin ? true : undefined}
          />
          {errors.kraPin ? <p className="mt-1 text-small text-warning-ink">{errors.kraPin}</p> : null}
        </div>

        <div>
          <label htmlFor={id("vatNumber")} className="block text-label">
            VAT registration number <span className="text-small font-normal text-ink-muted">(if registered)</span>
          </label>
          <input
            id={id("vatNumber")}
            name="vatNumber"
            type="text"
            placeholder="e.g. 0123456M"
            defaultValue={values.vatNumber ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      <div className="border-b border-line pb-4 pt-2">
        <h2 className="text-h4 font-semibold text-ink">2. Contact person</h2>
        <p className="text-small text-ink-muted">Procurement officer or finance contact authorized to place orders.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <div>
          <label htmlFor={id("contactName")} className="block text-label">
            Full name <span className="text-accent">*</span>
          </label>
          <input
            id={id("contactName")}
            name="contactName"
            type="text"
            required
            autoComplete="name"
            defaultValue={values.contactName ?? ""}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor={id("contactEmail")} className="block text-label">
            Corporate email <span className="text-accent">*</span>
          </label>
          <input
            id={id("contactEmail")}
            name="contactEmail"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            defaultValue={values.contactEmail ?? ""}
            className={inputClass}
            aria-invalid={errors.contactEmail ? true : undefined}
          />
          {errors.contactEmail ? <p className="mt-1 text-small text-warning-ink">{errors.contactEmail}</p> : null}
        </div>

        <div>
          <label htmlFor={id("contactPhone")} className="block text-label">
            Phone number <span className="text-accent">*</span>
          </label>
          <input
            id={id("contactPhone")}
            name="contactPhone"
            type="tel"
            required
            placeholder="07xx xxx xxx"
            defaultValue={values.contactPhone ?? ""}
            className={inputClass}
            aria-invalid={errors.contactPhone ? true : undefined}
          />
          {errors.contactPhone ? <p className="mt-1 text-small text-warning-ink">{errors.contactPhone}</p> : null}
        </div>
      </div>

      <div className="border-b border-line pb-4 pt-2">
        <h2 className="text-h4 font-semibold text-ink">3. Requested credit terms</h2>
        <p className="text-small text-ink-muted">Safuney standard credit policy: 30 days standard, 45 days for full hygiene programme contracts.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor={id("requestedLimitKES")} className="block text-label">
            Requested credit limit (KES) <span className="text-accent">*</span>
          </label>
          <input
            id={id("requestedLimitKES")}
            name="requestedLimitKES"
            type="number"
            step="10000"
            required
            placeholder="e.g. 100000"
            defaultValue={values.requestedLimitKES ?? "100000"}
            className={inputClass}
            aria-invalid={errors.requestedLimitKES ? true : undefined}
          />
          {errors.requestedLimitKES ? <p className="mt-1 text-small text-warning-ink">{errors.requestedLimitKES}</p> : null}
        </div>

        <div>
          <label htmlFor={id("requestedTermsDays")} className="block text-label">
            Payment terms
          </label>
          <select id={id("requestedTermsDays")} name="requestedTermsDays" defaultValue={values.requestedTermsDays ?? "30"} className={inputClass}>
            <option value="30">30 days from invoice (Standard corporate)</option>
            <option value="45">45 days from invoice (Annual Total Hygiene Programme)</option>
          </select>
        </div>
      </div>

      <div className="border-b border-line pb-4 pt-2">
        <h2 className="text-h4 font-semibold text-ink">4. Trade references</h2>
        <p className="text-small text-ink-muted">Current institutional or commercial suppliers who extend credit to your organisation.</p>
      </div>

      <div className="grid gap-4 rounded-chip border border-line bg-ground p-4">
        <p className="text-label font-medium text-ink">Reference 1 <span className="text-accent">*</span></p>
        <div className="grid gap-4 sm:grid-cols-3">
          <input name="ref1Company" type="text" required placeholder="Supplier / Company name" defaultValue={values.ref1Company ?? ""} className={inputClass} />
          <input name="ref1Contact" type="text" required placeholder="Contact person" defaultValue={values.ref1Contact ?? ""} className={inputClass} />
          <input name="ref1Phone" type="tel" required placeholder="Phone number" defaultValue={values.ref1Phone ?? ""} className={inputClass} />
        </div>
        {errors.ref1 ? <p className="text-small text-warning-ink">{errors.ref1}</p> : null}
      </div>

      <div className="grid gap-4 rounded-chip border border-line bg-ground p-4">
        <p className="text-label font-medium text-ink">Reference 2 <span className="text-small font-normal text-ink-muted">(optional)</span></p>
        <div className="grid gap-4 sm:grid-cols-3">
          <input name="ref2Company" type="text" placeholder="Supplier / Company name" defaultValue={values.ref2Company ?? ""} className={inputClass} />
          <input name="ref2Contact" type="text" placeholder="Contact person" defaultValue={values.ref2Contact ?? ""} className={inputClass} />
          <input name="ref2Phone" type="tel" placeholder="Phone number" defaultValue={values.ref2Phone ?? ""} className={inputClass} />
        </div>
      </div>

      {/* Honeypot field */}
      <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor={id("website")}>Leave empty</label>
        <input id={id("website")} name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <div className="pt-2">
        <Button type="submit" busy={pending} busyLabel="Submitting application…" className="w-full sm:w-auto">
          Submit credit application
        </Button>
        <p className="mt-3 text-small text-ink-muted">
          By applying, you agree to Safuney&apos;s credit assessment process and{" "}
          <Link href="/terms" className="text-accent underline underline-offset-[3px]">
            Terms of sale
          </Link>
          . For queries, contact credit control on {site.contact.phone.display}.
        </p>
      </div>
    </form>
  );
}
