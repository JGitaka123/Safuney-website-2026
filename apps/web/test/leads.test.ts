import { describe, expect, it, vi } from "vitest";
import {
  buildLeadEmails,
  leadInputFromFormData,
  messages,
  submitLead,
  toLeadRecord,
  topicToLeadKind,
  validateLead,
  type LeadDeps,
  type LeadRecord,
} from "@/lib/leads";
import type { RateLimiter } from "@/lib/rate-limit";

const valid = {
  name: "Wanjiru Kamau",
  organisation: "Riverside Hotel",
  email: "Wanjiru@Example.com",
  phone: "0712 345 678",
  topic: "quote",
  message: "We need 20 L of QAC sanitiser for the kitchen every month.",
  consent: "on",
  category: "foodservice",
  website: "",
};

const allow: RateLimiter = { limit: async () => ({ ok: true, retryAfterSeconds: 0 }) };
const deny: RateLimiter = { limit: async () => ({ ok: false, retryAfterSeconds: 300 }) };

function deps(overrides: Partial<LeadDeps> = {}): LeadDeps {
  return { persist: null, notify: null, limiter: allow, log: () => {}, ...overrides };
}

describe("validateLead", () => {
  it("accepts a valid payload and normalises the phone and email", () => {
    const result = validateLead(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.phone).toBe("+254712345678");
    expect(result.data.email).toBe("wanjiru@example.com");
    expect(result.data.topic).toBe("quote");
    expect(result.data.consent).toBe(true);
    expect(result.data.organisation).toBe("Riverside Hotel");
    expect(result.data.category).toBe("foodservice");
  });

  it("treats blank optional fields as absent", () => {
    const result = validateLead({ ...valid, organisation: "  ", phone: "", category: "", consent: undefined });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.organisation).toBeUndefined();
    expect(result.data.phone).toBeUndefined();
    expect(result.data.category).toBeUndefined();
    expect(result.data.consent).toBe(false);
  });

  it("rejects a missing name", () => {
    const result = validateLead({ ...valid, name: "   " });
    expect(result).toMatchObject({ ok: false, fieldErrors: { name: messages.name } });
  });

  it("rejects a bad email and a missing email with different messages", () => {
    expect(validateLead({ ...valid, email: "not-an-email" })).toMatchObject({ ok: false, fieldErrors: { email: messages.emailInvalid } });
    expect(validateLead({ ...valid, email: "" })).toMatchObject({ ok: false, fieldErrors: { email: messages.emailMissing } });
  });

  it("rejects a phone number that is not a Kenyan mobile", () => {
    expect(validateLead({ ...valid, phone: "+44 20 7946 0000" })).toMatchObject({ ok: false, fieldErrors: { phone: messages.phoneInvalid } });
    expect(validateLead({ ...valid, phone: "0812345678" })).toMatchObject({ ok: false, fieldErrors: { phone: messages.phoneInvalid } });
  });

  it("accepts every valid Kenyan mobile format", () => {
    for (const phone of ["0712345678", "0112345678", "+254712345678", "254712345678", "712 345 678"]) {
      const result = validateLead({ ...valid, phone });
      expect(result.ok, phone).toBe(true);
      if (result.ok) expect(result.data.phone).toMatch(/^\+254[17]\d{8}$/);
    }
  });

  it("rejects a short message", () => {
    expect(validateLead({ ...valid, message: "hi" })).toMatchObject({ ok: false, fieldErrors: { message: messages.messageShort } });
  });

  it("rejects an unknown topic", () => {
    expect(validateLead({ ...valid, topic: "spam" })).toMatchObject({ ok: false, fieldErrors: { topic: messages.topic } });
  });

  it("rejects a filled honeypot without field-level detail", () => {
    const result = validateLead({ ...valid, website: "https://example.com" });
    expect(result).toEqual({ ok: false, formError: messages.blocked });
  });

  it("reports every failing field at once", () => {
    const result = validateLead({ name: "", email: "x", phone: "1", topic: "", message: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors ?? {}).sort()).toEqual(["email", "message", "name", "phone", "topic"]);
  });

  it("reads the same fields out of FormData", () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(valid)) fd.set(k, v);
    const result = validateLead(leadInputFromFormData(fd));
    expect(result.ok).toBe(true);
  });
});

describe("topicToLeadKind", () => {
  it("maps each topic to a LeadKind", () => {
    expect(topicToLeadKind("contact")).toBe("CONTACT");
    expect(topicToLeadKind("quote")).toBe("QUOTE_REQUEST");
    expect(topicToLeadKind("credit")).toBe("CALLBACK");
    expect(topicToLeadKind("services")).toBe("CALLBACK");
  });

  it("builds a record with payload, source and consent timestamp", () => {
    const parsed = validateLead(valid);
    if (!parsed.ok) throw new Error("expected valid");
    const now = new Date("2026-09-09T10:00:00Z");
    const record = toLeadRecord(parsed.data, "/contact?topic=quote", () => now);
    expect(record).toMatchObject({
      kind: "QUOTE_REQUEST",
      name: "Wanjiru Kamau",
      email: "wanjiru@example.com",
      phone: "+254712345678",
      organisation: "Riverside Hotel",
      payload: { topic: "quote", category: "foodservice", marketingConsent: true },
      source: "/contact?topic=quote",
      consentAt: now,
    });
    const noConsent = toLeadRecord({ ...parsed.data, consent: false }, null, () => now);
    expect(noConsent.consentAt).toBeNull();
    expect(noConsent.source).toBeNull();
  });
});

describe("buildLeadEmails", () => {
  it("addresses the inbox email with the topic and name and includes every field", () => {
    const parsed = validateLead(valid);
    if (!parsed.ok) throw new Error("expected valid");
    const record = toLeadRecord(parsed.data, "/contact");
    const { inbox, acknowledgement } = buildLeadEmails(record);
    expect(inbox.subject).toBe("[safuney.com] Request a quote from Wanjiru Kamau");
    expect(inbox.replyTo).toBe("wanjiru@example.com");
    for (const needle of ["Wanjiru Kamau", "Riverside Hotel", "wanjiru@example.com", "+254712345678", "foodservice", "QAC sanitiser"]) {
      expect(inbox.text).toContain(needle);
    }
    expect(acknowledgement.to).toBe("wanjiru@example.com");
    expect(acknowledgement.text).toContain("within one working day");
  });
});

describe("submitLead", () => {
  const ctx = { ip: "203.0.113.5", source: "/contact?topic=quote" };

  it("persists and notifies with injected dependencies", async () => {
    const persist = vi.fn(async (_lead: LeadRecord) => {});
    const notify = vi.fn(async (_lead: LeadRecord) => {});
    const log = vi.fn();
    const result = await submitLead(valid, ctx, deps({ persist, notify, log }));
    expect(result).toEqual({ ok: true });
    expect(persist).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(1);
    const stored = persist.mock.calls[0]![0];
    expect(stored.kind).toBe("QUOTE_REQUEST");
    expect(stored.phone).toBe("+254712345678");
    expect(stored.source).toBe("/contact?topic=quote");
    expect(log).toHaveBeenCalledWith("lead.accepted.quote_request");
    // Outcome codes only: no personal data reaches the logger.
    for (const call of log.mock.calls) expect(JSON.stringify(call)).not.toMatch(/wanjiru|riverside|0712/i);
  });

  it("returns field errors without touching persistence", async () => {
    const persist = vi.fn(async () => {});
    const result = await submitLead({ ...valid, email: "bad" }, ctx, deps({ persist }));
    expect(result).toMatchObject({ ok: false, fieldErrors: { email: messages.emailInvalid } });
    expect(persist).not.toHaveBeenCalled();
  });

  it("fails honestly when neither database nor email is configured", async () => {
    const log = vi.fn();
    const result = await submitLead(valid, ctx, deps({ log }));
    expect(result).toEqual({ ok: false, formError: messages.unavailable });
    expect(messages.unavailable).toContain("+254 796 808 822");
    expect(messages.unavailable).toContain("info@safuney.com");
    expect(log).toHaveBeenCalledWith("lead.unavailable");
  });

  it("blocks when the rate limiter says no", async () => {
    const persist = vi.fn(async () => {});
    const result = await submitLead(valid, ctx, deps({ persist, limiter: deny }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.formError).toContain("5 minutes");
    expect(persist).not.toHaveBeenCalled();
  });

  it("still succeeds when the email fails but the lead was stored", async () => {
    const log = vi.fn();
    const result = await submitLead(
      valid,
      ctx,
      deps({ persist: async () => {}, notify: async () => { throw new Error("smtp down"); }, log }),
    );
    expect(result).toEqual({ ok: true });
    expect(log).toHaveBeenCalledWith("lead.notify.failed");
  });

  it("fails when both persistence and email fail", async () => {
    const result = await submitLead(
      valid,
      ctx,
      deps({ persist: async () => { throw new Error("db down"); }, notify: async () => { throw new Error("smtp down"); } }),
    );
    expect(result).toEqual({ ok: false, formError: messages.unavailable });
  });
});
