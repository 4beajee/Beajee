import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type Transaction = Prisma.TransactionClient;

function pairKey(ownerAId: string, ownerBId: string) {
  return [ownerAId, ownerBId].sort().join(":");
}

export async function lockOwnerPair(
  tx: Transaction,
  ownerAId: string,
  ownerBId: string
) {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${pairKey(ownerAId, ownerBId)}, 0))
  `;
}

export async function ownerPairIsBlocked(
  tx: Transaction,
  ownerAId: string,
  ownerBId: string
) {
  const block = await tx.block.findFirst({
    where: {
      OR: [
        { blockerId: ownerAId, blockedId: ownerBId },
        { blockerId: ownerBId, blockedId: ownerAId },
      ],
    },
    select: { id: true },
  });
  return block !== null;
}

export async function blockOwner(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw new Error("Cannot block yourself");

  return prisma.$transaction(
    async (tx) => {
      await lockOwnerPair(tx, blockerId, blockedId);
      const [blocker, blocked] = await Promise.all([
        tx.owner.findUnique({ where: { id: blockerId }, include: { agent: true } }),
        tx.owner.findUnique({ where: { id: blockedId }, include: { agent: true } }),
      ]);
      if (!blocker || !blocked) throw new Error("Owner not found");

      await tx.block.upsert({
        where: { blockerId_blockedId: { blockerId, blockedId } },
        create: { blockerId, blockedId },
        update: {},
      });

      if (!blocker.agent || !blocked.agent) {
        return { applied: true, sharedMatchesClosed: 0 };
      }

      const sharedMatches = await tx.match.findMany({
        where: {
          OR: [
            { agentAId: blocker.agent.id, agentBId: blocked.agent.id },
            { agentAId: blocked.agent.id, agentBId: blocker.agent.id },
          ],
        },
        select: { id: true },
      });
      const matchIds = sharedMatches.map((match) => match.id);
      if (matchIds.length === 0) return { applied: true, sharedMatchesClosed: 0 };

      const chats = await tx.chat.updateMany({
        where: { matchId: { in: matchIds } },
        data: { status: "BLOCKED" },
      });
      await tx.match.updateMany({
        where: { id: { in: matchIds }, status: { in: ["NEGOTIATING", "PROPOSED"] } },
        data: { status: "DECLINED" },
      });
      return { applied: true, sharedMatchesClosed: chats.count };
    },
    { isolationLevel: "Serializable" }
  );
}
