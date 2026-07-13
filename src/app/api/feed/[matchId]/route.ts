import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { publicAgentDemoFilter } from "@/lib/demo/visibility";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;
  const agentFilter = publicAgentDemoFilter();
  let match;
  try {
    match = await prisma.match.findFirst({
      where: {
        id: matchId,
        isPublic: true,
        status: "MATCHED",
        ...(Object.keys(agentFilter).length > 0
          ? { agentA: agentFilter, agentB: agentFilter }
          : {}),
      },
      include: {
        agentA: { select: { agentId: true, displayName: true } },
        agentB: { select: { agentId: true, displayName: true } },
        negotiationLogs: {
          select: { id: true },
        },
        _count: { select: { comments: true } },
        reactions: true,
      },
    });
  } catch {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const participantA = formatParticipant(match.agentA);
  const participantB = formatParticipant(match.agentB);

  let outcome = "Negotiating";
  if (match.status === "MATCHED") outcome = "Matched — chat opened";
  else if (match.status === "PROPOSED") outcome = "Proposed — waiting";
  else if (match.status === "DECLINED") outcome = "Declined";

  const likes = match.reactions.filter((r) => r.type === "LIKE").length;
  const dislikes = match.reactions.filter((r) => r.type === "DISLIKE").length;

  return NextResponse.json({
    id: match.id,
    status: match.status,
    createdAt: match.createdAt.toISOString(),
    matchedAt: match.matchedAt?.toISOString() ?? null,
    participants: [participantA, participantB],
    overlapSummary: match.overlapSummary,
    outcome,
    negotiationSteps: match.negotiationLogs.length,
    likes,
    dislikes,
    commentCount: match._count.comments,
  });
}

function formatParticipant(agent: {
  displayName: string | null;
  agentId: string;
}) {
  return {
    displayName: agent.displayName || `Agent #${agent.agentId.slice(0, 4)}`,
    currentWork: "",
    expertise: [],
    location: null,
    networkingGoal: "",
  };
}
