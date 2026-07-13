ALTER TABLE "inbox_events"
  ADD COLUMN "dedupe_key" TEXT;

CREATE UNIQUE INDEX "inbox_events_dedupe_key_key"
  ON "inbox_events"("dedupe_key");
