CREATE TYPE "ContextQuestionBatchStatus" AS ENUM (
  'READY', 'ACTIVE', 'REVIEW', 'COMPLETED', 'SKIPPED', 'DISCARDED', 'EXPIRED'
);

CREATE TYPE "ContextQuestionDelivery" AS ENUM ('TELEGRAM', 'NATIVE_AGENT');

CREATE TABLE "context_question_batches" (
  "id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "agent_id" TEXT NOT NULL,
  "cadence_key" TEXT NOT NULL,
  "delivery" "ContextQuestionDelivery" NOT NULL,
  "status" "ContextQuestionBatchStatus" NOT NULL DEFAULT 'READY',
  "summary" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "delivered_at" TIMESTAMP(3),
  "delivery_error" TEXT,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "context_question_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "context_questions" (
  "id" TEXT NOT NULL,
  "batch_id" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "topic" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "follow_up_prompt" TEXT,
  "is_follow_up" BOOLEAN NOT NULL DEFAULT false,
  "parent_question_id" TEXT,
  "answer" TEXT,
  "answered_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "context_questions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "context_question_batches_owner_id_cadence_key_key"
  ON "context_question_batches"("owner_id", "cadence_key");
CREATE INDEX "context_question_batches_agent_id_status_idx"
  ON "context_question_batches"("agent_id", "status");
CREATE INDEX "context_question_batches_status_expires_at_idx"
  ON "context_question_batches"("status", "expires_at");
CREATE UNIQUE INDEX "context_questions_batch_id_sequence_key"
  ON "context_questions"("batch_id", "sequence");
CREATE INDEX "context_questions_batch_id_answered_at_idx"
  ON "context_questions"("batch_id", "answered_at");

ALTER TABLE "context_question_batches"
  ADD CONSTRAINT "context_question_batches_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "context_question_batches"
  ADD CONSTRAINT "context_question_batches_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "context_questions"
  ADD CONSTRAINT "context_questions_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "context_question_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
