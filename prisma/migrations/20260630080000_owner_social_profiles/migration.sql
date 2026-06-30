ALTER TABLE "owners"
  ADD COLUMN "linkedin_url" TEXT,
  ADD COLUMN "twitter_url" TEXT,
  ADD COLUMN "social_profiles_prompted_at" TIMESTAMP(3),
  ADD COLUMN "social_profiles_prompt_dismissed_at" TIMESTAMP(3);
