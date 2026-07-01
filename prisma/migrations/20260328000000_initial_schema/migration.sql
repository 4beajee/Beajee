-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('NEGOTIATING', 'PROPOSED', 'MATCHED', 'DORMANT', 'DECLINED');

-- CreateEnum
CREATE TYPE "FreshnessState" AS ENUM ('ACTIVE', 'AGING', 'STALE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ChatStatus" AS ENUM ('OPEN', 'ARCHIVED', 'BLOCKED');

-- CreateTable
CREATE TABLE "owners" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password_hash" TEXT,
    "email_verified" TIMESTAMP(3),
    "image" TEXT,
    "networking_goal" TEXT,
    "privacy_consent" BOOLEAN NOT NULL DEFAULT false,
    "research_consent" BOOLEAN NOT NULL DEFAULT false,
    "excluded_topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3) NOT NULL,
    "display_name" TEXT,
    "reputation_score" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "reputation_acceptance_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reputation_negotiation_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reputation_completed_matches" INTEGER NOT NULL DEFAULT 0,
    "total_proposed_matches" INTEGER NOT NULL DEFAULT 0,
    "total_initiated_negotiations" INTEGER NOT NULL DEFAULT 0,
    "total_accepted_by_owner" INTEGER NOT NULL DEFAULT 0,
    "total_negotiations_agreed" INTEGER NOT NULL DEFAULT 0,
    "interaction_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_contexts" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "current_work" TEXT NOT NULL,
    "expertise" TEXT[],
    "looking_for" TEXT NOT NULL,
    "not_looking_for" TEXT,
    "recent_problems" TEXT,
    "location" TEXT,
    "networking_goal" TEXT NOT NULL,
    "embedding" vector(1536),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "previous_hash" TEXT,
    "freshness_state" "FreshnessState" NOT NULL DEFAULT 'ACTIVE',
    "last_significant_update_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beacons" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "context_query" TEXT NOT NULL,
    "embedding" vector(1536),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "preservable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triggered_at" TIMESTAMP(3),

    CONSTRAINT "beacons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "agent_a_id" TEXT NOT NULL,
    "agent_b_id" TEXT NOT NULL,
    "overlap_summary" TEXT NOT NULL,
    "framing_for_a" TEXT NOT NULL,
    "framing_for_b" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'NEGOTIATING',
    "confirmed_by_a" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_by_b" BOOLEAN NOT NULL DEFAULT false,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proposed_at" TIMESTAMP(3),
    "matched_at" TIMESTAMP(3),

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chats" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "status" "ChatStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "from_owner" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negotiation_logs" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "negotiation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_logs" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "consented_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawn_at" TIMESTAMP(3),

    CONSTRAINT "consent_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" TEXT NOT NULL,
    "blocker_id" TEXT NOT NULL,
    "blocked_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "owners_email_key" ON "owners"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "agents_agent_id_key" ON "agents"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "agents_owner_id_key" ON "agents"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "agents_api_key_key" ON "agents"("api_key");

-- CreateIndex
CREATE UNIQUE INDEX "agent_contexts_agent_id_key" ON "agent_contexts"("agent_id");

-- CreateIndex
CREATE INDEX "beacons_is_active_idx" ON "beacons"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "matches_agent_a_id_agent_b_id_key" ON "matches"("agent_a_id", "agent_b_id");

-- CreateIndex
CREATE UNIQUE INDEX "chats_match_id_key" ON "chats"("match_id");

-- CreateIndex
CREATE INDEX "negotiation_logs_match_id_idx" ON "negotiation_logs"("match_id");

-- CreateIndex
CREATE INDEX "consent_logs_owner_id_idx" ON "consent_logs"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "blocks_blocker_id_blocked_id_key" ON "blocks"("blocker_id", "blocked_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_contexts" ADD CONSTRAINT "agent_contexts_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beacons" ADD CONSTRAINT "beacons_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_agent_a_id_fkey" FOREIGN KEY ("agent_a_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_agent_b_id_fkey" FOREIGN KEY ("agent_b_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_logs" ADD CONSTRAINT "negotiation_logs_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_logs" ADD CONSTRAINT "negotiation_logs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_logs" ADD CONSTRAINT "consent_logs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
