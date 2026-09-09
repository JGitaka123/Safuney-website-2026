/** Human wording for the order and payment enums, used wherever staff or customers read a status. */
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@safuney/db";

const ORDER: Record<OrderStatus, string> = {
  DRAFT: "Draft",
  AWAITING_APPROVAL: "Waiting for approval",
  PENDING_PAYMENT: "Payment outstanding",
  PAYMENT_FAILED: "Payment failed",
  PAID: "Paid",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  DISPATCHED: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

const METHOD: Record<PaymentMethod, string> = {
  MPESA: "M-Pesa",
  CARD: "Card",
  INVOICE: "On invoice",
  COD: "Cash on delivery",
};

const PAYMENT: Record<PaymentStatus, string> = {
  INITIATED: "Initiated",
  PENDING: "Pending",
  SUCCEEDED: "Succeeded",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export function statusLabel(status: OrderStatus): string {
  return ORDER[status];
}

export function methodLabel(method: PaymentMethod): string {
  return METHOD[method];
}

export function paymentStatusLabel(status: PaymentStatus): string {
  return PAYMENT[status];
}
