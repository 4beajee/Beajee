-- AlterTable
ALTER TABLE "owners" ADD COLUMN "scheduling_url" TEXT;

-- AlterTable
ALTER TABLE "matches" ADD COLUMN "scheduling_host_owner_id" TEXT;
ALTER TABLE "matches" ADD COLUMN "scheduling_guest_owner_id" TEXT;