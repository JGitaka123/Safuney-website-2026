import { db } from "@safuney/db";
import { createRegistry } from "@safuney/payments";
import { config } from "@/lib/env";
import { OrderService } from "./service";

const g = globalThis as unknown as { __safuneyRegistry?: ReturnType<typeof createRegistry> };

export function paymentRegistry() {
  if (!g.__safuneyRegistry) g.__safuneyRegistry = createRegistry();
  return g.__safuneyRegistry;
}

export function orderService(): OrderService {
  return new OrderService(db(), paymentRegistry());
}

export function publicBaseUrl(): string {
  return config.siteUrl.replace(/\/$/, "");
}
