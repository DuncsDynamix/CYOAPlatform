-- AlterTable
ALTER TABLE "experiences" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "orgId" TEXT,
ADD COLUMN     "orgRole" TEXT;

-- CreateTable
CREATE TABLE "orgs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "trainingTier" TEXT,
    "studioTier" TEXT,
    "stripeCustomerId" TEXT,
    "isOperator" BOOLEAN NOT NULL DEFAULT false,
    "operatorApiKey" TEXT,
    "operatorApiKeyHint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orgs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orgs_slug_key" ON "orgs"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "orgs_stripeCustomerId_key" ON "orgs"("stripeCustomerId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
