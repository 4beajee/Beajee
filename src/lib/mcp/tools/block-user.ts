import { prisma } from "@/lib/db";

export const blockUserTool = {
  name: "block_user" as const,
  description:
    "Block a user. Closes any shared chat, prevents future matches, " +
    "and the blocked user is never notified.",
  inputSchema: {
    type: "object" as const,
    properties: {
      owner_id: {
        type: "string",
        description: "The owner ID who is blocking",
      },
      blocked_owner_id: {
        type: "string",
        description: "The owner ID to block",
      },
    },
    required: ["owner_id", "blocked_owner_id"],
  },
  handler: async (args: { owner_id: string; blocked_owner_id: string }) => {
    const [blocker, blocked] = await Promise.all([
      prisma.owner.findUnique({ where: { id: args.owner_id }, include: { agent: true } }),
      prisma.owner.findUnique({ where: { id: args.blocked_owner_id }, include: { agent: true } }),
    ]);

    if (!blocker || !blocked) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "Owner not found" }) }],
        isError: true,
      };
    }

    if (args.owner_id === args.blocked_owner_id) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "Cannot block yourself" }) }],
        isError: true,
      };
    }

    // Create block record (upsert to avoid duplicate errors)
    await prisma.block.upsert({
      where: {
        blockerId_blockedId: {
          blockerId: args.owner_id,
          blockedId: args.blocked_owner_id,
        },
      },
      create: {
        blockerId: args.owner_id,
        blockedId: args.blocked_owner_id,
      },
      update: {},
    });

    // Close any shared chats by setting status to BLOCKED
    if (blocker.agent && blocked.agent) {
      const sharedMatches = await prisma.match.findMany({
        where: {
          OR: [
            { agentAId: blocker.agent.id, agentBId: blocked.agent.id },
            { agentAId: blocked.agent.id, agentBId: blocker.agent.id },
          ],
        },
        include: { chat: true },
      });

      for (const match of sharedMatches) {
        if (match.chat) {
          await prisma.chat.update({
            where: { id: match.chat.id },
            data: { status: "BLOCKED" },
          });
        }
        // Decline any active negotiations
        if (match.status === "NEGOTIATING" || match.status === "PROPOSED") {
          await prisma.match.update({
            where: { id: match.id },
            data: { status: "DECLINED" },
          });
        }
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            status: "blocked",
            message: "User blocked. Shared chats closed. No future matches possible.",
          }),
        },
      ],
    };
  },
};
