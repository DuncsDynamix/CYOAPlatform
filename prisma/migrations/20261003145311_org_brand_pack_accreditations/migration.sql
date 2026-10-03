-- AlterTable
ALTER TABLE "orgs" ADD COLUMN     "accreditations" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "brandPack" JSONB;
