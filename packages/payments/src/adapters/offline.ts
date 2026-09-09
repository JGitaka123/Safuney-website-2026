/**
 * Methods with nothing to collect online. Confirmation is recorded manually by finance (invoice) or by
 * the rider (cash / M-Pesa on delivery). They never receive provider callbacks.
 */
import type { InitiateInput, InitiateResult, ParsedCallback, PaymentAdapter, StatusResult } from "../types";

export class InvoiceAdapter implements PaymentAdapter {
  readonly method = "INVOICE" as const;
  readonly provider = "INVOICE" as const;
  isConfigured(): boolean {
    return true;
  }
  async initiate(input: InitiateInput): Promise<InitiateResult> {
    return { kind: "offline", providerRequestId: `invoice:${input.orderNumber}:${input.attemptId}`, instructions: "A pro-forma invoice is on its way. Pay by bank transfer or M-Pesa Paybill using the invoice number as the reference." };
  }
  async parseCallback(): Promise<ParsedCallback> {
    return { ok: false, reason: "UNKNOWN_EVENT" };
  }
  async queryStatus(): Promise<StatusResult> {
    return { status: "PENDING" };
  }
}

export class CashOnDeliveryAdapter implements PaymentAdapter {
  readonly method = "COD" as const;
  readonly provider = "COD" as const;
  isConfigured(): boolean {
    return true;
  }
  async initiate(input: InitiateInput): Promise<InitiateResult> {
    return { kind: "offline", providerRequestId: `cod:${input.orderNumber}:${input.attemptId}`, instructions: "Pay the rider in cash or by M-Pesa when the order arrives. The rider records the M-Pesa code on the delivery note." };
  }
  async parseCallback(): Promise<ParsedCallback> {
    return { ok: false, reason: "UNKNOWN_EVENT" };
  }
  async queryStatus(): Promise<StatusResult> {
    return { status: "PENDING" };
  }
}
