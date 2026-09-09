


-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "accessToken" TEXT NOT NULL,
ADD COLUMN     "paymentAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reservationExpiresAt" TIMESTAMP(3);

-- AlterTable

-- CreateIndex
CREATE UNIQUE INDEX "Order_accessToken_key" ON "Order"("accessToken");

