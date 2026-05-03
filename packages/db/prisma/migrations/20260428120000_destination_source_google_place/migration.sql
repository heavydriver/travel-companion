-- CreateEnum
CREATE TYPE "DestinationSource" AS ENUM ('INTERNAL', 'GOOGLE_PLACES', 'MANUAL');

-- AlterTable
ALTER TABLE "Destination"
ADD COLUMN "googlePlaceId" TEXT,
ADD COLUMN "source" "DestinationSource" NOT NULL DEFAULT 'INTERNAL';

-- CreateIndex
CREATE UNIQUE INDEX "Destination_googlePlaceId_key" ON "Destination"("googlePlaceId");

-- CreateIndex
CREATE INDEX "Destination_source_idx" ON "Destination"("source");
