-- AlterTable: add global email kill switch to owners
ALTER TABLE "owners" ADD COLUMN "notify_all_emails" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: add email notification throttle timestamps to chats
ALTER TABLE "chats" ADD COLUMN "last_notified_a" TIMESTAMP(3);
ALTER TABLE "chats" ADD COLUMN "last_notified_b" TIMESTAMP(3);

-- CreateTable: email notification audit log
CREATE TABLE "email_notifications" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "resend_id" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_notifications_owner_id_type_reference_id_idx" ON "email_notifications"("owner_id", "type", "reference_id");
CREATE INDEX "email_notifications_sent_at_idx" ON "email_notifications"("sent_at");
