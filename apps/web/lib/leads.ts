/**
 * Contact-form leads: validation, persistence and notification.
 *
 * Persistence and email are injectable so the logic is unit-testable without a database or an API key.
 * The defaults switch themselves off when the service is not configured (lib/env.ts). Logging is
 * outcome codes only — never names, emails, phones or message text.
 */
import { z } from "zod";
import { normaliseKenyanMobile } from "@safuney/config";
import type { LeadKind } from "@safuney/db";
import { site } from "@/config/site";
import { LEAD_TOPICS, topicLabels, topicToLeadKind, type FieldErrors, type LeadField, type LeadTopic } from "@/app/contact/topics";
import { config, services } from "./env";
import { sendEmail, type EmailMessage } from "./email";
import { getLeadRateLimiter, type RateLimiter } from "./rate-limit";

export {
  LEAD_TOPICS,
  isLeadTopic,
  submitLabels,
  topicLabels,
  topicToLeadKind,
  type FieldErrors,
  type LeadField,
  type LeadTopic,
} from "@/app/contact/topics";

export const messages = {
  name: "Enter your name so we know who to reply to.",
  emailMissing: "Enter the email address we should reply to.",
  emailInvalid: "That does not look like an email address. Check it and try again.",
  phoneInvalid: "That does not look like a Kenyan mobile number. Use 07xx xxx xxx or 01xx xxx xxx.",
  topic: "Choose what your message is about.",
  messageShort: "Tell us a little more, at least ten characters, so we can help.",
  tooLong: "That is too long. Shorten it, or attach the detail to a follow-up email.",
  blocked: "The form could not be sent. Reload the page and try again.",
  unavailable: `We could not send this right now. Call ${site.contact.phone.display} or email ${site.contact.email.address}.`,
  rateLimited: (minutes: number) =>
    `You have sent several messages in a short time. Wait ${minutes} minute${minutes === 1 ? "" : "s"} and try again, or call ${site.contact.phone.display}.`,
} as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, messages.tooLong)
    .transform((v) => (v.length === 0 ? undefined : v));

const leadSchema = z.object({
  name: z.string().trim().min(1, messages.name).max(120, messages.tooLong),
  organisation: optionalText(160),
  email: z.string().trim().toLowerCase().min(1, messages.emailMissing).max(254, messages.tooLong).pipe(z.email(messages.emailInvalid)),
  phone: z
    .string()
    .trim()
    .max(40, messages.phoneInvalid)
    .transform((v, ctx) => {
      if (v.length === 0) return undefined;
      const normalised = normaliseKenyanMobile(v);
      if (!normalised) {
        ctx.addIssue({ code: "custom", message: messages.phoneInvalid });
        return z.NEVER;
      }
      return normalised;
    }),
  topic: z.enum(LEAD_TOPICS, messages.topic),
  message: z.string().trim().min(10, messages.messageShort).max(5000, messages.tooLong),
  consent: z.boolean(),
  category: optionalText(80),
});

export type LeadData = z.infer<typeof leadSchema>;

/** Raw form values as they arrive from FormData or JSON. Anything that is not a string is treated as empty. */
export type LeadInput = Record<string, unknown>;

export type LeadValidation = { ok: true; data: LeadData } | { ok: false; fieldErrors?: FieldErrors; formError?: string };

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function bool(value: unknown): boolean {
  return value === true || value === "on" || value === "true";
}

/** Convert FormData to a plain object for validateLead. */
export function leadInputFromFormData(formData: FormData): LeadInput {
  const out: LeadInput = {};
  for (const key of ["name", "organisation", "email", "phone", "topic", "message", "consent", "category", "website"]) {
    const v = formData.get(key);
    if (v !== null) out[key] = v;
  }
  return out;
}

/**
 * Validate a submission. The honeypot field `website` must be empty: browsers never show it, so a
 * value means an automated submission, which is rejected without field-level detail.
 */
export function validateLead(input: LeadInput): LeadValidation {
  if (str(input["website"]).length > 0) return { ok: false, formError: messages.blocked };
  const parsed = leadSchema.safeParse({
    name: str(input["name"]),
    organisation: str(input["organisation"]),
    email: str(input["email"]),
    phone: str(input["phone"]),
    topic: str(input["topic"]),
    message: str(input["message"]),
    consent: bool(input["consent"]),
    category: str(input["category"]),
  });
  if (parsed.success) return { ok: true, data: parsed.data };
  const fieldErrors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in fieldErrors)) fieldErrors[field as LeadField] = issue.message;
  }
  return { ok: false, fieldErrors };
}

export interface LeadRecord {
  kind: LeadKind;
  name: string;
  email: string;
  phone: string | null;
  organisation: string | null;
  message: string;
  payload: { topic: LeadTopic; category: string | null; marketingConsent: boolean };
  source: string | null;
  consentAt: Date | null;
}

export function toLeadRecord(data: LeadData, source: string | null, now: () => Date = () => new Date()): LeadRecord {
  return {
    kind: topicToLeadKind(data.topic),
    name: data.name,
    email: data.email,
    phone: data.phone ?? null,
    organisation: data.organisation ?? null,
    message: data.message,
    payload: { topic: data.topic, category: data.category ?? null, marketingConsent: data.consent },
    source,
    consentAt: data.consent ? now() : null,
  };
}

/** Build the two emails for a lead: one to the leads inbox, one acknowledgement to the sender. */
export function buildLeadEmails(lead: LeadRecord): { inbox: EmailMessage; acknowledgement: EmailMessage } {
  const topic = topicLabels[lead.payload.topic];
  const lines = [
    `Topic: ${topic}`,
    `Name: ${lead.name}`,
    `Organisation: ${lead.organisation ?? "not given"}`,
    `Email: ${lead.email}`,
    `Phone: ${lead.phone ?? "not given"}`,
    `Category: ${lead.payload.category ?? "not given"}`,
    `Marketing consent: ${lead.payload.marketingConsent ? "yes" : "no"}`,
    `Source: ${lead.source ?? "not given"}`,
    "",
    "Message:",
    lead.message,
  ];
  const inbox: EmailMessage = {
    to: config.leadsInbox,
    subject: `[safuney.com] ${topic} from ${lead.name}`,
    text: lines.join("\n"),
    replyTo: lead.email,
  };
  const acknowledgement: EmailMessage = {
    to: lead.email,
    subject: `We received your message, ${lead.name}`,
    text: [
      `Thanks, ${lead.name}.`,
      "",
      `We have your ${topic.toLowerCase()} and will reply to ${lead.email} within one working day.`,
      `If it is urgent, call ${site.contact.phone.display} or email ${site.contact.email.address}.`,
      "",
      "What you sent:",
      lead.message,
      "",
      site.legalName,
      ...site.contact.address.lines,
    ].join("\n"),
    replyTo: site.contact.email.address,
  };
  return { inbox, acknowledgement };
}

export interface LeadDeps {
  /** Store the lead. null when no database is configured. */
  persist: ((lead: LeadRecord) => Promise<void>) | null;
  /** Notify the leads inbox (and acknowledge the sender). null when email is not configured. */
  notify: ((lead: LeadRecord) => Promise<void>) | null;
  limiter: RateLimiter;
  /** Outcome logger. Receives short codes only, never personal data. */
  log: (code: string) => void;
}

async function persistToDatabase(lead: LeadRecord): Promise<void> {
  const { db } = await import("@safuney/db");
  await db().lead.create({
    data: {
      kind: lead.kind,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      organisation: lead.organisation,
      message: lead.message,
      payload: lead.payload,
      source: lead.source,
      consentAt: lead.consentAt,
    },
  });
}

async function notifyByEmail(lead: LeadRecord): Promise<void> {
  const { inbox, acknowledgement } = buildLeadEmails(lead);
  const result = await sendEmail(inbox);
  if (!result.sent) throw new Error(`inbox email not sent: ${result.reason}`);
  // The acknowledgement is a courtesy; its failure must not fail the submission.
  const ack = await sendEmail(acknowledgement);
  if (!ack.sent) console.warn("lead.acknowledgement.failed", { code: ack.reason });
}

export function defaultLeadDeps(): LeadDeps {
  return {
    persist: services.database() ? persistToDatabase : null,
    notify: services.email() ? notifyByEmail : null,
    limiter: getLeadRateLimiter(),
    log: (code) => console.info(code),
  };
}

export interface SubmitContext {
  /** Rate-limit key, normally the client IP. */
  ip: string;
  /** Page path the form was submitted from. */
  source?: string;
}

export type SubmitLeadResult = { ok: true } | { ok: false; fieldErrors?: FieldErrors; formError?: string };

/**
 * Validate, rate limit, store and notify. Succeeds when at least one of persist/notify succeeded, so a
 * lead is never silently lost while the site reports success. Fails honestly when neither is available.
 */
export async function submitLead(input: LeadInput, ctx: SubmitContext, overrides: Partial<LeadDeps> = {}): Promise<SubmitLeadResult> {
  const deps: LeadDeps = { ...defaultLeadDeps(), ...overrides };

  const validation = validateLead(input);
  if (!validation.ok) {
    deps.log(validation.formError ? "lead.rejected.honeypot" : "lead.rejected.validation");
    return validation;
  }

  const limit = await deps.limiter.limit(ctx.ip);
  if (!limit.ok) {
    deps.log("lead.rejected.rate_limited");
    return { ok: false, formError: messages.rateLimited(Math.max(1, Math.ceil(limit.retryAfterSeconds / 60))) };
  }

  if (!deps.persist && !deps.notify) {
    deps.log("lead.unavailable");
    return { ok: false, formError: messages.unavailable };
  }

  const lead = toLeadRecord(validation.data, ctx.source ?? null);
  const [persisted, notified] = await Promise.all([
    deps.persist ? deps.persist(lead).then(() => true, () => false) : Promise.resolve(null),
    deps.notify ? deps.notify(lead).then(() => true, () => false) : Promise.resolve(null),
  ]);
  if (persisted === false) deps.log("lead.persist.failed");
  if (notified === false) deps.log("lead.notify.failed");

  if (persisted !== true && notified !== true) {
    deps.log("lead.failed");
    return { ok: false, formError: messages.unavailable };
  }
  deps.log(`lead.accepted.${lead.kind.toLowerCase()}`);
  return { ok: true };
}
