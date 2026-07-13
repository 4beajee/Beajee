import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { publicAgentDemoFilter } from "@/lib/demo/visibility";

/**
 * Public search deliberately searches only explicitly public matches. Beajee
 * is not a public directory of people or agents, and this route must never
 * read or expose an AgentContext.
 */
export async function GET(request: NextRequest) {
  const limited = await rateLimit(request, {
    maxRequests: 30,
    windowMs: 60_000,
    keyPrefix: "public-match-search",
  });
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const mode = searchParams.get("mode") ?? "search";
  const rawLimit = Number(searchParams.get("limit") ?? 20);
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 20, 20));

  if (query.length > 120) {
    return NextResponse.json({ results: [], error: "Search query is too long" }, { status: 400 });
  }
  if (!['search', 'trending'].includes(mode)) {
    return NextResponse.json(
      { results: [], error: "Public people and agent discovery are unavailable" },
      { status: 410 }
    );
  }

  try {
    return mode === "trending" || !query
      ? await handleTrending(limit)
      : await handleMatchSearch(query, limit);
  } catch (error) {
    console.error("[search] Error:", error);
    return NextResponse.json({ results: [], error: "Search failed" }, { status: 500 });
  }
}

const publicMatchInclude = {
  agentA: { select: { agentId: true, displayName: true } },
  agentB: { select: { agentId: true, displayName: true } },
  reactions: { select: { type: true } },
  _count: { select: { comments: true } },
} as const;

function publicMatchWhere() {
  const agentFilter = publicAgentDemoFilter();
  return {
    isPublic: true,
    status: "MATCHED" as const,
    ...(Object.keys(agentFilter).length > 0 ? { agentA: agentFilter, agentB: agentFilter } : {}),
  };
}

async function handleMatchSearch(query: string, limit: number) {
  const matches = await prisma.match.findMany({
    where: {
      ...publicMatchWhere(),
      overlapSummary: { contains: query, mode: "insensitive" },
    },
    take: limit,
    orderBy: { matchedAt: "desc" },
    include: publicMatchInclude,
  });

  return NextResponse.json({
    results: matches.map((match) => formatMatchResult(match, 100)),
    query,
    type: "matches",
  });
}

async function handleTrending(limit: number) {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const matches = await prisma.match.findMany({
    where: { ...publicMatchWhere(), matchedAt: { gte: since } },
    take: limit * 3,
    orderBy: { matchedAt: "desc" },
    include: publicMatchInclude,
  });

  return NextResponse.json({
    results: matches
      .sort((a, b) => {
        const engagement = (match: typeof a) =>
          match.reactions.filter((reaction) => reaction.type === "LIKE").length * 2 + match._count.comments;
        return engagement(b) - engagement(a);
      })
      .slice(0, limit)
      .map((match) => formatMatchResult(match, 0)),
    mode: "trending",
  });
}

function formatMatchResult(
  match: {
    id: string;
    status: string;
    createdAt: Date;
    matchedAt: Date | null;
    overlapSummary: string;
    agentA: { agentId: string; displayName: string | null };
    agentB: { agentId: string; displayName: string | null };
    reactions: Array<{ type: string }>;
    _count: { comments: number };
  },
  similarity: number
) {
  return {
    type: "match" as const,
    id: match.id,
    status: match.status,
    createdAt: match.createdAt.toISOString(),
    matchedAt: match.matchedAt?.toISOString() ?? null,
    overlapSummary: match.overlapSummary,
    participants: [formatParticipant(match.agentA), formatParticipant(match.agentB)],
    likes: match.reactions.filter((reaction) => reaction.type === "LIKE").length,
    commentCount: match._count.comments,
    similarity,
  };
}

function formatParticipant(agent: { agentId: string; displayName: string | null }) {
  return {
    displayName: agent.displayName || `Agent #${agent.agentId.slice(0, 4)}`,
    // Keep the current UI contract without exposing the private AgentContext.
    currentWork: "",
    expertise: [] as string[],
    location: null,
    networkingGoal: "",
  };
}
