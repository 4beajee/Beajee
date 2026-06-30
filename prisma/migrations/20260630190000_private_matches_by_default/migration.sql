ALTER TABLE "matches"
ALTER COLUMN "is_public" SET DEFAULT false;

UPDATE "matches"
SET "is_public" = false
WHERE "status" <> 'MATCHED';
