import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertCommunityManager, CommunityPermissionError } from "@/lib/services/community-permissions";

function errorResponse(error: unknown) {
  if (error instanceof CommunityPermissionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[community:strategy:sessions]", error);
  return NextResponse.json({ error: "Failed to load strategy sessions" }, { status: 500 });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getAuthenticatedOwner();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await assertCommunityManager(auth.ownerId, id);
    const sessions = await prisma.communityStrategySession.findMany({
      where: { communityId: id },
      include: {
        turns: {
          orderBy: [{ round: "asc" }, { createdAt: "asc" }],
        },
        actionProposals: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      sessions: sessions.map((session) => ({
        id: session.id,
        status: session.status,
        scheduledFor: session.scheduledFor,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        maxRounds: session.maxRounds,
        judgeIterationLimit: session.judgeIterationLimit,
        tokenLimit: session.tokenLimit,
        tokensUsed: session.tokensUsed,
        costUsd: session.costUsd,
        summary: session.summary,
        judgeVerdict: session.judgeVerdict,
        partnershipCandidates: session.partnershipCandidates,
        failureReason: session.failureReason,
        createdAt: session.createdAt,
        turns: session.turns.map((turn) => ({
          id: turn.id,
          role: turn.role,
          round: turn.round,
          agentId: turn.agentId,
          memberId: turn.memberId,
          output: turn.output,
          tokensInput: turn.tokensInput,
          tokensOutput: turn.tokensOutput,
          createdAt: turn.createdAt,
        })),
        actionProposals: session.actionProposals.map((proposal) => ({
          id: proposal.id,
          type: proposal.type,
          status: proposal.status,
          title: proposal.title,
          summary: proposal.summary,
          evidenceIds: proposal.evidenceIds,
          payload: proposal.payload,
          judgeConfidence: proposal.judgeConfidence,
          requiresRole: proposal.requiresRole,
          createdAt: proposal.createdAt,
        })),
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
