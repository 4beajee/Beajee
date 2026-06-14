-- CreateEnum
CREATE TYPE "MatchCallStatus" AS ENUM ('IDLE', 'SCHEDULING', 'TIME_PROPOSED', 'CONFIRMED', 'LINK_READY', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MatchCallProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "MessageKind" ADD VALUE 'ZOOM_CALL_LINK';
ALTER TYPE "MessageKind" ADD VALUE 'ZOOM_CALL_PROPOSAL';
ALTER TYPE "MessageKind" ADD VALUE 'ZOOM_CALL_CONFIRMED';

-- CreateTable
CREATE TABLE "match_calls" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "status" "MatchCallStatus" NOT NULL DEFAULT 'IDLE',
    "zoom_url" TEXT,
    "zoom_meeting_id" TEXT,
    "zoom_password" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "wants_call_by_a" BOOLEAN NOT NULL DEFAULT false,
    "wants_call_by_b" BOOLEAN NOT NULL DEFAULT false,
    "proposed_by_owner_id" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "link_generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_call_proposals" (
    "id" TEXT NOT NULL,
    "match_call_id" TEXT NOT NULL,
    "proposed_by_owner_id" TEXT NOT NULL,
    "slot_start" TIMESTAMP(3) NOT NULL,
    "slot_end" TIMESTAMP(3) NOT NULL,
    "status" "MatchCallProposalStatus" NOT NULL DEFAULT 'PENDING',
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_call_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "match_calls_match_id_key" ON "match_calls"("match_id");

-- CreateIndex
CREATE INDEX "match_call_proposals_match_call_id_status_idx" ON "match_call_proposals"("match_call_id", "status");

-- AddForeignKey
ALTER TABLE "match_calls" ADD CONSTRAINT "match_calls_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_call_proposals" ADD CONSTRAINT "match_call_proposals_match_call_id_fkey" FOREIGN KEY ("match_call_id") REFERENCES "match_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;