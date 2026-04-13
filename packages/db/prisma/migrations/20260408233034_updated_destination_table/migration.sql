-- CreateEnum
CREATE TYPE "DestinationKind" AS ENUM ('CITY', 'STATE', 'REGION', 'COUNTRY');

-- AlterTable
ALTER TABLE "Destination" ADD COLUMN     "adminCode" TEXT,
ADD COLUMN     "kind" "DestinationKind" NOT NULL DEFAULT 'CITY',
ADD COLUMN     "m49Code" TEXT,
ADD COLUMN     "searchAliases" JSONB;

-- CreateIndex
CREATE INDEX "Destination_adminCode_idx" ON "Destination"("adminCode");

-- CreateIndex
CREATE INDEX "Destination_m49Code_idx" ON "Destination"("m49Code");

-- CreateIndex
CREATE INDEX "Destination_kind_idx" ON "Destination"("kind");
