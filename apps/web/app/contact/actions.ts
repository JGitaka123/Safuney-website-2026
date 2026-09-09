"use server";

import { headers } from "next/headers";
import { leadInputFromFormData, submitLead } from "@/lib/leads";
import type { FieldErrors, LeadTopic } from "./topics";

export interface ContactFormValues {
  name: string;
  organisation: string;
  email: string;
  phone: string;
  topic: string;
  message: string;
  consent: boolean;
}

/** State handed back to the form. `ok: null` is the untouched form. */
export type ContactFormState =
  | { ok: null }
  | { ok: true; name: string; email: string }
  | { ok: false; fieldErrors?: FieldErrors; formError?: string; values: ContactFormValues };

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v : "";
}

async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || h.get("x-real-ip") || "unknown";
}

export async function submitContactForm(_prev: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const values: ContactFormValues = {
    name: str(formData.get("name")),
    organisation: str(formData.get("organisation")),
    email: str(formData.get("email")),
    phone: str(formData.get("phone")),
    topic: str(formData.get("topic")),
    message: str(formData.get("message")),
    consent: formData.get("consent") === "on",
  };
  const topic = values.topic as LeadTopic;
  const source = topic && topic !== "contact" ? `/contact?topic=${topic}` : "/contact";

  const result = await submitLead(leadInputFromFormData(formData), { ip: await clientIp(), source });
  if (result.ok) return { ok: true, name: values.name.trim(), email: values.email.trim().toLowerCase() };
  return { ok: false, ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}), ...(result.formError ? { formError: result.formError } : {}), values };
}
