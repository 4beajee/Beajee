UPDATE "matches"
SET "initiator_agent_id" = "agent_a_id"
WHERE "initiator_agent_id" IS NULL;

UPDATE "negotiation_logs" log
SET "role" = CASE
  WHEN log."agent_id" = m."initiator_agent_id" THEN 'initiator'
  ELSE 'responder'
END
FROM "matches" m
WHERE log."match_id" = m."id";

ALTER TABLE "matches"
ALTER COLUMN "initiator_agent_id" SET NOT NULL;

ALTER TABLE "matches"
ADD CONSTRAINT "matches_initiator_is_participant"
CHECK ("initiator_agent_id" = "agent_a_id" OR "initiator_agent_id" = "agent_b_id");

ALTER TABLE "matches"
ADD CONSTRAINT "matches_initiator_agent_id_fkey"
FOREIGN KEY ("initiator_agent_id") REFERENCES "agents"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
