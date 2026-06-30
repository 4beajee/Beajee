CREATE TABLE "setup_grants" (
  "id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "agent_id" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "setup_grants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "setup_grants_token_hash_key" ON "setup_grants"("token_hash");
CREATE INDEX "setup_grants_agent_id_expires_at_idx" ON "setup_grants"("agent_id", "expires_at");
ALTER TABLE "setup_grants"
ADD CONSTRAINT "setup_grants_agent_id_fkey"
FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
