import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedOwner } from "@/lib/auth";
import { getUnreadMessageCounts } from "@/lib/services/unread-messages";

// GET /api/chats — list all chats for authenticated owner
export async function GET() {
  const auth = await getAuthenticatedOwner();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = auth.ownerId;

  // Find all matches where this owner is involved and chat exists
  const matches = await prisma.match.findMany({
    where: {
      status: "MATCHED",
      chat: { isNot: null },
      OR: [
        { agentA: { ownerId } },
        { agentB: { ownerId } },
      ],
    },
    include: {
      agentA: { include: { owner: { select: { id: true, name: true } }, context: { select: { currentWork: true, ownerProfession: true } } } },
      agentB: { include: { owner: { select: { id: true, name: true } }, context: { select: { currentWork: true, ownerProfession: true } } } },
      chat: {
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          _count: { select: { messages: true } },
        },
      },
    },
    orderBy: { matchedAt: "desc" },
  });

  const unreadCounts = await getUnreadMessageCounts(
    ownerId,
    matches.flatMap((match) => (match.chat ? [match.chat.id] : []))
  );
  const chats = matches.map((match) => {
    const isOwnerA = match.agentA.owner.id === ownerId;
    const other = isOwnerA ? match.agentB : match.agentA;
    const chat = match.chat!;
    const lastMessage = chat.messages[0] ?? null;

    return {
      matchId: match.id,
      chatId: chat.id,
      chatStatus: chat.status,
      otherPerson: {
        id: other.owner.id,
        name: other.owner.name,
        currentWork: other.context?.currentWork ?? null,
        profession: other.context?.ownerProfession ?? null,
      },
      lastMessage: lastMessage
        ? {
            content: lastMessage.content,
            fromOwner: lastMessage.fromOwner,
            kind: lastMessage.kind,
            createdAt: lastMessage.createdAt,
          }
        : null,
      unreadCount: unreadCounts.get(chat.id) ?? 0,
      overlapSummary: match.overlapSummary,
    };
  });

  return NextResponse.json({ chats });
}
