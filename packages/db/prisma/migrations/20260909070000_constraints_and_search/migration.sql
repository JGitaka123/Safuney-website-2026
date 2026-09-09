-- Hand-written migration: database-level invariants Prisma cannot express.
-- Non-negotiables #3 (no negative stock), #5 (order events append-only), plus search.

-- 1. Stock can never go negative and reservations can never exceed stock on hand.
ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_stock_non_negative" CHECK ("stockOnHand" >= 0),
  ADD CONSTRAINT "ProductVariant_reserved_non_negative" CHECK ("stockReserved" >= 0),
  ADD CONSTRAINT "ProductVariant_reserved_lte_on_hand" CHECK ("stockReserved" <= "stockOnHand");

-- 2. Money and quantities.
ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_price_non_negative" CHECK ("priceMinorUnits" >= 0),
  ADD CONSTRAINT "ProductVariant_vat_bps_range" CHECK ("vatRateBps" >= 0 AND "vatRateBps" <= 10000);
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_qty_positive" CHECK ("qty" > 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_qty_positive" CHECK ("qty" > 0);
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_totals_non_negative" CHECK (
    "subtotalMinorUnits" >= 0 AND "vatMinorUnits" >= 0 AND "deliveryMinorUnits" >= 0
    AND "discountMinorUnits" >= 0 AND "totalMinorUnits" >= 0
  );
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_positive" CHECK ("amountMinorUnits" > 0);
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_credit_non_negative" CHECK ("creditLimitMinorUnits" >= 0);

-- 3. OrderEvent is append-only: UPDATE and DELETE are rejected at the database.
--    The only exception is a hard delete of a whole order (test cleanup, or a DPA erasure that the
--    finance team has signed off), which must run inside a transaction that first executes
--    SET LOCAL safuney.allow_order_event_delete = 'on'. UPDATE is never allowed.
CREATE OR REPLACE FUNCTION reject_order_event_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('safuney.allow_order_event_delete', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'OrderEvent rows are append-only (attempted %)', TG_OP;
END;
$$;

CREATE TRIGGER order_event_append_only
  BEFORE UPDATE OR DELETE ON "OrderEvent"
  FOR EACH ROW EXECUTE FUNCTION reject_order_event_mutation();

-- 4. Full-text search over products (Postgres tsvector, kept current by trigger).
ALTER TABLE "Product" ADD COLUMN "searchVector" tsvector;

CREATE OR REPLACE FUNCTION product_search_vector_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW."name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."brand", '')), 'A') ||
    setweight(to_tsvector('english', array_to_string(NEW."tags", ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."shortDescription", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."longDescription", '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW."howToUse", '')), 'D');
  RETURN NEW;
END;
$$;

CREATE TRIGGER product_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "name", "brand", "tags", "shortDescription", "longDescription", "howToUse"
  ON "Product"
  FOR EACH ROW EXECUTE FUNCTION product_search_vector_update();

CREATE INDEX "Product_searchVector_idx" ON "Product" USING GIN ("searchVector");

-- Trigram indexes for typo-tolerant search on names and SKUs.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Product_name_trgm_idx" ON "Product" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "ProductVariant_sku_trgm_idx" ON "ProductVariant" USING GIN ("sku" gin_trgm_ops);
