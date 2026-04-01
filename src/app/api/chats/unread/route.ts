import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedOwner } from "@/lib/auth";

// GET /api/chats/unread — total unread message count across all chats
export async function GET() {
  const auth = await getAuthenticatedOwner();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = auth.ownerId;

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
      agentA: { select: { ownerId: true } },
      agentB: { select: { ownerId: true } },
      chat: { select: { id: true, lastReadByA: true, lastReadByB: true } },
    },
  });

  let total = 0;

  for (const match of matches) {
    if (!match.chat) continue;
    const isOwnerA = match.agentA.ownerId === ownerId;
    const lastReadAt = isOwnerA ? match.chat.lastReadByA : match.chat.lastReadByB;

    const where: Record<string, unknown> = {
      chatId: match.chat.id,
      fromOwner: { not: ownerId },
    };
    if (lastReadAt) {
      where.createdAt = { gt: lastReadAt };
    }

    total += await prisma.message.count({ where });
  }

  return NextResponse.json({ unread: total });
}
