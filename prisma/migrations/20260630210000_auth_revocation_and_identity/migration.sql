DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "owners"
    GROUP BY lower(trim("email"))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot normalize owner emails: case-insensitive duplicates require manual merge';
  END IF;
END $$;

UPDATE "owners" SET "email" = lower(trim("email"));
UPDATE "verification_tokens" SET "identifier" = lower(trim("identifier"));

CREATE UNIQUE INDEX "owners_email_lower_key" ON "owners" (lower("email"));

ALTER TABLE "owners"
ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "agents"
ADD COLUMN "credential_version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "oauth_access_tokens" (
  "id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "agent_id" TEXT NOT NULL,
  "credential_version" INTEGER NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_access_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oauth_access_tokens_token_hash_key" ON "oauth_access_tokens"("token_hash");
CREATE INDEX "oauth_access_tokens_agent_id_expires_at_idx" ON "oauth_access_tokens"("agent_id", "expires_at");
ALTER TABLE "oauth_access_tokens"
ADD CONSTRAINT "oauth_access_tokens_agent_id_fkey"
FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "login_attempts" (
  "key" TEXT NOT NULL,
  "owner_id" TEXT,
  "failures" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "login_attempts_locked_until_idx" ON "login_attempts"("locked_until");
ALTER TABLE "login_attempts"
ADD CONSTRAINT "login_attempts_owner_id_fkey"
FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "rate_limit_buckets" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "reset_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "rate_limit_buckets_reset_at_idx" ON "rate_limit_buckets"("reset_at");
