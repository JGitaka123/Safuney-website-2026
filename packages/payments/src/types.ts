/**
 * Provider abstraction (brief §2). Checkout talks only to these types; adapters translate to Daraja,
 * Paystack, invoice or cash-on-delivery. A `pesapal` adapter can be added without touching checkout.
 *
 * Money is bigint minor units (KES cents) everywhere; adapters convert at the wire.
 */
export type PaymentMethod = "MPESA" | "CARD" | "INVOICE" | "COD";

export interface PaymentCustomer {
  name?: string;
  email?: string;
  /** E.164, e.g. +254712345678 */
  phone?: string;
}

export interface InitiateInput {
  orderId: string;
  orderNumber: string;
  amountMinorUnits: bigint;
  currency: "KES";
  customer: PaymentCustomer;
  /** Where the customer lands after a redirect-style payment. */
  returnUrl: string;
  /** Public base URL for provider callbacks, e.g. https://safuney.com */
  callbackBaseUrl: string;
  /** Free text shown on the customer's statement/prompt. */
  description: string;
  /** Idempotency: the same attempt id never initiates twice at the provider. */
  attemptId: string;
}

export type InitiateResult =
  /** M-Pesa STK push sent; wait for the callback, poll with queryStatus. */
  | { kind: "prompt"; providerRequestId: string; message: string; expiresInSeconds: number }
  /** Card: send the customer to the provider's page. */
  | { kind: "redirect"; providerRequestId: string; url: string }
  /** Nothing to collect online: invoice or cash on delivery. */
  | { kind: "offline"; providerRequestId: string; instructions: string };

export type CallbackStatus = "SUCCEEDED" | "FAILED" | "CANCELLED" | "PENDING";

export interface RawCallback {
  /** Raw request body as received (exact bytes matter for HMAC checks). */
  body: string;
  headers: Record<string, string | undefined>;
  /** Client IP as seen by the edge (x-forwarded-for first hop). */
  ip?: string;
  /** Path/query parameters, e.g. the secret path segment for Daraja. */
  params?: Record<string, string>;
}

export type ParsedCallback =
  | {
      ok: true;
      /** Unique per provider event; a replay carries the same key and is ignored. */
      eventKey: string;
      providerRequestId: string;
      providerRef?: string;
      amountMinorUnits?: bigint;
      status: CallbackStatus;
      failureReason?: string;
      /** Provider's phone/account for the receipt, if given. */
      payerRef?: string;
      raw: unknown;
    }
  | { ok: false; reason: "BAD_SIGNATURE" | "BAD_SOURCE" | "MALFORMED" | "UNKNOWN_EVENT"; detail?: string };

export interface StatusResult {
  status: CallbackStatus;
  providerRef?: string;
  failureReason?: string;
  amountMinorUnits?: bigint;
  raw?: unknown;
}

export interface PaymentAdapter {
  readonly method: PaymentMethod;
  readonly provider: "MPESA_DARAJA" | "PAYSTACK" | "INVOICE" | "COD";
  /** Whether production credentials are configured. Checkout hides methods that are not. */
  isConfigured(): boolean;
  initiate(input: InitiateInput): Promise<InitiateResult>;
  /** Verify and parse a provider callback/webhook. Never throws for bad input; returns ok:false. */
  parseCallback(raw: RawCallback): Promise<ParsedCallback>;
  /** Ask the provider for the current status (used for polling and reconciliation). */
  queryStatus(providerRequestId: string): Promise<StatusResult>;
}

export class PaymentProviderError extends Error {
  constructor(
    public readonly code: "CONFIG" | "NETWORK" | "TIMEOUT" | "REJECTED" | "AUTH",
    message: string,
    public readonly detail?: unknown,
  ) {
    super(message);
  }
}

/** Injectable HTTP so adapters are unit-testable without a network. */
export type Fetch = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export interface AdapterDeps {
  fetch?: Fetch;
  now?: () => Date;
  /** Request timeout in milliseconds (default 15 s). Daraja is slow; Paystack is fast. */
  timeoutMs?: number;
}
