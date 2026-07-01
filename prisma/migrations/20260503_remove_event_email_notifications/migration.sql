ALTER TABLE "owners"
DROP COLUMN IF EXISTS "notify_all_emails",
DROP COLUMN IF EXISTS "notify_match_proposals",
DROP COLUMN IF EXISTS "notify_new_messages",
DROP COLUMN IF EXISTS "notify_freshness";

ALTER TABLE "inbox_events"
DROP COLUMN IF EXISTS "email_fallback_sent_at";

DROP TABLE IF EXISTS "email_notifications";
