/**
 * The advisor's grounding.
 *
 * The failure that matters is not a clumsy answer — it is a confident recommendation for a product we
 * do not sell. These tests hold the model's output to the retrieved catalogue by faking the API call,
 * so a change to the prompt or the parsing cannot quietly widen what the advisor may recommend.
 */
import { randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestClient, type PrismaClient } from "@safuney/db";

const url = process.env["DATABASE_URL"];
const run = url ? describe : describe.skip;

/** What the faked model returns for the next call. */
let modelReply: unknown = null;
let modelStatus = 200;
let lastRequestBody: string | null = null;

const fetchMock = vi.fn(async (_input: unknown, init?: { body?: string }) => {
  lastRequestBody = init?.body ?? null;
  return {
    ok: modelStatus === 200,
    status: modelStatus,
    text: async () => "error",
    json: async () => ({ content: [{ type: "text", text: typeof modelReply === "string" ? modelReply : JSON.stringify(modelReply) }] }),
  };
});

run("product advisor", () => {
  let prisma: PrismaClient;
  const stamp = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  const realName = `Heavy-duty hood degreaser ${stamp}`;
  const realSlug = `adv-real-${stamp}`;

  beforeAll(async () => {
    process.env["ANTHROPIC_API_KEY"] = "test-key-not-a-real-one";
    vi.stubGlobal("fetch", fetchMock);
    prisma = createTestClient(url!);
    const cat = await prisma.category.create({ data: { slug: `adv-cat-${stamp}`, name: `Advisor test ${stamp}` } });
    const p = await prisma.product.create({
      data: {
        slug: realSlug,
        name: realName,
        shortDescription: "Alkaline degreaser for extraction canopies, fryers and workshop floors.",
        categoryId: cat.id,
        isActive: true,
        needsPoReview: false,
        zone: "GREEN",
        hazardClass: "CORROSIVE",
        dilutionText: "1:10 for heavy grease, 1:40 for daily wiping.",
      },
    });
    await prisma.productVariant.create({ data: { productId: p.id, sku: `ADV-${stamp}`, packSizeValue: "5", unit: "L", packLabel: "5 L", priceMinorUnits: 250000n, vatRateBps: 1600, stockOnHand: 10 } });
  });

  afterEach(() => {
    modelStatus = 200;
    fetchMock.mockClear();
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await prisma.lead.deleteMany({ where: { message: { contains: stamp } } });
    await prisma.product.deleteMany({ where: { slug: realSlug } });
    await prisma.category.deleteMany({ where: { slug: `adv-cat-${stamp}` } });
    await prisma.$disconnect();
  });

  it("asks for more when the description is too thin to search on", async () => {
    const { advise } = await import("@/lib/advisor/service");
    const r = await advise("grease");
    expect(r.kind).toBe("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("recommends a product it was given, with the reason and the dilution", async () => {
    const { advise } = await import("@/lib/advisor/service");
    modelReply = { recommendations: [{ slug: realSlug, why: "Alkaline degreasers are what lift baked-on grease from canopy filters." }], note: "Rinse before sanitising." };
    const r = await advise(`Greasy extractor hood degreaser ${stamp}, commercial kitchen, weekly`);
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.recommendations).toHaveLength(1);
    expect(r.recommendations[0]?.name).toBe(realName);
    expect(r.recommendations[0]?.why).toContain("canopy filters");
    expect(r.recommendations[0]?.dilution).toContain("1:10");
    expect(r.recommendations[0]?.hazardClass).toBe("CORROSIVE");
    expect(r.note).toBe("Rinse before sanitising.");
  });

  it("never sends a price to the model", async () => {
    const { advise } = await import("@/lib/advisor/service");
    modelReply = { recommendations: [{ slug: realSlug, why: "Fits." }], note: null };
    await advise(`Greasy extractor hood degreaser ${stamp}, commercial kitchen`);
    expect(lastRequestBody).toBeTruthy();
    // The server is the price authority; a model must never be in a position to quote one.
    expect(lastRequestBody).not.toContain("250000");
    expect(lastRequestBody).not.toContain("priceMinorUnits");
  });

  it("drops a product the model invented, and records the miss as a lead", async () => {
    const { advise } = await import("@/lib/advisor/service");
    // The whole reason this design exists: a confident recommendation for something we do not sell.
    modelReply = { recommendations: [{ slug: "safuney-miracle-foam-9000", why: "Our best-selling product for this." }], note: null };
    const r = await advise(`Greasy extractor hood degreaser ${stamp}, commercial kitchen`);
    expect(r.kind).toBe("none");
    const lead = await prisma.lead.findFirst({ where: { message: { contains: stamp }, kind: "ADVISOR_NO_MATCH" } });
    expect(lead).not.toBeNull();
  });

  it("keeps the real product and drops the invented one when the model returns both", async () => {
    const { advise } = await import("@/lib/advisor/service");
    modelReply = {
      recommendations: [
        { slug: "not-a-product-we-sell", why: "Invented." },
        { slug: realSlug, why: "Real." },
      ],
      note: null,
    };
    const r = await advise(`Greasy extractor hood degreaser ${stamp}, commercial kitchen`);
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.recommendations.map((x) => x.slug)).toEqual([realSlug]);
  });

  it("recommends at most three however many the model returns", async () => {
    const { advise } = await import("@/lib/advisor/service");
    modelReply = { recommendations: Array.from({ length: 6 }, () => ({ slug: realSlug, why: "Fits." })), note: null };
    const r = await advise(`Greasy extractor hood degreaser ${stamp}, commercial kitchen`);
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.recommendations.length).toBeLessThanOrEqual(3);
  });

  it("tolerates a fenced JSON block, which is the common drift", async () => {
    const { advise } = await import("@/lib/advisor/service");
    modelReply = "Here you go:\n```json\n" + JSON.stringify({ recommendations: [{ slug: realSlug, why: "Fits the job." }], note: null }) + "\n```";
    const r = await advise(`Greasy extractor hood degreaser ${stamp}, commercial kitchen`);
    expect(r.kind).toBe("ok");
  });

  it("says so plainly when the model call fails, rather than pretending", async () => {
    const { advise } = await import("@/lib/advisor/service");
    modelStatus = 500;
    const r = await advise(`Greasy extractor hood degreaser ${stamp}, commercial kitchen`);
    expect(r.kind).toBe("unavailable");
    if (r.kind !== "unavailable") return;
    expect(r.message).toContain("a person will reply");
  });

  it("records a lead when nothing in the catalogue matches at all", async () => {
    const { advise } = await import("@/lib/advisor/service");
    const question = `Rocket fuel for a spacecraft ${stamp}zzz nothing like this exists`;
    const r = await advise(question, { email: "buyer@example.test" });
    expect(r.kind).toBe("none");
    expect(fetchMock).not.toHaveBeenCalled();
    const lead = await prisma.lead.findFirst({ where: { message: question } });
    expect(lead?.email).toBe("buyer@example.test");
    expect(lead?.kind).toBe("ADVISOR_NO_MATCH");
  });
});
