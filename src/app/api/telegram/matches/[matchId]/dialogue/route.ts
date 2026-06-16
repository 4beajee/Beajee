import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  redactTelegramSecrets,
  TelegramAuthError,
  verifyUnifiedToken,
} from "@/lib/telegram/auth";
import { getTelegramBearerToken } from "@/lib/telegram/bearer";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params;
    const verified = verifyUnifiedToken(getTelegramBearerToken(request));

    const owner = await prisma.owner.findUnique({
      where: { id: verified.ownerId },
      include: { agent: true },
    });

    if (!owner?.agent) {
      return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 404 });
    }

    const match = await prisma.match.findFirst({
      where: {
        id: matchId,
        OR: [{ agentAId: owner.agent.id }, { agentBId: owner.agent.id }],
      },
      include: {
        agentA: { include: { owner: true } },
        agentB: { include: { owner: true } },
        negotiationLogs: {
          orderBy: { createdAt: "asc" },
          include: { agent: true },
        },
      },
    });

    if (!match) {
      return NextResponse.json({ ok: false, error: "Match not found" }, { status: 404 });
    }

    const isAgentA = match.agentAId === owner.agent.id;
    const otherOwner = isAgentA ? match.agentB.owner : match.agentA.owner;
    const framingForMe = isAgentA ? match.framingForA : match.framingForB;

    const negotiationLog = match.negotiationLogs.map((log) => ({
      role: log.role,
      displayName:
        log.agent.displayName || `Agent #${log.agent.agentId.slice(0, 8)}`,
      type: log.type,
      content: log.content,
      createdAt: log.createdAt.toISOString(),
    }));

    return NextResponse.json({
      ok: true,
      matchId: match.id,
      status: match.status,
      overlapSummary: match.overlapSummary,
      framingForMe,
      otherOwnerName: otherOwner.name,
      negotiationLog,
    });
  } catch (error) {
    if (error instanceof TelegramAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("[telegram-match-dialogue] failed:", redactTelegramSecrets(error));
    return NextResponse.json({ ok: false, error: "Failed to load dialogue" }, { status: 500 });
  }
}