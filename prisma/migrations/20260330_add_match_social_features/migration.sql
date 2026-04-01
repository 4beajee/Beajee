-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'DISLIKE');

-- CreateTable
CREATE TABLE "match_reactions" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_comments" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_reactions_match_id_idx" ON "match_reactions"("match_id");
CREATE UNIQUE INDEX "match_reactions_match_id_owner_id_key" ON "match_reactions"("match_id", "owner_id");
CREATE INDEX "match_comments_match_id_idx" ON "match_comments"("match_id");

-- AddForeignKey
ALTER TABLE "match_reactions" ADD CONSTRAINT "match_reactions_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_reactions" ADD CONSTRAINT "match_reactions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_comments" ADD CONSTRAINT "match_comments_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_comments" ADD CONSTRAINT "match_comments_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
