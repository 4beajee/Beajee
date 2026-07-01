-- Align columns that existed in Prisma but were missing from the deploy history.
ALTER TABLE "owners"
  ADD COLUMN IF NOT EXISTS "agent_platform" TEXT;

ALTER TABLE "agents"
  ALTER COLUMN "last_active_at" SET DEFAULT CURRENT_TIMESTAMP;

-- Retired enum variants are no longer accepted by the application schema.
UPDATE "agents" SET "agent_type" = 'OPENCLAW' WHERE "agent_type" <> 'OPENCLAW';
ALTER TABLE "agents" ALTER COLUMN "agent_type" DROP DEFAULT;
ALTER TYPE "AgentType" RENAME TO "AgentType_legacy";
CREATE TYPE "AgentType" AS ENUM ('OPENCLAW');
ALTER TABLE "agents" ALTER COLUMN "agent_type" TYPE "AgentType"
  USING ("agent_type"::text::"AgentType");
ALTER TABLE "agents" ALTER COLUMN "agent_type" SET DEFAULT 'OPENCLAW';
DROP TYPE "AgentType_legacy";

UPDATE "agents" SET "integration_method" = 'MCP' WHERE "integration_method" <> 'MCP';
ALTER TABLE "agents" ALTER COLUMN "integration_method" DROP DEFAULT;
ALTER TYPE "IntegrationMethod" RENAME TO "IntegrationMethod_legacy";
CREATE TYPE "IntegrationMethod" AS ENUM ('MCP');
ALTER TABLE "agents" ALTER COLUMN "integration_method" TYPE "IntegrationMethod"
  USING ("integration_method"::text::"IntegrationMethod");
ALTER TABLE "agents" ALTER COLUMN "integration_method" SET DEFAULT 'MCP';
DROP TYPE "IntegrationMethod_legacy";
