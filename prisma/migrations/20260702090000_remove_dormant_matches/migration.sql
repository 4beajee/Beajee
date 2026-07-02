-- Existing "Not now" records remain preserved as declined lifecycle history,
-- but are no longer exposed as a user-facing match state.
UPDATE "matches" SET "status" = 'DECLINED' WHERE "status" = 'DORMANT';

ALTER TABLE "matches" ALTER COLUMN "status" DROP DEFAULT;
CREATE TYPE "MatchStatus_new" AS ENUM ('NEGOTIATING', 'PROPOSED', 'MATCHED', 'DECLINED');
ALTER TABLE "matches"
  ALTER COLUMN "status" TYPE "MatchStatus_new"
  USING ("status"::text::"MatchStatus_new");
DROP TYPE "MatchStatus";
ALTER TYPE "MatchStatus_new" RENAME TO "MatchStatus";
ALTER TABLE "matches" ALTER COLUMN "status" SET DEFAULT 'NEGOTIATING';
