-- AlterTable
ALTER TABLE "experiences" ADD COLUMN     "segments" JSONB NOT NULL DEFAULT '[]';
