/**
 * The product advisor: a customer describes a cleaning problem, we answer with products we actually
 * sell.
 *
 * The design is retrieval first, generation second, validation third — in that order, because the
 * failure that matters is not a clumsy answer, it is a confident recommendation for a product that
 * does not exist. A customer told to buy something we do not stock is a customer who calls, gets told
 * the site was wrong, and does not come back.
 *
 * So: the catalogue is searched first, the model is given **only** the products that came back, and
 * anything it names that was not in that set is dropped after the fact rather than shown. If nothing
 * valid survives, the advisor says so and writes a lead. That path is the one that earns trust, so it
 * is the first thing tested.
 */
import { db } from "@safuney/db";
import { searchProducts, type SearchProduct } from "@/lib/catalogue/search";
import { config, services } from "@/lib/env";

/** Sonnet: this is a retrieval-grounded classification, not a reasoning problem. */
const MODEL = "claude-sonnet-5";
const API = "https://api.anthropic.com/v1/messages";
const MAX_QUESTION = 600;
const CANDIDATES = 12;

export interface Recommendation {
  slug: string;
  name: string;
  href: string;
  packLabels: string[];
  /** Why this product, in the customer's terms. Always shown; never optional. */
  why: string;
  dilution: string | null;
  zoneLabel: string | null;
  hazardClass: string;
  sdsHref: string | null;
}

export type AdvisorResult =
  | { kind: "ok"; recommendations: Recommendation[]; note: string | null }
  | { kind: "none"; message: string }
  | { kind: "unavailable"; message: string };

export function advisorConfigured(): boolean {
  return Boolean(process.env["ANTHROPIC_API_KEY"]) && services.database();
}

/** What the model is allowed to see. Prices are deliberately absent: the server is the price authority
 * and a model must never be in a position to quote one. */
interface Candidate {
  slug: string;
  name: string;
  description: string;
  category: string;
  zone: string;
  hazard: string;
  packs: string;
  dilution: string;
}

function describe(p: SearchProduct, dilution: string): Candidate {
  return {
    slug: p.slug,
    name: p.name,
    description: p.shortDescription,
    category: p.category.name,
    zone: p.zone ?? "any",
    hazard: p.hazardClass,
    packs: p.variants.map((v) => v.packLabel).join(", "),
    dilution,
  };
}

const SYSTEM = `You advise buyers of professional cleaning and hygiene chemicals in Kenya.

You will be given a customer's problem and a list of candidate products. Rules, in order of importance:

1. Recommend ONLY from the candidate list. Never name, invent or imply any other product, brand or
   chemical we might sell. If the candidates do not solve the problem, say so — that is a correct and
   useful answer, not a failure.
2. Recommend at most three, fewest first. Two good products beat five hedged ones.
3. For each, say why it fits THIS customer's situation in one or two plain sentences: the surface, the
   soil, the setting. Do not restate the product description.
4. Never state a price, a discount or a delivery time. You do not have that information.
5. Never contradict the safety information given. If a product is corrosive or an oxidiser, and the
   customer's description suggests untrained staff or food-contact surfaces, say what care it needs.
6. Write in plain English a busy manager reads once. No marketing language.

Respond with JSON only, no prose around it:
{"recommendations":[{"slug":"...","why":"..."}],"note":"optional one-line caution or ordering advice, or null"}
If nothing in the list fits, respond {"recommendations":[],"note":"what they should ask us for instead"}.`;

interface ModelReply {
  recommendations: Array<{ slug: string; why: string }>;
  note: string | null;
}

async function ask(question: string, candidates: Candidate[]): Promise<ModelReply | null> {
  const response = await fetch(API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env["ANTHROPIC_API_KEY"]!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Customer's problem:\n${question}\n\nCandidate products (the only ones you may recommend):\n${JSON.stringify(candidates, null, 1)}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    console.error("advisor: model call failed", response.status, await response.text().catch(() => ""));
    return null;
  }
  const body = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = body.content?.find((c) => c.type === "text")?.text ?? "";
  // The model is asked for bare JSON, but a fenced block is the common drift; tolerate it rather than
  // failing the customer's request over punctuation.
  const json = /\{[\s\S]*\}/.exec(text)?.[0];
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as ModelReply;
    if (!Array.isArray(parsed.recommendations)) return null;
    return parsed;
  } catch {
    console.error("advisor: model returned unparseable JSON");
    return null;
  }
}

const ZONE_LABEL: Record<string, string> = {
  RED: "Washrooms",
  BLUE: "General areas",
  GREEN: "Kitchen and food prep",
  YELLOW: "Clinical and isolation",
};

export async function advise(question: string, contact?: { name?: string; email?: string; phone?: string }): Promise<AdvisorResult> {
  const asked = question.trim().slice(0, MAX_QUESTION);
  if (asked.length < 10) {
    return { kind: "unavailable", message: "Tell us a little more — what you are cleaning, what the soil is, and where." };
  }
  if (!advisorConfigured()) {
    return { kind: "unavailable", message: "The advisor is not switched on yet. Send us the same description and a person will answer." };
  }

  const found = await searchProducts(asked, { limit: CANDIDATES });
  if (found.length === 0) {
    await logLead(asked, contact, "no catalogue match");
    return { kind: "none", message: "Nothing in our catalogue matched that description. We have passed it to our team, who will come back to you with an answer." };
  }

  const guidance = await db().product.findMany({
    where: { slug: { in: found.map((p) => p.slug) } },
    select: { slug: true, dilutionText: true, dilutionGuidance: true, sdsDocument: { select: { fileUrl: true } } },
  });
  const byslug = new Map(guidance.map((g) => [g.slug, g]));
  const dilutionOf = (slug: string): string => {
    const g = byslug.get(slug);
    if (g?.dilutionText) return g.dilutionText;
    const rows = Array.isArray(g?.dilutionGuidance) ? (g.dilutionGuidance as Array<{ use?: string; ratio?: unknown }>) : [];
    return rows.map((r) => `${r.use ?? ""} 1:${String(r.ratio ?? "")}`.trim()).join("; ");
  };

  const reply = await ask(asked, found.map((p) => describe(p, dilutionOf(p.slug))));
  if (!reply) {
    return { kind: "unavailable", message: "We could not get an answer just now. Try again, or send us the description and a person will reply." };
  }

  // The validation that makes this safe: a slug the model returned that was not in what we retrieved
  // is dropped, not shown. The model cannot widen the catalogue.
  const retrieved = new Map(found.map((p) => [p.slug, p]));
  const recommendations: Recommendation[] = [];
  for (const r of reply.recommendations.slice(0, 3)) {
    const product = retrieved.get(r.slug);
    if (!product) {
      console.error("advisor: dropped a recommendation for a product that was not retrieved", r.slug);
      continue;
    }
    if (typeof r.why !== "string" || r.why.trim().length === 0) continue;
    recommendations.push({
      slug: product.slug,
      name: product.name,
      href: `/products/${product.categoryPath}/${product.slug}`,
      packLabels: product.variants.map((v) => v.packLabel),
      why: r.why.trim(),
      dilution: dilutionOf(product.slug) || null,
      zoneLabel: product.zone ? (ZONE_LABEL[product.zone] ?? null) : null,
      hazardClass: product.hazardClass,
      sdsHref: byslug.get(product.slug)?.sdsDocument?.fileUrl ?? null,
    });
  }

  if (recommendations.length === 0) {
    await logLead(asked, contact, reply.note ?? "advisor found no fit");
    return {
      kind: "none",
      message: reply.note?.trim() || "Nothing we stock is right for that. We have passed it to our team, who will come back to you.",
    };
  }
  return { kind: "ok", recommendations, note: typeof reply.note === "string" && reply.note.trim() ? reply.note.trim() : null };
}

/**
 * A question we could not answer is the most valuable thing the advisor produces: it is a customer
 * telling us what we do not sell, or do not describe well enough to be found.
 */
async function logLead(question: string, contact: { name?: string; email?: string; phone?: string } | undefined, reason: string): Promise<void> {
  try {
    await db().lead.create({
      data: {
        kind: "ADVISOR_NO_MATCH",
        name: contact?.name?.trim() || "Advisor enquiry",
        email: contact?.email?.trim() || null,
        phone: contact?.phone?.trim() || null,
        message: question,
        payload: { reason, siteUrl: config.siteUrl },
        source: "/advisor",
      },
    });
  } catch (e) {
    console.error("advisor: could not record the lead", e);
  }
}
