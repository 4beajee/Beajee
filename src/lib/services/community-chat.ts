import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createInboxEvent } from "@/lib/services/inbox";
import { signalAgentWork } from "@/lib/services/agent-delivery";

type Db = typeof prisma | Prisma.TransactionClient;

export class CommunityChatError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

function serializeMessage(message: {
  id: string;
  fromOwnerId: string | null;
  kind: string;
  content: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  fromOwner?: { id: string; name: string | null; image: string | null } | null;
}) {
  return {
    id: message.id,
    fromOwnerId: message.fromOwnerId,
    fromOwner: message.fromOwner ?? null,
    kind: message.kind,
    content: message.content,
    metadata: message.metadata,
    createdAt: message.createdAt,
  };
}

async function getActiveMembership(db: Db, communityId: string, ownerId: string) {
  return db.communityMember.findUnique({
    where: { communityId_ownerId: { communityId, ownerId } },
    select: { id: true, role: true, status: true },
  });
}

async function activeMemberCount(db: Db, communityId: string) {
  return db.communityMember.count({
    where: { communityId, status: "ACTIVE" },
  });
}

export async function ensureCommunityChatUnlocked(communityId: string, db: Db = prisma) {
  const count = await activeMemberCount(db, communityId);
  if (count < 2) return null;

  const chat = await db.communityChat.upsert({
    where: { communityId },
    update: {},
    create: {
      communityId,
      messages: {
        create: {
          communityId,
          kind: "SYSTEM",
          content: "Community chat opened because this hub now has at least two active members.",
          metadata: { reason: "second_member_joined" },
        },
      },
    },
  });

  return chat;
}

export async function getCommunityChat(ownerId: string, communityId: string) {
  const [community, membership, count] = await Promise.all([
    prisma.community.findUnique({
      where: { id: communityId },
      select: { id: true, name: true, slug: true, status: true },
    }),
    getActiveMembership(prisma, communityId, ownerId),
    activeMemberCount(prisma, communityId),
  ]);

  if (!community || community.status !== "ACTIVE") {
    throw new CommunityChatError("Community not found", 404);
  }
  if (!membership || membership.status !== "ACTIVE") {
    throw new CommunityChatError("Only active community members can open chat", 403);
  }

  const chat = await ensureCommunityChatUnlocked(communityId);
  if (!chat) {
    return {
      locked: true,
      memberCount: count,
      requiredMembers: 2,
      chat: null,
      messages: [],
      unreadCount: 0,
    };
  }

  const [messages, readCursor] = await Promise.all([
    prisma.communityChatMessage.findMany({
      where: { chatId: chat.id },
      include: {
        fromOwner: { select: { id: true, name: true, image: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    prisma.communityChatRead.findUnique({
      where: { chatId_ownerId: { chatId: chat.id, ownerId } },
      select: { lastReadAt: true },
    }),
  ]);

  const unreadCount = await prisma.communityChatMessage.count({
    where: {
      chatId: chat.id,
      fromOwnerId: { not: ownerId },
      ...(readCursor?.lastReadAt ? { createdAt: { gt: readCursor.lastReadAt } } : {}),
    },
  });

  await prisma.communityChatRead.upsert({
    where: { chatId_ownerId: { chatId: chat.id, ownerId } },
    create: { chatId: chat.id, communityId, ownerId, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });

  return {
    locked: false,
    memberCount: count,
    requiredMembers: 2,
    chat: {
      id: chat.id,
      communityId,
      status: chat.status,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    },
    messages: messages.map(serializeMessage),
    unreadCount,
  };
}

export async function sendCommunityChatMessage(ownerId: string, communityId: string, content: string) {
  const text = content.trim();
  if (text.length < 1) throw new CommunityChatError("Message cannot be empty", 400);
  if (text.length > 4000) throw new CommunityChatError("Message is too long", 400);

  const membership = await getActiveMembership(prisma, communityId, ownerId);
  if (!membership || membership.status !== "ACTIVE") {
    throw new CommunityChatError("Only active community members can send messages", 403);
  }

  const chat = await ensureCommunityChatUnlocked(communityId);
  if (!chat) {
    throw new CommunityChatError("Community chat opens after at least two active members join", 409);
  }
  if (chat.status !== "OPEN") {
    throw new CommunityChatError("Community chat is archived", 403);
  }

  const message = await prisma.communityChatMessage.create({
    data: {
      chatId: chat.id,
      communityId,
      fromOwnerId: ownerId,
      kind: "HUMAN",
      content: text,
    },
    include: {
      fromOwner: { select: { id: true, name: true, image: true } },
    },
  });

  await prisma.communityChatRead.upsert({
    where: { chatId_ownerId: { chatId: chat.id, ownerId } },
    create: { chatId: chat.id, communityId, ownerId, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });

  const recipients = await prisma.communityMember.findMany({
    where: {
      communityId,
      status: "ACTIVE",
      ownerId: { not: ownerId },
    },
    include: {
      owner: { include: { agent: true } },
    },
  });

  await Promise.all(
    recipients
      .map((member) => member.owner.agent)
      .filter((agent): agent is NonNullable<typeof agent> => !!agent)
      .map(async (agent) => {
        await createInboxEvent({
          ownerId: agent.ownerId,
          agentId: agent.id,
          type: "COMMUNITY_CHAT_MESSAGE",
          referenceId: chat.id,
          payload: {
            community_id: communityId,
            chat_id: chat.id,
            message_id: message.id,
            from_owner_id: ownerId,
            message_preview: text.length > 300 ? text.slice(0, 300) + "..." : text,
            created_at: message.createdAt.toISOString(),
          },
        });
        await signalAgentWork({
          agentId: agent.id,
          kind: "COMMUNITY_CHAT_MESSAGE",
          reason: "New community chat message",
          referenceId: chat.id,
          urgency: "normal",
        });
      })
  ).catch((error) => console.error("[community-chat] recipient notification failed:", error));

  return serializeMessage(message);
}

export async function postCommunityStrategyChatSummary(args: {
  communityId: string;
  sessionId: string;
  summary: string;
  status: string;
  actionProposals: number;
}) {
  const chat = await ensureCommunityChatUnlocked(args.communityId);
  if (!chat || chat.status !== "OPEN") return null;

  return prisma.communityChatMessage.create({
    data: {
      chatId: chat.id,
      communityId: args.communityId,
      kind: "STRATEGY_SUMMARY",
      content: args.summary,
      metadata: {
        session_id: args.sessionId,
        status: args.status,
        action_proposals: args.actionProposals,
      },
    },
  });
}
