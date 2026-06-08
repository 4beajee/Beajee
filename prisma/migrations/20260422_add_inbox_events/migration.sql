-- CreateTable: inbox events — primary delivery channel for agent-visible notifications.
-- Agents poll these via check_in and acknowledge delivery via ack_inbox.
-- Email becomes a fallback for events that stay undelivered past a threshold.
CREATE TABLE "inbox_events" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),
    "email_fallback_sent_at" TIMESTAMP(3),

    CONSTRAINT "inbox_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inbox_events_agent_id_dismissed_at_idx" ON "inbox_events"("agent_id", "dismissed_at");
CREATE INDEX "inbox_events_owner_id_type_reference_id_idx" ON "inbox_events"("owner_id", "type", "reference_id");
CREATE INDEX "inbox_events_created_at_idx" ON "inbox_events"("created_at");

-- AlterTable: agents get optional webhook fields so Beajee can wake them up
-- on hot events (new message, match). Nullable — agents without a webhook
-- keep working on pure polling.
ALTER TABLE "agents" ADD COLUMN "webhook_url" TEXT;
ALTER TABLE "agents" ADD COLUMN "webhook_token" TEXT;
