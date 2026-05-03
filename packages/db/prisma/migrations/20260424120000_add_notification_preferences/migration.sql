-- AlterTable
ALTER TABLE "User" ADD COLUMN "notifyMessages" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "notifyConnections" BOOLEAN NOT NULL DEFAULT true;
