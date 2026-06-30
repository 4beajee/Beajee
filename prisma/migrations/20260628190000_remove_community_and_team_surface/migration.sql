-- Remove the former Communities/Teams/Context Hub product surface.
-- Personal matching, public match activity, scheduling, Telegram, reputation,
-- and the hidden Model Advice implementation remain intact.

DROP TABLE IF EXISTS "community_chat_reads" CASCADE;
DROP TABLE IF EXISTS "community_chat_messages" CASCADE;
DROP TABLE IF EXISTS "community_chats" CASCADE;
DROP TABLE IF EXISTS "agent_tasks" CASCADE;
DROP TABLE IF EXISTS "team_activity_logs" CASCADE;
DROP TABLE IF EXISTS "community_action_proposals" CASCADE;
DROP TABLE IF EXISTS "community_strategy_turns" CASCADE;
DROP TABLE IF EXISTS "community_strategy_sessions" CASCADE;
DROP TABLE IF EXISTS "community_knowledge_chunks" CASCADE;
DROP TABLE IF EXISTS "community_knowledge_documents" CASCADE;
DROP TABLE IF EXISTS "community_knowledge_sources" CASCADE;
DROP TABLE IF EXISTS "community_channels" CASCADE;
DROP TABLE IF EXISTS "community_invite_handshakes" CASCADE;
DROP TABLE IF EXISTS "community_invites" CASCADE;
DROP TABLE IF EXISTS "agent_self_assessments" CASCADE;
DROP TABLE IF EXISTS "agent_instructions" CASCADE;
DROP TABLE IF EXISTS "agent_role_configs" CASCADE;
DROP TABLE IF EXISTS "community_members" CASCADE;
DROP TABLE IF EXISTS "corporate_connectors" CASCADE;
DROP TABLE IF EXISTS "communities" CASCADE;

-- Profile-enrichment connectors are gone. Calendar credentials remain because
-- they power the personal scheduling flow.
-- Some early production databases recorded the connector migration as applied
-- after the connector tables had already been removed manually. Recreate the
-- calendar credential table when it is missing so this migration also repairs
-- that schema drift instead of leaving scheduling unusable.
DO $$
BEGIN
  IF to_regclass('public.personal_connectors') IS NULL THEN
    CREATE TABLE "personal_connectors" (
      "id" TEXT NOT NULL,
      "owner_id" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "enabled" BOOLEAN NOT NULL DEFAULT true,
      "encrypted_token" TEXT,
      "token_iv" TEXT,
      "config" JSONB,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "personal_connectors_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "personal_connectors_owner_id_fkey"
        FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE UNIQUE INDEX "personal_connectors_owner_id_type_key"
      ON "personal_connectors"("owner_id", "type");
    CREATE INDEX "personal_connectors_type_enabled_idx"
      ON "personal_connectors"("type", "enabled");
  END IF;
END $$;

DELETE FROM "personal_connectors" WHERE "type" <> 'CALENDAR';
DROP TABLE IF EXISTS "personal_connector_events" CASCADE;
DROP TABLE IF EXISTS "profile_audit_logs" CASCADE;

ALTER TABLE "analytics_events"
  DROP COLUMN IF EXISTS "community_id",
  DROP COLUMN IF EXISTS "strategy_session_id",
  DROP COLUMN IF EXISTS "knowledge_source_id";

ALTER TABLE "compute_usage"
  DROP COLUMN IF EXISTS "community_id",
  DROP COLUMN IF EXISTS "strategy_session_id",
  DROP COLUMN IF EXISTS "knowledge_source_id";

DELETE FROM "telegram_topics" WHERE "topic_type" = 'team_space';
ALTER TYPE "TelegramTopicType" RENAME TO "TelegramTopicType_old";
CREATE TYPE "TelegramTopicType" AS ENUM ('matches', 'dates', 'settings', 'agent_log');
ALTER TABLE "telegram_topics"
  ALTER COLUMN "topic_type" TYPE "TelegramTopicType"
  USING ("topic_type"::text::"TelegramTopicType");
DROP TYPE "TelegramTopicType_old";

DROP TYPE IF EXISTS "CommunityVisibility";
DROP TYPE IF EXISTS "CommunityProfileVisibility";
DROP TYPE IF EXISTS "CommunityStatus";
DROP TYPE IF EXISTS "CommunityMemberRole";
DROP TYPE IF EXISTS "CommunityMemberStatus";
DROP TYPE IF EXISTS "CommunityInviteStatus";
DROP TYPE IF EXISTS "CommunityHandshakeStatus";
DROP TYPE IF EXISTS "CommunityKnowledgeSourceType";
DROP TYPE IF EXISTS "CommunityKnowledgeSourceStatus";
DROP TYPE IF EXISTS "CommunityKnowledgePrivacy";
DROP TYPE IF EXISTS "CommunityKnowledgeDocumentStatus";
DROP TYPE IF EXISTS "CommunityStrategySessionStatus";
DROP TYPE IF EXISTS "CommunityStrategyTurnRole";
DROP TYPE IF EXISTS "CommunityActionProposalType";
DROP TYPE IF EXISTS "CommunityActionProposalStatus";
DROP TYPE IF EXISTS "AgentTaskStatus";
DROP TYPE IF EXISTS "TaskRiskLevel";
DROP TYPE IF EXISTS "CommunityChatStatus";
DROP TYPE IF EXISTS "CommunityChatMessageKind";
DROP TYPE IF EXISTS "CommunityCategory";
DROP TYPE IF EXISTS "CommunitySpecialization";
