-- CreateEnum
CREATE TYPE "AgentType" AS ENUM (
  'OPENCLAW',
  'CLAUDE_DESKTOP',
  'MANUS',
  'LINDY',
  'GEMINI',
  'COPILOT',
  'CREWAI',
  'LANGGRAPH',
  'OPENAI_AGENTS',
  'DIFY',
  'AGENT_ZERO',
  'CUSTOM'
);

-- CreateEnum
CREATE TYPE "IntegrationMethod" AS ENUM (
  'MCP',
  'REST',
  'MANUAL',
  'A2A'
);

-- AlterTable
ALTER TABLE "agents" ADD COLUMN "agent_type" "AgentType" NOT NULL DEFAULT 'OPENCLAW';
ALTER TABLE "agents" ADD COLUMN "agent_version" TEXT;
ALTER TABLE "agents" ADD COLUMN "integration_method" "IntegrationMethod" NOT NULL DEFAULT 'MCP';
