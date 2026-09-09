-- Quote links: an unguessable token per quote (like Order.accessToken) and the sales note sent with it.
ALTER TABLE "Quote" ADD COLUMN "accessToken" TEXT;
ALTER TABLE "Quote" ADD COLUMN "salesNote" TEXT;
UPDATE "Quote" SET "accessToken" = md5(random()::text || clock_timestamp()::text || id) WHERE "accessToken" IS NULL;
ALTER TABLE "Quote" ALTER COLUMN "accessToken" SET NOT NULL;
CREATE UNIQUE INDEX "Quote_accessToken_key" ON "Quote"("accessToken");
