import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PaystackAdapter, type Fetch } from "../src";

const cfg = { secretKey: "sk_test_abc" };
const input = { orderId: "o1", orderNumber: "SFN-20260909-0002", amountMinorUnits: 250000n, currency: "KES" as const, customer: { email: "buyer@example.test" }, returnUrl: "https://x/checkout/return", callbackBaseUrl: "https://x", description: "Safuney order", attemptId: "a7" };

describe("Paystack adapter", () => {
  it("initialises a transaction in minor units with a unique reference and returns the redirect", async () => {
    let sent: { url: string; body?: string; headers?: Record<string, string> } | null = null;
    const fetch: Fetch = async (url, init) => {
      sent = { url, body: init?.body, headers: init?.headers };
      return { ok: true, status: 200, text: async () => JSON.stringify({ status: true, data: { authorization_url: "https://checkout.paystack.com/abc", reference: "SFN-20260909-0002-a7" } }) };
    };
    const a = new PaystackAdapter(cfg, { fetch });
    const r = await a.initiate(input);
    expect(r).toMatchObject({ kind: "redirect", url: "https://checkout.paystack.com/abc", providerRequestId: "SFN-20260909-0002-a7" });
    const body = JSON.parse(sent!.body!);
    expect(body.amount).toBe("250000");
    expect(body.currency).toBe("KES");
    expect(body.reference).toBe("SFN-20260909-0002-a7");
    expect(sent!.headers!["Authorization"]).toBe("Bearer sk_test_abc");
  });

  it("requires an email and reports provider rejection", async () => {
    const a = new PaystackAdapter(cfg, { fetch: async () => ({ ok: false, status: 400, text: async () => JSON.stringify({ status: false, message: "Invalid key" }) }) });
    await expect(a.initiate({ ...input, customer: {} })).rejects.toMatchObject({ code: "REJECTED" });
    await expect(a.initiate(input)).rejects.toMatchObject({ code: "REJECTED", message: "Invalid key" });
  });

  const event = JSON.stringify({ event: "charge.success", data: { id: 12345, reference: "SFN-20260909-0002-a7", amount: 250000, status: "success", currency: "KES" } });
  const sign = (body: string, key = cfg.secretKey) => createHmac("sha512", key).update(body).digest("hex");

  it("accepts a correctly signed webhook and rejects tampered or unsigned ones", async () => {
    const a = new PaystackAdapter(cfg);
    const ok = await a.parseCallback({ body: event, headers: { "x-paystack-signature": sign(event) } });
    expect(ok).toMatchObject({ ok: true, status: "SUCCEEDED", providerRequestId: "SFN-20260909-0002-a7", providerRef: "12345", amountMinorUnits: 250000n, eventKey: "paystack:charge.success:SFN-20260909-0002-a7:12345" });
    // Tampered amount with the original signature.
    const tampered = event.replace("250000", "1");
    expect(await a.parseCallback({ body: tampered, headers: { "x-paystack-signature": sign(event) } })).toMatchObject({ ok: false, reason: "BAD_SIGNATURE" });
    // Signed with the wrong key.
    expect(await a.parseCallback({ body: event, headers: { "x-paystack-signature": sign(event, "sk_test_other") } })).toMatchObject({ ok: false, reason: "BAD_SIGNATURE" });
    expect(await a.parseCallback({ body: event, headers: {} })).toMatchObject({ ok: false, reason: "BAD_SIGNATURE" });
  });

  it("classifies failures and ignores unknown events", async () => {
    const a = new PaystackAdapter(cfg);
    const failed = JSON.stringify({ event: "charge.failed", data: { id: 1, reference: "r1", amount: 10, gateway_response: "Declined" } });
    expect(await a.parseCallback({ body: failed, headers: { "x-paystack-signature": sign(failed) } })).toMatchObject({ ok: true, status: "FAILED", failureReason: "Declined" });
    const other = JSON.stringify({ event: "customeridentification.success", data: { reference: "r2" } });
    expect(await a.parseCallback({ body: other, headers: { "x-paystack-signature": sign(other) } })).toMatchObject({ ok: false, reason: "UNKNOWN_EVENT" });
  });

  it("verifies a transaction by reference", async () => {
    const a = new PaystackAdapter(cfg, { fetch: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ status: true, data: { status: "abandoned" } }) }) });
    expect(await a.queryStatus("r1")).toMatchObject({ status: "CANCELLED" });
  });
});
