"use client";

import { useActionState, useState, type FormEvent } from "react";
import Link from "next/link";
import { Input, PhoneInput, Textarea } from "@safuney/ui";
import { submitContactForm, type ContactFormState } from "@/app/contact/actions";
import { site } from "@/config/site";
import { whatsappHref } from "@/lib/contact";
import { btn } from "./buttons";
import { Icon } from "./icons";

interface QuickQuoteProps {
  /**
   * Whether an enquiry has somewhere to go (lib/env.ts `services.leads`). When it does not — no
   * database and no email configured — the form composes the request as a WhatsApp message instead of
   * submitting to a server that would only apologise.
   */
  leadsEnabled: boolean;
  /** Pre-filled "What do you need?" text. */
  initialNeed?: string;
}

function compose(name: string, organisation: string, need: string): string {
  return `Hello Safuney, this is ${name}${organisation ? ` from ${organisation}` : ""}. Please quote for: ${need}`;
}

/**
 * The short quote form: four fields, one button. Long enough to price from, short enough to finish on
 * a phone. The full form at /quote stays for line-by-line orders.
 */
export function QuickQuote({ leadsEnabled, initialNeed = "" }: QuickQuoteProps) {
  const [state, formAction, pending] = useActionState<ContactFormState, FormData>(submitContactForm, { ok: null });
  const [handoff, setHandoff] = useState<string | null>(null);
  const [localErrors, setLocalErrors] = useState<{ name?: string; message?: string }>({});

  function sendByWhatsApp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const organisation = String(data.get("organisation") ?? "").trim();
    const need = String(data.get("message") ?? "").trim();
    const errors: typeof localErrors = {};
    if (!name) errors.name = "Enter your name so we know who is asking.";
    if (need.length < 3) errors.message = "Tell us what you need: products, pack sizes and quantities, or the site.";
    setLocalErrors(errors);
    if (errors.name || errors.message) return;
    const href = whatsappHref(compose(name, organisation, need));
    setHandoff(href);
    window.open(href, "_blank", "noopener,noreferrer");
  }

  if (state.ok === true) {
    return (
      <div role="status" className="flex flex-col items-start gap-3">
        <span className="grid size-12 place-items-center rounded-full bg-cta/20 text-brand-green-ink">
          <Icon name="check" className="size-6" />
        </span>
        <h3 className="text-h3">Request received</h3>
        <p className="text-body text-ink-muted">
          Thanks, {state.name}. We will reply to {state.email} with a priced quote within one working day.
        </p>
      </div>
    );
  }

  if (handoff) {
    return (
      <div role="status" className="flex flex-col items-start gap-3">
        <span className="grid size-12 place-items-center rounded-full bg-whatsapp/25 text-[#0b6b37]">
          <Icon name="whatsapp" className="size-6" />
        </span>
        <h3 className="text-h3">Your request is ready in WhatsApp</h3>
        <p className="text-body text-ink-muted">Press send in WhatsApp and it reaches our sales team directly. We reply with a price within one working day.</p>
        <a href={handoff} target="_blank" rel="noopener noreferrer" className={btn.whatsapp}>
          <Icon name="whatsapp" className="size-5" />
          Open WhatsApp again
        </a>
      </div>
    );
  }

  const values = state.ok === false ? state.values : null;
  const fieldErrors = state.ok === false ? (state.fieldErrors ?? {}) : {};
  const formError = state.ok === false ? state.formError : undefined;

  return (
    <form action={leadsEnabled ? formAction : undefined} onSubmit={leadsEnabled ? undefined : sendByWhatsApp} noValidate className="grid gap-4">
      {formError ? (
        <div role="alert" className="rounded-chip border border-warning-ink bg-warning-wash p-4 text-small text-warning-ink">
          <p>{formError}</p>
          <a
            href={whatsappHref(compose(values?.name ?? "", values?.organisation ?? "", values?.message ?? ""))}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-2 font-medium underline underline-offset-[3px]"
          >
            <Icon name="whatsapp" className="size-4" />
            Send it on WhatsApp instead
          </a>
        </div>
      ) : null}

      <input type="hidden" name="topic" value="quote" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="name" label="Your name" autoComplete="name" defaultValue={values?.name ?? ""} error={fieldErrors.name ?? localErrors.name} />
        <Input name="organisation" label="Organisation" optional autoComplete="organization" defaultValue={values?.organisation ?? ""} />
        {leadsEnabled ? (
          <>
            <PhoneInput name="phone" label="Phone" placeholder="07xx xxx xxx" defaultValue={values?.phone ?? ""} error={fieldErrors.phone} />
            <Input name="email" label="Email" type="email" inputMode="email" autoComplete="email" defaultValue={values?.email ?? ""} error={fieldErrors.email} />
          </>
        ) : null}
      </div>
      <Textarea
        name="message"
        label="What do you need?"
        helper="Products, pack sizes and quantities, or describe the site."
        rows={3}
        defaultValue={values?.message ?? initialNeed}
        error={fieldErrors.message ?? localErrors.message}
      />

      {/* Honeypot: never shown to people. A value here means an automated submission. */}
      <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="quick-quote-website">Leave this field empty</label>
        <input id="quick-quote-website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <div className="flex flex-col gap-3">
        {leadsEnabled ? (
          <button type="submit" className={`${btn.cta} w-full`} disabled={pending} aria-busy={pending || undefined}>
            {pending ? "Sending…" : "Get my quote"}
            {pending ? null : <Icon name="arrowRight" className="size-5" />}
          </button>
        ) : (
          <button type="submit" className={`${btn.whatsapp} w-full`}>
            <Icon name="whatsapp" className="size-5" />
            Send my request on WhatsApp
          </button>
        )}
        <p className="text-caption text-ink-muted">
          We reply within one working day, and use your details only to answer this request.{" "}
          <Link href="/privacy" className="underline underline-offset-[3px]">
            Privacy
          </Link>
          . Prefer to talk? Call{" "}
          <a href={`tel:${site.contact.phone.e164}`} className="underline underline-offset-[3px]">
            {site.contact.phone.display}
          </a>
          .
        </p>
      </div>
    </form>
  );
}
