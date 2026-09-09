"use client";

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@safuney/ui";
import { site } from "@/config/site";
import { LEAD_TOPICS, isLeadTopic, submitLabels, topicLabels, type LeadField, type LeadTopic } from "@/lib/leads";
import { submitContactForm, type ContactFormState } from "./actions";

export interface ContactFormProps {
  initialTopic: LeadTopic;
  /** First line(s) of the message, built from the page's query string. */
  initialMessage: string;
  /** Category slug carried through to the lead payload. */
  category: string | null;
}

const fieldOrder: LeadField[] = ["name", "organisation", "email", "phone", "topic", "message", "consent"];
const fieldNames: Record<LeadField, string> = {
  name: "Name",
  organisation: "Organisation",
  email: "Email",
  phone: "Phone",
  topic: "Topic",
  message: "Message",
  consent: "Marketing consent",
};

// Plan §6.3: 48 px tall, surface fill, 1 px stainless border, 2 px radius, 2 px accent border on focus.
const control =
  "block w-full rounded-chip border border-stainless bg-surface px-3 text-body text-ink " +
  "focus:border-accent focus:shadow-[inset_0_0_0_1px_var(--color-accent)] aria-invalid:border-warning-ink";
const inputClass = `${control} h-12`;
const textareaClass = `${control} min-h-40 py-3`;

interface FieldProps {
  id: string;
  label: string;
  helper?: string;
  error?: string;
  optional?: boolean;
  children: (a11y: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => ReactNode;
}

function Field({ id, label, helper, error, optional, children }: FieldProps) {
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const describedBy = [helper ? helperId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-label">
        {label}
        {optional ? <span className="ml-1 font-normal text-ink-muted">(optional)</span> : null}
      </label>
      {helper ? (
        <p id={helperId} className="mt-1 text-small text-ink-muted">
          {helper}
        </p>
      ) : null}
      <div className="mt-2">{children({ id, "aria-describedby": describedBy, ...(error ? { "aria-invalid": true as const } : {}) })}</div>
      {error ? (
        <p id={errorId} className="mt-2 text-small text-warning-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ContactForm({ initialTopic, initialMessage, category }: ContactFormProps) {
  const [state, formAction, pending] = useActionState<ContactFormState, FormData>(submitContactForm, { ok: null });
  const [topic, setTopic] = useState<LeadTopic>(initialTopic);
  const summaryRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const baseId = useId();

  const values = state.ok === false ? state.values : null;
  const errors = state.ok === false ? (state.fieldErrors ?? {}) : {};
  const formError = state.ok === false ? state.formError : undefined;
  const errorList = fieldOrder.filter((f) => errors[f]);

  useEffect(() => {
    if (state.ok === true) successRef.current?.focus();
    else if (state.ok === false) summaryRef.current?.focus();
  }, [state]);

  if (state.ok === true) {
    return (
      <div ref={successRef} tabIndex={-1} className="rounded-chip border border-line bg-surface p-6" aria-live="polite">
        <h2 className="text-h3">Message sent</h2>
        <p className="mt-3 max-w-[62ch]">
          Thanks, {state.name}. We will reply to {state.email} within one working day.
        </p>
        <p className="mt-3 max-w-[62ch] text-ink-muted">
          If you need something sooner, call{" "}
          <a href={`tel:${site.contact.phone.e164}`} className="text-accent underline underline-offset-[3px]">
            {site.contact.phone.display}
          </a>
          .
        </p>
      </div>
    );
  }

  const id = (field: string) => `${baseId}-${field}`;

  return (
    <form action={formAction} noValidate className="grid gap-6">
      {state.ok === false ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-chip border border-warning-ink bg-warning-wash p-4"
          aria-labelledby={id("summary-heading")}
        >
          <h2 id={id("summary-heading")} className="text-h4">
            {formError ? "The message was not sent" : "Check the form"}
          </h2>
          {formError ? <p className="mt-2 max-w-[62ch]">{formError}</p> : null}
          {errorList.length > 0 ? (
            <ul className="mt-2 list-disc pl-5">
              {errorList.map((f) => (
                <li key={f}>
                  <a href={`#${id(f)}`} className="underline underline-offset-[3px]">
                    {fieldNames[f]}: {errors[f]}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <Field id={id("name")} label="Name" error={errors.name}>
        {(a11y) => <input {...a11y} name="name" type="text" autoComplete="name" required defaultValue={values?.name ?? ""} className={inputClass} />}
      </Field>

      <Field id={id("organisation")} label="Organisation" optional helper="The hotel, hospital, school or company you are buying for." error={errors.organisation}>
        {(a11y) => (
          <input {...a11y} name="organisation" type="text" autoComplete="organization" defaultValue={values?.organisation ?? ""} className={inputClass} />
        )}
      </Field>

      <Field id={id("email")} label="Email" helper="We reply here." error={errors.email}>
        {(a11y) => (
          <input {...a11y} name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={values?.email ?? ""} className={inputClass} />
        )}
      </Field>

      <Field id={id("phone")} label="Phone" optional helper="07xx xxx xxx or 01xx xxx xxx" error={errors.phone}>
        {(a11y) => <input {...a11y} name="phone" type="tel" autoComplete="tel" inputMode="tel" defaultValue={values?.phone ?? ""} className={inputClass} />}
      </Field>

      <Field id={id("topic")} label="What is this about?" error={errors.topic}>
        {(a11y) => (
          <select
            {...a11y}
            name="topic"
            value={topic}
            onChange={(e) => setTopic(isLeadTopic(e.target.value) ? e.target.value : "contact")}
            className={inputClass}
          >
            {LEAD_TOPICS.map((t) => (
              <option key={t} value={t}>
                {topicLabels[t]}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field
        id={id("message")}
        label="Message"
        helper="Products, pack sizes, quantities, the site to deliver to, or the problem you are trying to solve."
        error={errors.message}
      >
        {(a11y) => <textarea {...a11y} name="message" required minLength={10} defaultValue={values?.message ?? initialMessage} className={textareaClass} />}
      </Field>

      <div className="flex items-start gap-3">
        <input
          id={id("consent")}
          name="consent"
          type="checkbox"
          defaultChecked={values?.consent ?? false}
          className="mt-1 size-5 shrink-0 rounded-chip border-stainless accent-accent"
        />
        <label htmlFor={id("consent")} className="text-small">
          Email me occasional product and dilution guidance. You can unsubscribe at any time.
        </label>
      </div>

      <input type="hidden" name="category" value={category ?? ""} />

      {/* Honeypot: never shown to people. A value here means an automated submission. */}
      <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor={id("website")}>Leave this field empty</label>
        <input id={id("website")} name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <div>
        <Button type="submit" busy={pending} busyLabel="Sending…" className="w-full sm:w-auto">
          {submitLabels[topic]}
        </Button>
        <p className="mt-3 text-small text-ink-muted">
          By sending this you agree to our{" "}
          <Link href="/privacy" className="text-accent underline underline-offset-[3px]">
            privacy notice
          </Link>
          .
        </p>
      </div>
    </form>
  );
}
