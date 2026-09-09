import { describe, expect, it } from "vitest";
import { MockAdapter, createRegistry, paymentsMode } from "../src";

describe("registry and mock mode", () => {
  it("builds live adapters by default and reports which are configured", () => {
    const r = createRegistry({});
    expect(r.MPESA.isConfigured()).toBe(false);
    expect(r.CARD.isConfigured()).toBe(false);
    expect(r.INVOICE.isConfigured()).toBe(true);
    expect(r.COD.isConfigured()).toBe(true);
    expect(createRegistry({ PAYSTACK_SECRET_KEY: "sk" }).CARD.isConfigured()).toBe(true);
  });

  it("refuses mock mode in production", () => {
    expect(() => paymentsMode({ PAYMENTS_MODE: "mock", VERCEL_ENV: "production" })).toThrow(/not allowed/);
    expect(paymentsMode({ PAYMENTS_MODE: "mock", VERCEL_ENV: "preview" })).toBe("mock");
  });

  it("mock adapters sign callbacks so tamper tests still mean something", async () => {
    const r = createRegistry({ PAYMENTS_MODE: "mock" });
    const init = await r.MPESA.initiate({ orderId: "o", orderNumber: "SFN-1", amountMinorUnits: 100n, currency: "KES", customer: { phone: "+254712345678" }, returnUrl: "https://x/r", callbackBaseUrl: "https://x", description: "d", attemptId: "a" });
    expect(init.kind).toBe("prompt");
    const body = JSON.stringify({ providerRequestId: init.providerRequestId, status: "SUCCEEDED", amountMinorUnits: "100" });
    expect(await r.MPESA.parseCallback({ body, headers: { "x-mock-signature": MockAdapter.sign(body) } })).toMatchObject({ ok: true, status: "SUCCEEDED" });
    expect(await r.MPESA.parseCallback({ body: body.replace("100", "1"), headers: { "x-mock-signature": MockAdapter.sign(body) } })).toMatchObject({ ok: false, reason: "BAD_SIGNATURE" });
    expect(await r.MPESA.queryStatus(init.providerRequestId)).toMatchObject({ status: "SUCCEEDED" });
  });
});
