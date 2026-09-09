import { MpesaDarajaAdapter, darajaConfigFromEnv } from "./adapters/mpesa-daraja";
import { PaystackAdapter, paystackConfigFromEnv } from "./adapters/paystack";
import { CashOnDeliveryAdapter, InvoiceAdapter } from "./adapters/offline";
import { MockAdapter } from "./adapters/mock";
import type { PaymentAdapter, PaymentMethod } from "./types";

export type PaymentsMode = "live" | "mock";

export function paymentsMode(env: Record<string, string | undefined> = process.env): PaymentsMode {
  if (env["PAYMENTS_MODE"] === "mock") {
    if (env["VERCEL_ENV"] === "production") throw new Error("PAYMENTS_MODE=mock is not allowed in production");
    return "mock";
  }
  return "live";
}

/** One adapter per method. Built per process; adapters cache OAuth tokens. */
export function createRegistry(env: Record<string, string | undefined> = process.env): Record<PaymentMethod, PaymentAdapter> {
  if (paymentsMode(env) === "mock") {
    return {
      MPESA: new MockAdapter("MPESA", "prompt"),
      CARD: new MockAdapter("CARD", "redirect"),
      INVOICE: new MockAdapter("INVOICE", "offline"),
      COD: new MockAdapter("COD", "offline"),
    };
  }
  return {
    MPESA: new MpesaDarajaAdapter(darajaConfigFromEnv(env)),
    CARD: new PaystackAdapter(paystackConfigFromEnv(env)),
    INVOICE: new InvoiceAdapter(),
    COD: new CashOnDeliveryAdapter(),
  };
}
