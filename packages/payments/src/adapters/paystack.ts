/**
 * Paystack card payments (Kenya). Initialize → redirect to Paystack's page → webhook (HMAC-SHA512 of
 * the raw body with the secret key) → verify endpoint for belt and braces.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { fetchJson, defaultFetch } from "../http";
import { PaymentProviderError, type AdapterDeps, type InitiateInput, type InitiateResult, type ParsedCallback, type PaymentAdapter, type RawCallback, type StatusResult } from "../types";

export interface PaystackConfig {
  secretKey: string;
  publicKey?: string;
}

export function paystackConfigFromEnv(env: Record<string, string | undefined> = process.env): PaystackConfig | null {
  return env["PAYSTACK_SECRET_KEY"] ? { secretKey: env["PAYSTACK_SECRET_KEY"], publicKey: env["PAYSTACK_PUBLIC_KEY"] } : null;
}

export class PaystackAdapter implements PaymentAdapter {
  readonly method = "CARD" as const;
  readonly provider = "PAYSTACK" as const;
  private readonly fetch;
  private readonly timeoutMs;

  constructor(
    private readonly config: PaystackConfig | null,
    deps: AdapterDeps = {},
  ) {
    this.fetch = deps.fetch ?? defaultFetch();
    this.timeoutMs = deps.timeoutMs ?? 15_000;
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  private cfg(): PaystackConfig {
    if (!this.config) throw new PaymentProviderError("CONFIG", "Card payments are not configured");
    return this.config;
  }

  async initiate(input: InitiateInput): Promise<InitiateResult> {
    const c = this.cfg();
    if (!input.customer.email) throw new PaymentProviderError("REJECTED", "An email address is needed for card payment receipts.");
    // Reference must be unique per attempt; Paystack rejects reuse, which is our idempotency guard.
    const reference = `${input.orderNumber}-${input.attemptId}`.replace(/[^A-Za-z0-9\-_.=]/g, "").slice(0, 100);
    const res = await fetchJson(
      this.fetch,
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${c.secretKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: input.customer.email,
          amount: input.amountMinorUnits.toString(),
          currency: input.currency,
          reference,
          callback_url: input.returnUrl,
          metadata: { orderId: input.orderId, orderNumber: input.orderNumber, custom_fields: [{ display_name: "Order", variable_name: "order", value: input.orderNumber }] },
        }),
      },
      this.timeoutMs,
    );
    const j = res.json as { status?: boolean; message?: string; data?: { authorization_url?: string; reference?: string } } | null;
    if (!res.ok || !j?.status || !j.data?.authorization_url) throw new PaymentProviderError("REJECTED", j?.message ?? "Paystack did not accept the request", res.text);
    return { kind: "redirect", providerRequestId: j.data.reference ?? reference, url: j.data.authorization_url };
  }

  verifySignature(rawBody: string, signature: string | undefined): boolean {
    const c = this.config;
    if (!c || !signature) return false;
    const expected = createHmac("sha512", c.secretKey).update(rawBody).digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async parseCallback(raw: RawCallback): Promise<ParsedCallback> {
    if (!this.config) return { ok: false, reason: "MALFORMED", detail: "not configured" };
    if (!this.verifySignature(raw.body, raw.headers["x-paystack-signature"])) return { ok: false, reason: "BAD_SIGNATURE" };
    let body: { event?: string; data?: Record<string, unknown> };
    try {
      body = JSON.parse(raw.body);
    } catch {
      return { ok: false, reason: "MALFORMED" };
    }
    const d = body.data ?? {};
    const reference = typeof d["reference"] === "string" ? d["reference"] : null;
    const id = d["id"] !== undefined ? String(d["id"]) : null;
    if (!reference) return { ok: false, reason: "MALFORMED", detail: "no reference" };
    const amount = typeof d["amount"] === "number" ? BigInt(d["amount"]) : undefined;
    switch (body.event) {
      case "charge.success":
        return { ok: true, eventKey: `paystack:${body.event}:${reference}:${id ?? ""}`, providerRequestId: reference, providerRef: id ?? reference, amountMinorUnits: amount, status: d["status"] === "success" ? "SUCCEEDED" : "PENDING", raw: body };
      case "charge.failed":
      case "charge.dispute.create":
        return { ok: true, eventKey: `paystack:${body.event}:${reference}:${id ?? ""}`, providerRequestId: reference, providerRef: id ?? reference, amountMinorUnits: amount, status: "FAILED", failureReason: typeof d["gateway_response"] === "string" ? d["gateway_response"] : body.event, raw: body };
      default:
        return { ok: false, reason: "UNKNOWN_EVENT", detail: body.event };
    }
  }

  async queryStatus(providerRequestId: string): Promise<StatusResult> {
    const c = this.cfg();
    const res = await fetchJson(this.fetch, `https://api.paystack.co/transaction/verify/${encodeURIComponent(providerRequestId)}`, { method: "GET", headers: { Authorization: `Bearer ${c.secretKey}` } }, this.timeoutMs);
    const j = res.json as { status?: boolean; data?: { status?: string; id?: number; amount?: number; gateway_response?: string } } | null;
    if (!res.ok || !j?.status) throw new PaymentProviderError("NETWORK", "Paystack verify failed", res.text);
    const s = j.data?.status;
    const amount = typeof j.data?.amount === "number" ? BigInt(j.data.amount) : undefined;
    if (s === "success") return { status: "SUCCEEDED", providerRef: String(j.data?.id ?? providerRequestId), amountMinorUnits: amount, raw: j };
    if (s === "failed") return { status: "FAILED", failureReason: j.data?.gateway_response, raw: j };
    if (s === "abandoned") return { status: "CANCELLED", failureReason: "The card payment was not completed.", raw: j };
    return { status: "PENDING", raw: j };
  }
}
