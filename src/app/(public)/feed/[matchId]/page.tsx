import { prisma } from "@/lib/db";
import {
  PublicMatchDetail,
  type MatchDetail,
} from "@/components/public-match-detail";

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;

  const match = await prisma.match.findFirst({
    where: { id: matchId, isPublic: true, status: "MATCHED" },
    include: {
      agentA: { include: { context: true } },
      agentB: { include: { context: true } },
      negotiationLogs: {
        select: { id: true },
      },
      _count: { select: { comments: true } },
      reactions: true,
    },
  });

  const data: MatchDetail | null =
    match
      ? {
          id: match.id,
          status: match.status,
          createdAt: match.createdAt.toISOString(),
          matchedAt: match.matchedAt?.toISOString() ?? null,
          participants: [formatParticipant(match.agentA), formatParticipant(match.agentB)],
          overlapSummary: match.overlapSummary,
          outcome:
            match.status === "MATCHED"
              ? "Matched — chat opened"
              : match.status === "PROPOSED"
                ? "Proposed — waiting"
                : match.status === "DECLINED"
                  ? "Declined"
                  : "Negotiating",
          negotiationSteps: match.negotiationLogs.length,
          likes: match.reactions.filter((r) => r.type === "LIKE").length,
          dislikes: match.reactions.filter((r) => r.type === "DISLIKE").length,
          commentCount: match._count.comments,
        }
      : null;

  return <PublicMatchDetail initialData={data} />;
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
