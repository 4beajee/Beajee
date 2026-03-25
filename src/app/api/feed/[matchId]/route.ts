import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { matchId: string } }
) {
  let match;
  try {
    match = await prisma.match.findUnique({
      where: { id: params.matchId },
      include: {
        agentA: { include: { context: true } },
        agentB: { include: { context: true } },
        negotiationLogs: {
          orderBy: { createdAt: "asc" },
          include: { agent: true },
        },
      },
    });
  } catch {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  if (!match || !match.isPublic) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const participantA = formatParticipant(match.agentA);
  const participantB = formatParticipant(match.agentB);

  let outcome = "Negotiating";
  if (match.status === "MATCHED") outcome = "Matched — chat opened";
  else if (match.status === "PROPOSED") outcome = "Proposed — waiting";
  else if (match.status === "DECLINED") outcome = "Declined";

  const negotiationLog = match.negotiationLogs.map((log) => ({
    role: log.role as "initiator" | "responder",
    displayName:
      log.agent.displayName || `Agent #${log.agent.agentId.slice(0, 4)}`,
    type: log.type,
    content: log.content,
    createdAt: log.createdAt.toISOString(),
  }));

  return NextResponse.json({
    id: match.id,
    status: match.status,
    createdAt: match.createdAt.toISOString(),
    matchedAt: match.matchedAt?.toISOString() ?? null,
    participants: [participantA, participantB],
    overlapSummary: match.overlapSummary,
    outcome,
    negotiationSteps: negotiationLog.length,
    negotiationLog,
  });
}

function formatParticipant(agent: {
  displayName?: string | null;
  agentId: string;
  context?: {
    currentWork: string;
    expertise: string[];
    location: string | null;
    networkingGoal: string;
  } | null;
}) {
  return {
    displayName: agent.displayName || `Agent #${agent.agentId.slice(0, 4)}`,
    currentWork: agent.context?.currentWork ?? "",
    expertise: agent.context?.expertise ?? [],
    location: agent.context?.location ?? null,
    networkingGoal: agent.context?.networkingGoal ?? "",
  };
}
