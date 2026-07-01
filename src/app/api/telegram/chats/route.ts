import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { getUnreadMessageCounts } from "@/lib/services/unread-messages";
import { blockOwner } from "@/lib/services/owner-block";
import { SendMessageSchema } from "@/types/chat-input";
import { rateLimit } from "@/lib/rate-limit";
import { createInboxEvent } from "@/lib/services/inbox";
import { signalAgentWork } from "@/lib/services/agent-delivery";
import { TelegramAuthError, verifyUnifiedToken } from "@/lib/telegram/auth";
import { sendTelegramChatNotification } from "@/lib/telegram/match-card";

function bearer(request: NextRequest) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
}

async function loadMatch(matchId: string, ownerId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      agentA: { include: { owner: true, context: true } },
      agentB: { include: { owner: true, context: true } },
      chat: { include: { messages: { orderBy: { createdAt: "asc" } } } },
    },
  });
  if (!match || match.status !== "MATCHED" || !match.chat) return null;
  const isOwnerA = match.agentA.owner.id === ownerId;
  const isOwnerB = match.agentB.owner.id === ownerId;
  if (!isOwnerA && !isOwnerB) return null;
  return { match, isOwnerA };
}

export async function GET(request: NextRequest) {
  try {
    const auth = verifyUnifiedToken(bearer(request));
    const matchId = request.nextUrl.searchParams.get("matchId");
    if (matchId) {
      const loaded = await loadMatch(matchId, auth.ownerId);
      if (!loaded) return NextResponse.json({ ok: false, error: "Chat not available" }, { status: 404 });
      const { match, isOwnerA } = loaded;
      await prisma.chat.update({
        where: { id: match.chat!.id },
        data: isOwnerA ? { lastReadByA: new Date() } : { lastReadByB: new Date() },
      });
      const other = isOwnerA ? match.agentB : match.agentA;
      return NextResponse.json({
        ok: true,
        chat: {
          chatId: match.chat!.id,
          matchId: match.id,
          status: match.chat!.status,
          overlapSummary: match.overlapSummary,
          otherPerson: {
            id: other.owner.id,
            name: other.owner.name,
            image: other.owner.image,
            currentWork: other.context?.currentWork ?? null,
          },
          messages: match.chat!.messages.map((message) => ({
            id: message.id,
            fromOwner: message.fromOwner,
            kind: message.kind,
            content: message.content,
            createdAt: message.createdAt,
          })),
        },
      });
    }

    const matches = await prisma.match.findMany({
      where: {
        status: "MATCHED",
        chat: { isNot: null },
        OR: [{ agentA: { ownerId: auth.ownerId } }, { agentB: { ownerId: auth.ownerId } }],
      },
      include: {
        agentA: { include: { owner: true, context: true } },
        agentB: { include: { owner: true, context: true } },
        chat: { include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } } },
      },
      orderBy: { matchedAt: "desc" },
    });

    const unreadCounts = await getUnreadMessageCounts(
      auth.ownerId,
      matches.flatMap((match) => (match.chat ? [match.chat.id] : []))
    );
    const chats = matches.map((match) => {
      const isOwnerA = match.agentA.owner.id === auth.ownerId;
      const other = isOwnerA ? match.agentB : match.agentA;
      const chat = match.chat!;
      return {
        matchId: match.id,
        chatId: chat.id,
        status: chat.status,
        overlapSummary: match.overlapSummary,
        otherPerson: {
          id: other.owner.id,
          name: other.owner.name,
          image: other.owner.image,
          currentWork: other.context?.currentWork ?? null,
          profession: other.context?.ownerProfession ?? null,
        },
        lastMessage: chat.messages[0] ? {
          content: chat.messages[0].content,
          fromOwner: chat.messages[0].fromOwner,
          createdAt: chat.messages[0].createdAt,
        } : null,
        unreadCount: unreadCounts.get(chat.id) ?? 0,
      };
    });
    return NextResponse.json({ ok: true, chats });
  } catch (error) {
    if (error instanceof TelegramAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Failed to load chats" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { maxRequests: 30, windowMs: 60_000, keyPrefix: "telegram-chat" });
  if (limited) return limited;
  try {
    const auth = verifyUnifiedToken(bearer(request));
    const body = await request.json();
    if (body && typeof body === "object" && typeof body.action === "string") {
      const matchId = typeof body.matchId === "string" ? body.matchId : "";
      const loaded = await loadMatch(matchId, auth.ownerId);
      if (!loaded) return NextResponse.json({ ok: false, error: "Chat not available" }, { status: 404 });
      const { match, isOwnerA } = loaded;
      if (body.action === "archive") {
        await prisma.chat.update({ where: { id: match.chat!.id }, data: { status: "ARCHIVED" } });
        return NextResponse.json({ ok: true, status: "ARCHIVED" });
      }
      if (body.action === "block") {
        const blockedOwner = isOwnerA ? match.agentB.owner : match.agentA.owner;
        await blockOwner(auth.ownerId, blockedOwner.id);
        return NextResponse.json({ ok: true, status: "BLOCKED" });
      }
      if (body.action === "report") {
        const reason = typeof body.reason === "string" ? body.reason.trim() : "";
        if (reason.length < 12 || reason.length > 2000) {
          return NextResponse.json({ ok: false, error: "Please describe the issue in 12–2000 characters" }, { status: 400 });
        }
        const report = await prisma.report.create({
          data: { chatId: match.chat!.id, reporterId: auth.ownerId, reason },
        });
        return NextResponse.json({ ok: true, reportId: report.id, status: "submitted" });
      }
      return NextResponse.json({ ok: false, error: "Unknown chat action" }, { status: 400 });
    }
    const input = SendMessageSchema.parse(body);
    const loaded = await loadMatch(input.matchId, auth.ownerId);
    if (!loaded) return NextResponse.json({ ok: false, error: "Chat not available" }, { status: 404 });
    const { match, isOwnerA } = loaded;
    if (match.chat!.status !== "OPEN") {
      return NextResponse.json({ ok: false, error: "This chat is no longer open" }, { status: 403 });
    }
    const message = await prisma.message.create({
      data: { chatId: match.chat!.id, fromOwner: auth.ownerId, kind: "HUMAN", content: input.content },
    });
    await prisma.chat.update({
      where: { id: match.chat!.id },
      data: isOwnerA ? { lastReadByA: new Date() } : { lastReadByB: new Date() },
    });

    const recipientOwner = isOwnerA ? match.agentB.owner : match.agentA.owner;
    const recipientAgentId = isOwnerA ? match.agentBId : match.agentAId;
    const senderOwner = isOwnerA ? match.agentA.owner : match.agentB.owner;
    await createInboxEvent({
      ownerId: recipientOwner.id,
      agentId: recipientAgentId,
      type: "NEW_MESSAGE",
      referenceId: match.chat!.id,
      payload: {
        match_id: match.id,
        chat_id: match.chat!.id,
        message_id: message.id,
        from_owner_id: senderOwner.id,
        from_owner_name: senderOwner.name,
        message_preview: input.content.slice(0, 300),
        created_at: message.createdAt.toISOString(),
      },
    });
    signalAgentWork({
      agentId: recipientAgentId,
      kind: "NEW_MESSAGE",
      reason: "New chat message",
      referenceId: match.chat!.id,
      urgency: "high",
    }).catch(() => undefined);
    sendTelegramChatNotification({
      ownerId: recipientOwner.id,
      matchId: match.id,
      senderName: senderOwner.name,
      preview: input.content,
    }).catch(() => undefined);

    return NextResponse.json({
      ok: true,
      message: {
        id: message.id,
        fromOwner: message.fromOwner,
        kind: message.kind,
        content: message.content,
        createdAt: message.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof TelegramAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: error.issues[0]?.message ?? "Invalid message" }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Failed to send message" }, { status: 500 });
  }
}
