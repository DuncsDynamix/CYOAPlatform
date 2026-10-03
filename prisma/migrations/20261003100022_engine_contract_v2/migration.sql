-- AlterTable
ALTER TABLE "experience_sessions" ADD COLUMN     "context" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "experiences" ADD COLUMN     "presentation" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "orgs" ADD COLUMN     "competencyFramework" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "personalisationEnabled" BOOLEAN NOT NULL DEFAULT false;
