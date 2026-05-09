-- Add production community chat, visible strategy budget USD limits, and read cursors.

CREATE TYPE "CommunityChatStatus" AS ENUM ('OPEN', 'ARCHIVED');

CREATE TYPE "CommunityChatMessageKind" AS ENUM ('HUMAN', 'SYSTEM', 'STRATEGY_SUMMARY');

ALTER TABLE "communities"
  ADD COLUMN "strategy_usd_limit" DOUBLE PRECISION,
  ADD COLUMN "monthly_usd_limit" DOUBLE PRECISION;

CREATE TABLE "community_chats" (
  "id" TEXT NOT NULL,
  "community_id" TEXT NOT NULL,
  "status" "CommunityChatStatus" NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "community_chats_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "community_chat_messages" (
  "id" TEXT NOT NULL,
  "chat_id" TEXT NOT NULL,
  "community_id" TEXT NOT NULL,
  "from_owner_id" TEXT,
  "kind" "CommunityChatMessageKind" NOT NULL DEFAULT 'HUMAN',
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "community_chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "community_chat_reads" (
  "id" TEXT NOT NULL,
  "chat_id" TEXT NOT NULL,
  "community_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "last_read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "community_chat_reads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "community_chats_community_id_key" ON "community_chats"("community_id");
CREATE INDEX "community_chat_messages_chat_id_created_at_idx" ON "community_chat_messages"("chat_id", "created_at");
CREATE INDEX "community_chat_messages_community_id_created_at_idx" ON "community_chat_messages"("community_id", "created_at");
CREATE INDEX "community_chat_messages_from_owner_id_idx" ON "community_chat_messages"("from_owner_id");
CREATE UNIQUE INDEX "community_chat_reads_chat_id_owner_id_key" ON "community_chat_reads"("chat_id", "owner_id");
CREATE INDEX "community_chat_reads_owner_id_last_read_at_idx" ON "community_chat_reads"("owner_id", "last_read_at");
CREATE INDEX "community_chat_reads_community_id_owner_id_idx" ON "community_chat_reads"("community_id", "owner_id");

ALTER TABLE "community_chats"
  ADD CONSTRAINT "community_chats_community_id_fkey"
  FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_chat_messages"
  ADD CONSTRAINT "community_chat_messages_chat_id_fkey"
  FOREIGN KEY ("chat_id") REFERENCES "community_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_chat_messages"
  ADD CONSTRAINT "community_chat_messages_from_owner_id_fkey"
  FOREIGN KEY ("from_owner_id") REFERENCES "owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "community_chat_reads"
  ADD CONSTRAINT "community_chat_reads_chat_id_fkey"
  FOREIGN KEY ("chat_id") REFERENCES "community_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_chat_reads"
  ADD CONSTRAINT "community_chat_reads_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
