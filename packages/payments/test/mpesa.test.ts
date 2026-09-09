import { describe, expect, it } from "vitest";
import { MpesaDarajaAdapter, PaymentProviderError, normaliseForDaraja, type DarajaConfig, type Fetch } from "../src";

const cfg: DarajaConfig = { environment: "sandbox", consumerKey: "k", consumerSecret: "s", shortcode: "174379", passkey: "pk", callbackSecret: "cbsecret", enforceSourceIp: true };

function fakeFetch(routes: Record<string, (init?: { body?: string; headers?: Record<string, string> }) => { status: number; body: unknown } | Promise<never>>): { fetch: Fetch; calls: Array<{ url: string; body?: string }> } {
  const calls: Array<{ url: string; body?: string }> = [];
  const fetch: Fetch = async (url, init) => {
    calls.push({ url, body: init?.body });
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) return { ok: false, status: 404, text: async () => "not found" };
    const r = await routes[key]!(init);
    return { ok: r.status < 400, status: r.status, text: async () => JSON.stringify(r.body) };
  };
  return { fetch, calls };
}

const stkInput = { orderId: "o1", orderNumber: "SFN-20260909-0001", amountMinorUnits: 145050n, currency: "KES" as const, customer: { phone: "0712 345 678" }, returnUrl: "https://x/return", callbackBaseUrl: "https://x", description: "Safuney order", attemptId: "a1" };

describe("M-Pesa Daraja adapter", () => {
  it("normalises Kenyan numbers to 2547XXXXXXXX", () => {
    expect(normaliseForDaraja("0712 345 678")).toBe("254712345678");
    expect(normaliseForDaraja("+254112345678")).toBe("254112345678");
    expect(normaliseForDaraja("712345678")).toBe("254712345678");
    expect(normaliseForDaraja("0812345678")).toBeNull();
  });

  it("initiates an STK push with a whole-shilling amount rounded up and the secret callback path", async () => {
    const { fetch, calls } = fakeFetch({
      "/oauth/": () => ({ status: 200, body: { access_token: "tok", expires_in: "3599" } }),
      "/stkpush/": () => ({ status: 200, body: { ResponseCode: "0", CheckoutRequestID: "ws_CO_1", CustomerMessage: "Success. Request accepted for processing" } }),
    });
    const a = new MpesaDarajaAdapter(cfg, { fetch, now: () => new Date("2026-09-09T10:00:00Z") });
    const r = await a.initiate(stkInput);
    expect(r).toMatchObject({ kind: "prompt", providerRequestId: "ws_CO_1" });
    const body = JSON.parse(calls[1]!.body!);
    expect(body.Amount).toBe(1451); // 1450.50 rounds up
    expect(body.PhoneNumber).toBe("254712345678");
    expect(body.CallBackURL).toBe("https://x/api/payments/mpesa/callback/cbsecret");
    expect(body.Timestamp).toBe("20260909100000");
    expect(body.Password).toBe(Buffer.from("174379pk20260909100000").toString("base64"));
  });

  it("surfaces provider rejection and timeouts as typed errors, never as a hang", async () => {
    const rejected = new MpesaDarajaAdapter(cfg, { fetch: fakeFetch({ "/oauth/": () => ({ status: 200, body: { access_token: "t" } }), "/stkpush/": () => ({ status: 400, body: { errorMessage: "Bad Request - Invalid PhoneNumber" } }) }).fetch });
    await expect(rejected.initiate(stkInput)).rejects.toMatchObject({ code: "REJECTED" });
    const slow: Fetch = (_u, init) => new Promise((_res, rej) => init?.signal?.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))));
    const timeout = new MpesaDarajaAdapter(cfg, { fetch: slow, timeoutMs: 20 });
    await expect(timeout.initiate(stkInput)).rejects.toMatchObject({ code: "TIMEOUT" });
    const unconfigured = new MpesaDarajaAdapter(null);
    expect(unconfigured.isConfigured()).toBe(false);
    await expect(unconfigured.initiate(stkInput)).rejects.toBeInstanceOf(PaymentProviderError);
  });

  const successBody = JSON.stringify({
    Body: { stkCallback: { MerchantRequestID: "m1", CheckoutRequestID: "ws_CO_1", ResultCode: 0, ResultDesc: "The service request is processed successfully.", CallbackMetadata: { Item: [{ Name: "Amount", Value: 1451 }, { Name: "MpesaReceiptNumber", Value: "RKT1ABCDEF" }, { Name: "TransactionDate", Value: 20260909100230 }, { Name: "PhoneNumber", Value: 254712345678 }] } } },
  });

  it("accepts a genuine callback and produces a stable event key", async () => {
    const a = new MpesaDarajaAdapter(cfg);
    const r = await a.parseCallback({ body: successBody, headers: {}, ip: "196.201.214.200", params: { secret: "cbsecret" } });
    expect(r).toMatchObject({ ok: true, status: "SUCCEEDED", providerRequestId: "ws_CO_1", providerRef: "RKT1ABCDEF", amountMinorUnits: 145100n, payerRef: "254712345678", eventKey: "mpesa:ws_CO_1:0:RKT1ABCDEF" });
    const again = await a.parseCallback({ body: successBody, headers: {}, ip: "196.201.214.200", params: { secret: "cbsecret" } });
    expect(again.ok && again.eventKey).toBe("mpesa:ws_CO_1:0:RKT1ABCDEF"); // replay = same key, caller ignores it
  });

  it("rejects a forged callback: wrong secret, wrong source IP, or malformed body", async () => {
    const a = new MpesaDarajaAdapter(cfg);
    expect(await a.parseCallback({ body: successBody, headers: {}, ip: "196.201.214.200", params: { secret: "guess" } })).toMatchObject({ ok: false, reason: "BAD_SIGNATURE" });
    expect(await a.parseCallback({ body: successBody, headers: {}, ip: "1.2.3.4", params: { secret: "cbsecret" } })).toMatchObject({ ok: false, reason: "BAD_SOURCE" });
    expect(await a.parseCallback({ body: "{not json", headers: {}, ip: "196.201.214.200", params: { secret: "cbsecret" } })).toMatchObject({ ok: false, reason: "MALFORMED" });
    expect(await a.parseCallback({ body: JSON.stringify({ Body: {} }), headers: {}, ip: "196.201.214.200", params: { secret: "cbsecret" } })).toMatchObject({ ok: false, reason: "MALFORMED" });
  });

  it("maps a cancelled prompt and a failure distinctly", async () => {
    const a = new MpesaDarajaAdapter({ ...cfg, enforceSourceIp: false });
    const cancelled = await a.parseCallback({ body: JSON.stringify({ Body: { stkCallback: { CheckoutRequestID: "ws_CO_2", ResultCode: 1032, ResultDesc: "Request cancelled by user" } } }), headers: {}, params: { secret: "cbsecret" } });
    expect(cancelled).toMatchObject({ ok: true, status: "CANCELLED", failureReason: "Request cancelled by user" });
    const failed = await a.parseCallback({ body: JSON.stringify({ Body: { stkCallback: { CheckoutRequestID: "ws_CO_3", ResultCode: 1, ResultDesc: "The balance is insufficient for the transaction." } } }), headers: {}, params: { secret: "cbsecret" } });
    expect(failed).toMatchObject({ ok: true, status: "FAILED" });
  });

  it("queries status and treats 'being processed' as pending", async () => {
    const { fetch } = fakeFetch({
      "/oauth/": () => ({ status: 200, body: { access_token: "t" } }),
      "/stkpushquery/": () => ({ status: 500, body: { errorCode: "500.001.1001", errorMessage: "The transaction is being processed" } }),
    });
    const a = new MpesaDarajaAdapter(cfg, { fetch });
    expect(await a.queryStatus("ws_CO_1")).toMatchObject({ status: "PENDING" });
    const done = new MpesaDarajaAdapter(cfg, { fetch: fakeFetch({ "/oauth/": () => ({ status: 200, body: { access_token: "t" } }), "/stkpushquery/": () => ({ status: 200, body: { ResultCode: "0", ResultDesc: "ok" } }) }).fetch });
    expect(await done.queryStatus("ws_CO_1")).toMatchObject({ status: "SUCCEEDED" });
  });

  it("parses C2B confirmations with the same protections", () => {
    const a = new MpesaDarajaAdapter(cfg);
    const body = JSON.stringify({ TransactionType: "Pay Bill", TransID: "RKT2XYZ", TransAmount: "1451.00", BillRefNumber: "SFN-20260909-0001", MSISDN: "254712345678" });
    expect(a.parseC2b({ body, headers: {}, ip: "196.201.212.74", params: { secret: "cbsecret" } })).toMatchObject({ ok: true, status: "SUCCEEDED", amountMinorUnits: 145100n, providerRef: "RKT2XYZ", providerRequestId: "SFN-20260909-0001", eventKey: "mpesa-c2b:RKT2XYZ" });
    expect(a.parseC2b({ body, headers: {}, ip: "10.0.0.1", params: { secret: "cbsecret" } })).toMatchObject({ ok: false, reason: "BAD_SOURCE" });
  });
});
