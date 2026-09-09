-- Expired-reservation sweep runs on every availability check (see apps/web/lib/orders/reservations.ts).
CREATE INDEX "Order_status_reservationExpiresAt_idx" ON "Order"("status", "reservationExpiresAt");
