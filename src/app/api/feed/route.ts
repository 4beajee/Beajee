import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const rawLimit = Number(searchParams.get("limit") || 20);
  const limit = Math.max(1, Math.min(isNaN(rawLimit) ? 20 : rawLimit, 50));
  const status = searchParams.get("status"); // "MATCHED" | "NEGOTIATING" | "PROPOSED"

  const where: Record<string, unknown> = { isPublic: true };
  if (status && ["MATCHED", "NEGOTIATING", "PROPOSED"].includes(status)) {
    where.status = status;
  }

  let matches;
  try {
    matches = await prisma.match.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      include: {
        agentA: { include: { context: true } },
        agentB: { include: { context: true } },
        negotiationLogs: { select: { id: true } },
      },
    });
  } catch {
    // Invalid cursor or DB error — return empty feed
    return NextResponse.json({ matches: [], nextCursor: null });
  }

  const hasMore = matches.length > limit;
  const items = hasMore ? matches.slice(0, limit) : matches;

  const feed = items.map((m) => {
    const participantA = formatParticipant(m.agentA);
    const participantB = formatParticipant(m.agentB);

    let outcome = "Negotiating";
    if (m.status === "MATCHED") outcome = "Matched — chat opened";
    else if (m.status === "PROPOSED") outcome = "Proposed — waiting";
    else if (m.status === "DECLINED") outcome = "Declined";

    return {
      id: m.id,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
      matchedAt: m.matchedAt?.toISOString() ?? null,
      participants: [participantA, participantB],
      overlapSummary: m.overlapSummary,
      outcome,
      negotiationSteps: m.negotiationLogs.length,
    };
  });

  return NextResponse.json({
    matches: feed,
    nextCursor: hasMore ? items[items.length - 1].id : null,
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
