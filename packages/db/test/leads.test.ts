/**
 * Integration test for the Lead write path used by the website contact form.
 * Mirrors the persistence shape in apps/web/lib/leads.ts without importing it (package boundary).
 * Skipped when DATABASE_URL is not set. CI provides a Postgres service.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestClient } from "../src/index";
import type { LeadKind, PrismaClient } from "../src/index";

const url = process.env["DATABASE_URL"];
const run = url ? describe : describe.skip;

interface LeadRecord {
  kind: LeadKind;
  name: string;
  email: string;
  phone: string | null;
  organisation: string | null;
  message: string;
  payload: { topic: string; category: string | null; marketingConsent: boolean };
  source: string | null;
  consentAt: Date | null;
}

/** Same call shape as the website's default persistence function. */
async function persistLead(prisma: PrismaClient, lead: LeadRecord): Promise<string> {
  const row = await prisma.lead.create({
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
  return row.id;
}

run("lead persistence", () => {
  let prisma: PrismaClient;
  const stamp = Date.now().toString(36);
  const testEmail = `lead-test-${stamp}@example.com`;

  beforeAll(() => {
    prisma = createTestClient(url!);
  });

  afterAll(async () => {
    await prisma.lead.deleteMany({ where: { email: { startsWith: "lead-test-" } } });
    await prisma.$disconnect();
  });

  it("creates a quote request and reads it back with its payload", async () => {
    const consentAt = new Date("2026-09-09T10:00:00Z");
    const id = await persistLead(prisma, {
      kind: "QUOTE_REQUEST",
      name: "Test buyer",
      email: testEmail,
      phone: "+254712345678",
      organisation: "Test hotel",
      message: "Please quote 4 x 20 L QAC sanitiser delivered to Mombasa Road.",
      payload: { topic: "quote", category: "foodservice", marketingConsent: true },
      source: "/contact?topic=quote",
      consentAt,
    });

    const lead = await prisma.lead.findUniqueOrThrow({ where: { id } });
    expect(lead.kind).toBe("QUOTE_REQUEST");
    expect(lead.name).toBe("Test buyer");
    expect(lead.email).toBe(testEmail);
    expect(lead.phone).toBe("+254712345678");
    expect(lead.organisation).toBe("Test hotel");
    expect(lead.payload).toEqual({ topic: "quote", category: "foodservice", marketingConsent: true });
    expect(lead.source).toBe("/contact?topic=quote");
    expect(lead.consentAt?.toISOString()).toBe(consentAt.toISOString());
    expect(lead.handledAt).toBeNull();
    expect(lead.assignedToId).toBeNull();
  });

  it("stores a contact lead without optional fields", async () => {
    const id = await persistLead(prisma, {
      kind: "CONTACT",
      name: "Test caller",
      email: testEmail,
      phone: null,
      organisation: null,
      message: "Which product do you recommend for a stainless steel prep bench?",
      payload: { topic: "contact", category: null, marketingConsent: false },
      source: "/contact",
      consentAt: null,
    });
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id } });
    expect(lead.phone).toBeNull();
    expect(lead.organisation).toBeNull();
    expect(lead.consentAt).toBeNull();
    expect(lead.payload).toEqual({ topic: "contact", category: null, marketingConsent: false });
  });

  it("is listed among unhandled leads of its kind", async () => {
    const rows = await prisma.lead.findMany({ where: { kind: "QUOTE_REQUEST", handledAt: null, email: testEmail } });
    expect(rows.length).toBe(1);
  });
});
