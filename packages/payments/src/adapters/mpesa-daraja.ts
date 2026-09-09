/**
 * Safaricom Daraja — Lipa na M-Pesa Online (STK push), transaction status query, and C2B
 * validation/confirmation. Sandbox first (brief §2).
 *
 * Daraja callbacks carry no signature. Three checks stand in for one:
 *   1. the callback URL contains a secret path segment only we and Safaricom know;
 *   2. the source IP must be in Safaricom's published callback range (unless disabled for sandbox);
 *   3. the CheckoutRequestID must match a payment we initiated (checked by the caller) and the
 *      amount must equal the order amount (checked by the caller against amountMinorUnits).
 * Replays are rejected by the caller via the eventKey (CheckoutRequestID + ResultCode + receipt).
 */
import { createHash } from "node:crypto";
import { fetchJson, defaultFetch } from "../http";
import { PaymentProviderError, type AdapterDeps, type InitiateInput, type InitiateResult, type ParsedCallback, type PaymentAdapter, type RawCallback, type StatusResult } from "../types";

export interface DarajaConfig {
  environment: "sandbox" | "production";
  consumerKey: string;
  consumerSecret: string;
  /** Paybill or Till shortcode */
  shortcode: string;
  passkey: string;
  /** "CustomerPayBillOnline" for Paybill, "CustomerBuyGoodsOnline" for Till */
  transactionType?: "CustomerPayBillOnline" | "CustomerBuyGoodsOnline";
  /** Secret path segment appended to the callback URL. */
  callbackSecret: string;
  /** Enforce Safaricom's source IP allowlist (on in production). */
  enforceSourceIp?: boolean;
}

/** Published Safaricom callback source IPs (Daraja documentation). */
export const SAFARICOM_IPS = [
  "196.201.214.200",
  "196.201.214.206",
  "196.201.213.114",
  "196.201.214.207",
  "196.201.214.208",
  "196.201.213.44",
  "196.201.212.127",
  "196.201.212.138",
  "196.201.212.129",
  "196.201.212.136",
  "196.201.212.74",
  "196.201.212.69",
];

function timestamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

export function darajaConfigFromEnv(env: Record<string, string | undefined> = process.env): DarajaConfig | null {
  const { MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_CALLBACK_SECRET } = env;
  if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET || !MPESA_SHORTCODE || !MPESA_PASSKEY || !MPESA_CALLBACK_SECRET) return null;
  const environment = env["MPESA_ENV"] === "production" ? "production" : "sandbox";
  return {
    environment,
    consumerKey: MPESA_CONSUMER_KEY,
    consumerSecret: MPESA_CONSUMER_SECRET,
    shortcode: MPESA_SHORTCODE,
    passkey: MPESA_PASSKEY,
    transactionType: env["MPESA_TRANSACTION_TYPE"] === "CustomerBuyGoodsOnline" ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline",
    callbackSecret: MPESA_CALLBACK_SECRET,
    enforceSourceIp: environment === "production" ? env["MPESA_ENFORCE_SOURCE_IP"] !== "0" : env["MPESA_ENFORCE_SOURCE_IP"] === "1",
  };
}

export class MpesaDarajaAdapter implements PaymentAdapter {
  readonly method = "MPESA" as const;
  readonly provider = "MPESA_DARAJA" as const;
  private readonly fetch;
  private readonly now;
  private readonly timeoutMs;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly config: DarajaConfig | null,
    deps: AdapterDeps = {},
  ) {
    this.fetch = deps.fetch ?? defaultFetch();
    this.now = deps.now ?? (() => new Date());
    this.timeoutMs = deps.timeoutMs ?? 20_000;
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  private get baseUrl(): string {
    return this.config?.environment === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  }

  private cfg(): DarajaConfig {
    if (!this.config) throw new PaymentProviderError("CONFIG", "M-Pesa is not configured");
    return this.config;
  }

  private async accessToken(): Promise<string> {
    const c = this.cfg();
    if (this.token && this.token.expiresAt > Date.now() + 30_000) return this.token.value;
    const basic = Buffer.from(`${c.consumerKey}:${c.consumerSecret}`).toString("base64");
    const res = await fetchJson(this.fetch, `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, { method: "GET", headers: { Authorization: `Basic ${basic}` } }, this.timeoutMs);
    const j = res.json as { access_token?: string; expires_in?: string } | null;
    if (!res.ok || !j?.access_token) throw new PaymentProviderError("AUTH", "M-Pesa rejected our credentials", res.text);
    this.token = { value: j.access_token, expiresAt: Date.now() + Number(j.expires_in ?? 3599) * 1000 };
    return this.token.value;
  }

  private password(ts: string): string {
    const c = this.cfg();
    return Buffer.from(`${c.shortcode}${c.passkey}${ts}`).toString("base64");
  }

  callbackPath(): string {
    return `/api/payments/mpesa/callback/${this.cfg().callbackSecret}`;
  }

  async initiate(input: InitiateInput): Promise<InitiateResult> {
    const c = this.cfg();
    const phone = normaliseForDaraja(input.customer.phone);
    if (!phone) throw new PaymentProviderError("REJECTED", "A Safaricom number is needed for the M-Pesa request.");
    if (input.amountMinorUnits % 100n !== 0n) {
      // Daraja takes whole shillings. Round up so the customer never underpays; the difference is
      // reconciled by the caller (it is at most 99 cents).
    }
    const amountKes = Number((input.amountMinorUnits + 99n) / 100n);
    if (amountKes < 1) throw new PaymentProviderError("REJECTED", "Amount must be at least KES 1.");
    const token = await this.accessToken();
    const ts = timestamp(this.now());
    const body = {
      BusinessShortCode: c.shortcode,
      Password: this.password(ts),
      Timestamp: ts,
      TransactionType: c.transactionType ?? "CustomerPayBillOnline",
      Amount: amountKes,
      PartyA: phone,
      PartyB: c.shortcode,
      PhoneNumber: phone,
      CallBackURL: `${input.callbackBaseUrl}${this.callbackPath()}`,
      AccountReference: input.orderNumber.slice(0, 12),
      TransactionDesc: input.description.slice(0, 13),
    };
    const res = await fetchJson(this.fetch, `${this.baseUrl}/mpesa/stkpush/v1/processrequest`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }, this.timeoutMs);
    const j = res.json as { ResponseCode?: string; CheckoutRequestID?: string; CustomerMessage?: string; errorMessage?: string; ResponseDescription?: string } | null;
    if (!res.ok || j?.ResponseCode !== "0" || !j.CheckoutRequestID) {
      throw new PaymentProviderError("REJECTED", j?.errorMessage ?? j?.ResponseDescription ?? "M-Pesa did not accept the request", res.text);
    }
    return { kind: "prompt", providerRequestId: j.CheckoutRequestID, message: j.CustomerMessage ?? "Check your phone for the M-Pesa prompt and enter your PIN.", expiresInSeconds: 120 };
  }

  async parseCallback(raw: RawCallback): Promise<ParsedCallback> {
    const c = this.config;
    if (!c) return { ok: false, reason: "MALFORMED", detail: "not configured" };
    if (raw.params?.["secret"] !== c.callbackSecret) return { ok: false, reason: "BAD_SIGNATURE", detail: "callback secret mismatch" };
    if (c.enforceSourceIp && (!raw.ip || !SAFARICOM_IPS.includes(raw.ip))) return { ok: false, reason: "BAD_SOURCE", detail: raw.ip };
    let body: unknown;
    try {
      body = JSON.parse(raw.body);
    } catch {
      return { ok: false, reason: "MALFORMED", detail: "not JSON" };
    }
    const cb = (body as { Body?: { stkCallback?: Record<string, unknown> } })?.Body?.stkCallback;
    if (!cb || typeof cb["CheckoutRequestID"] !== "string" || typeof cb["ResultCode"] !== "number") return { ok: false, reason: "MALFORMED", detail: "no stkCallback" };
    const checkoutId = cb["CheckoutRequestID"];
    const resultCode = cb["ResultCode"];
    const items = ((cb["CallbackMetadata"] as { Item?: Array<{ Name: string; Value?: unknown }> } | undefined)?.Item ?? []);
    const item = (name: string) => items.find((i) => i.Name === name)?.Value;
    const receipt = typeof item("MpesaReceiptNumber") === "string" ? (item("MpesaReceiptNumber") as string) : undefined;
    const amount = typeof item("Amount") === "number" ? BigInt(Math.round((item("Amount") as number) * 100)) : undefined;
    const phone = item("PhoneNumber") !== undefined ? String(item("PhoneNumber")) : undefined;
    const status = resultCode === 0 ? "SUCCEEDED" : resultCode === 1032 ? "CANCELLED" : "FAILED";
    const eventKey = `mpesa:${checkoutId}:${resultCode}:${receipt ?? ""}`;
    return {
      ok: true,
      eventKey,
      providerRequestId: checkoutId,
      providerRef: receipt,
      amountMinorUnits: amount,
      status,
      failureReason: status === "SUCCEEDED" ? undefined : String(cb["ResultDesc"] ?? `Result code ${resultCode}`),
      payerRef: phone,
      raw: body,
    };
  }

  async queryStatus(providerRequestId: string): Promise<StatusResult> {
    const c = this.cfg();
    const token = await this.accessToken();
    const ts = timestamp(this.now());
    const res = await fetchJson(this.fetch, `${this.baseUrl}/mpesa/stkpushquery/v1/query`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ BusinessShortCode: c.shortcode, Password: this.password(ts), Timestamp: ts, CheckoutRequestID: providerRequestId }) }, this.timeoutMs);
    const j = res.json as { ResultCode?: string | number; ResultDesc?: string; errorCode?: string; errorMessage?: string } | null;
    if (!res.ok) {
      // "The transaction is being processed" comes back as a 500 with errorCode 500.001.1001.
      if (j?.errorCode === "500.001.1001") return { status: "PENDING", raw: j };
      throw new PaymentProviderError("NETWORK", j?.errorMessage ?? "Status query failed", res.text);
    }
    const code = Number(j?.ResultCode);
    if (code === 0) return { status: "SUCCEEDED", raw: j };
    if (code === 1032) return { status: "CANCELLED", failureReason: j?.ResultDesc, raw: j };
    if (Number.isNaN(code)) return { status: "PENDING", raw: j };
    return { status: "FAILED", failureReason: j?.ResultDesc, raw: j };
  }

  /** C2B validation/confirmation (Paybill payments made without a prompt). Same secret + IP checks. */
  parseC2b(raw: RawCallback): ParsedCallback {
    const c = this.config;
    if (!c) return { ok: false, reason: "MALFORMED", detail: "not configured" };
    if (raw.params?.["secret"] !== c.callbackSecret) return { ok: false, reason: "BAD_SIGNATURE" };
    if (c.enforceSourceIp && (!raw.ip || !SAFARICOM_IPS.includes(raw.ip))) return { ok: false, reason: "BAD_SOURCE", detail: raw.ip };
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw.body);
    } catch {
      return { ok: false, reason: "MALFORMED" };
    }
    if (typeof body["TransID"] !== "string" || body["TransAmount"] === undefined) return { ok: false, reason: "MALFORMED" };
    const amount = BigInt(Math.round(Number(body["TransAmount"]) * 100));
    return {
      ok: true,
      eventKey: `mpesa-c2b:${body["TransID"]}`,
      providerRequestId: String(body["BillRefNumber"] ?? ""),
      providerRef: body["TransID"],
      amountMinorUnits: amount,
      status: "SUCCEEDED",
      payerRef: body["MSISDN"] !== undefined ? String(body["MSISDN"]) : undefined,
      raw: body,
    };
  }
}

/** Daraja wants 2547XXXXXXXX / 2541XXXXXXXX with no plus sign. */
export function normaliseForDaraja(phone: string | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  const m = /^(?:254|0)?([17]\d{8})$/.exec(digits);
  return m ? `254${m[1]}` : null;
}

/** Stable idempotency key for an initiation attempt. */
export function attemptKey(orderId: string, attemptId: string): string {
  return createHash("sha256").update(`${orderId}:${attemptId}`).digest("hex").slice(0, 32);
}
