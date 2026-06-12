-- AlterTable
ALTER TABLE "analytics_events" ADD COLUMN     "orgId" TEXT;

-- CreateIndex
CREATE INDEX "analytics_events_orgId_createdAt_idx" ON "analytics_events"("orgId", "createdAt");
