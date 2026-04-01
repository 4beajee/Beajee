-- Multi-File Context: add columns from USER.md, AGENTS.md, SOUL.md to agent_contexts
-- All new columns are nullable — agents that only publish MEMORY.md fields still work.

-- From USER.md — stable owner facts
ALTER TABLE "agent_contexts" ADD COLUMN IF NOT EXISTS "owner_name" TEXT;
ALTER TABLE "agent_contexts" ADD COLUMN IF NOT EXISTS "owner_location" TEXT;
ALTER TABLE "agent_contexts" ADD COLUMN IF NOT EXISTS "owner_profession" TEXT;
ALTER TABLE "agent_contexts" ADD COLUMN IF NOT EXISTS "owner_domain" TEXT;
ALTER TABLE "agent_contexts" ADD COLUMN IF NOT EXISTS "owner_experience" TEXT;
ALTER TABLE "agent_contexts" ADD COLUMN IF NOT EXISTS "owner_goals" TEXT;

-- From AGENTS.md — agent role and specialization
ALTER TABLE "agent_contexts" ADD COLUMN IF NOT EXISTS "agent_specialization" TEXT;
ALTER TABLE "agent_contexts" ADD COLUMN IF NOT EXISTS "agent_domains" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "agent_contexts" ADD COLUMN IF NOT EXISTS "agent_constraints" TEXT;

-- From SOUL.md — collaboration style signals
ALTER TABLE "agent_contexts" ADD COLUMN IF NOT EXISTS "collaboration_style" TEXT;
ALTER TABLE "agent_contexts" ADD COLUMN IF NOT EXISTS "communication_style" TEXT;

-- From MEMORY.md — new field
ALTER TABLE "agent_contexts" ADD COLUMN IF NOT EXISTS "recent_wins" TEXT;
