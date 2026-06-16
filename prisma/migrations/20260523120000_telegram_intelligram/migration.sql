-- Intelligram Telegram integration: owner Telegram identity, private forum
-- topic routing, and Team Space activation on communities.

-- CreateEnum
CREATE TYPE "TelegramTopicType" AS ENUM (
  'matches',
  'dates',
  'settings',
  'agent_log',
  'team_space'
);

-- AlterTable
ALTER TABLE "owners"
  ADD COLUMN "telegram_id" TEXT;

-- AlterTable
ALTER TABLE "communities"
  ADD COLUMN "team_mode" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "telegram_topics" (
  "id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "chat_id" TEXT NOT NULL,
  "topic_type" "TelegramTopicType" NOT NULL,
  "message_thread_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "telegram_topics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "owners_telegram_id_key" ON "owners"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_topics_owner_id_topic_type_key"
  ON "telegram_topics"("owner_id", "topic_type");

-- CreateIndex
CREATE INDEX "telegram_topics_chat_id_idx" ON "telegram_topics"("chat_id");

-- AddForeignKey
ALTER TABLE "telegram_topics"
  ADD CONSTRAINT "telegram_topics_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
