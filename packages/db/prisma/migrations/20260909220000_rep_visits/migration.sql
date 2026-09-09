-- Sales-rep visit notes (Phase 8, feature 8). GPS is optional and consent-based.
CREATE TABLE "RepVisit" (
    "id" TEXT NOT NULL,
    "repId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracyM" INTEGER,
    "outcome" TEXT,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RepVisit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RepVisit_customerId_visitedAt_idx" ON "RepVisit"("customerId", "visitedAt");
CREATE INDEX "RepVisit_repId_visitedAt_idx" ON "RepVisit"("repId", "visitedAt");

ALTER TABLE "RepVisit" ADD CONSTRAINT "RepVisit_repId_fkey" FOREIGN KEY ("repId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RepVisit" ADD CONSTRAINT "RepVisit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Coordinates are either both present or both absent: half a fix is not a location.
ALTER TABLE "RepVisit" ADD CONSTRAINT "RepVisit_coordinates_complete"
  CHECK (("latitude" IS NULL) = ("longitude" IS NULL));
ALTER TABLE "RepVisit" ADD CONSTRAINT "RepVisit_latitude_range" CHECK ("latitude" IS NULL OR ("latitude" BETWEEN -90 AND 90));
ALTER TABLE "RepVisit" ADD CONSTRAINT "RepVisit_longitude_range" CHECK ("longitude" IS NULL OR ("longitude" BETWEEN -180 AND 180));
