-- What each line actually reserved. A made-to-order line reserves only what existed, so releasing the
-- line quantity would take back stock the order never held (see apps/web/lib/orders/reservations.ts).
ALTER TABLE "OrderItem" ADD COLUMN "reservedQty" INTEGER NOT NULL DEFAULT 0;

-- Existing rows: orders still holding stock reserved their full quantity, since made-to-order lines
-- only under-reserve when stock had already run out. Everything else has nothing left to release.
UPDATE "OrderItem" SET "reservedQty" = "qty"
 WHERE "orderId" IN (SELECT "id" FROM "Order" WHERE "status" IN ('PENDING_PAYMENT', 'PAYMENT_FAILED', 'AWAITING_APPROVAL'));

-- The expired-reservation sweep filters orders by the variants it is about to read.
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");
