/**
 * PAYMENTS_MODE=mock — previews and end-to-end tests without provider credentials or a network.
 * Behaves like the real adapters at the API boundary; a test-only endpoint feeds callbacks in.
 * Never enabled in production (the registry refuses).
 */
import { createHmac } from "node:crypto";
import type { InitiateInput, InitiateResult, ParsedCallback, PaymentAdapter, PaymentMethod, RawCallback, StatusResult } from "../types";

export const MOCK_SECRET = "mock-secret";

export class MockAdapter implements PaymentAdapter {
  readonly provider: PaymentAdapter["provider"];
  private statuses = new Map<string, StatusResult>();

  constructor(
    readonly method: PaymentMethod,
    private readonly kind: "prompt" | "redirect" | "offline",
  ) {
    this.provider = method === "MPESA" ? "MPESA_DARAJA" : method === "CARD" ? "PAYSTACK" : method === "INVOICE" ? "INVOICE" : "COD";
  }

  isConfigured(): boolean {
    return true;
  }

  async initiate(input: InitiateInput): Promise<InitiateResult> {
    const id = `mock-${this.method}-${input.orderNumber}-${input.attemptId}`.toLowerCase();
    this.statuses.set(id, { status: "PENDING" });
    if (this.kind === "prompt") return { kind: "prompt", providerRequestId: id, message: "Mock M-Pesa prompt sent. Use the test controls to confirm or cancel it.", expiresInSeconds: 120 };
    if (this.kind === "redirect") return { kind: "redirect", providerRequestId: id, url: `${input.returnUrl}${input.returnUrl.includes("?") ? "&" : "?"}mock=1&reference=${encodeURIComponent(id)}` };
    return { kind: "offline", providerRequestId: id, instructions: this.method === "INVOICE" ? "Mock invoice issued." : "Mock cash on delivery." };
  }

  /** Signed like Paystack (HMAC over the body) so tamper tests are meaningful in mock mode too. */
  async parseCallback(raw: RawCallback): Promise<ParsedCallback> {
    const sig = createHmac("sha512", MOCK_SECRET).update(raw.body).digest("hex");
    if (raw.headers["x-mock-signature"] !== sig) return { ok: false, reason: "BAD_SIGNATURE" };
    let body: { providerRequestId?: string; status?: string; amountMinorUnits?: string; ref?: string };
    try {
      body = JSON.parse(raw.body);
    } catch {
      return { ok: false, reason: "MALFORMED" };
    }
    if (!body.providerRequestId || !body.status) return { ok: false, reason: "MALFORMED" };
    const status = (["SUCCEEDED", "FAILED", "CANCELLED"] as const).find((s) => s === body.status) ?? "FAILED";
    const ref = body.ref ?? `MOCK${Date.now().toString(36).toUpperCase()}`;
    this.statuses.set(body.providerRequestId, { status, providerRef: ref });
    return { ok: true, eventKey: `mock:${body.providerRequestId}:${ref}`, providerRequestId: body.providerRequestId, providerRef: ref, amountMinorUnits: body.amountMinorUnits ? BigInt(body.amountMinorUnits) : undefined, status, failureReason: status === "SUCCEEDED" ? undefined : `Mock ${status.toLowerCase()}`, raw: body };
  }

  async queryStatus(providerRequestId: string): Promise<StatusResult> {
    return this.statuses.get(providerRequestId) ?? { status: "PENDING" };
  }

  static sign(body: string): string {
    return createHmac("sha512", MOCK_SECRET).update(body).digest("hex");
  }
}
