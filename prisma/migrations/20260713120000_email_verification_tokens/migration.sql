CREATE TYPE "VerificationTokenPurpose" AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFICATION');

ALTER TABLE "verification_tokens"
  ADD COLUMN "purpose" "VerificationTokenPurpose" NOT NULL DEFAULT 'PASSWORD_RESET';

CREATE INDEX "verification_tokens_identifier_purpose_idx"
  ON "verification_tokens"("identifier", "purpose");
