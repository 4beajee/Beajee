import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { TelegramAuthError, verifyUnifiedToken } from "@/lib/telegram/auth";
import { getMatchCallStatus, requestZoomCall, confirmCallTime } from "@/lib/services/match-call";

type Context = { params: Promise<{ matchId: string }> };

function bearer(request: NextRequest) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
}

async function participant(matchId: string, ownerId: string) {
  return prisma.match.findFirst({
    where: {
      id: matchId,
      status: "MATCHED",
      OR: [{ agentA: { ownerId } }, { agentB: { ownerId } }],
    },
    select: { id: true },
  });
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const auth = verifyUnifiedToken(bearer(request));
    const { matchId } = await context.params;
    if (!(await participant(matchId, auth.ownerId))) {
      return NextResponse.json({ ok: false, error: "Match not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, call: await getMatchCallStatus(matchId, auth.ownerId) });
  } catch (error) {
    if (error instanceof TelegramAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Failed to load call" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const auth = verifyUnifiedToken(bearer(request));
    const { matchId } = await context.params;
    if (!(await participant(matchId, auth.ownerId))) {
      return NextResponse.json({ ok: false, error: "Match not found" }, { status: 404 });
    }
    const body = await request.json() as { action?: unknown; proposalId?: unknown };
    if (body.action === "request_call") {
      return NextResponse.json({ ok: true, call: await requestZoomCall(matchId, auth.ownerId) });
    }
    if (body.action === "confirm_time" && typeof body.proposalId === "string") {
      return NextResponse.json({
        ok: true,
        call: await confirmCallTime(matchId, auth.ownerId, body.proposalId),
      });
    }
    return NextResponse.json({ ok: false, error: "Unknown call action" }, { status: 400 });
  } catch (error) {
    if (error instanceof TelegramAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Call action failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
