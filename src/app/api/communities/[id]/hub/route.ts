import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertCommunityMember, CommunityPermissionError } from "@/lib/services/community-permissions";
import { CommunityBudgetError, getCommunityBudgetState } from "@/lib/services/community-budget";

function errorResponse(error: unknown) {
  if (error instanceof CommunityPermissionError || error instanceof CommunityBudgetError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[community:hub]", error);
  return NextResponse.json({ error: "Failed to load context hub" }, { status: 500 });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getAuthenticatedOwner();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await assertCommunityMember(auth.ownerId, id);
    const [community, channels, sources, documents, budget] = await Promise.all([
      prisma.community.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          slug: true,
          ssotEnabled: true,
          knowledgeSummary: true,
          strategyEnabled: true,
          strategyIntervalHours: true,
          strategyTokenLimit: true,
          monthlyTokenLimit: true,
          strategyUsdLimit: true,
          monthlyUsdLimit: true,
          lastStrategySessionAt: true,
          nextStrategySessionAt: true,
          judgeIterationLimit: true,
          _count: {
            select: {
              knowledgeSources: true,
              knowledgeDocuments: true,
              knowledgeChunks: true,
              channels: true,
              strategySessions: true,
            },
          },
        },
      }),
      prisma.communityChannel.findMany({
        where: { communityId: id },
        orderBy: { createdAt: "asc" },
      }),
      prisma.communityKnowledgeSource.findMany({
        where: { communityId: id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.communityKnowledgeDocument.findMany({
        where: {
          communityId: id,
          status: { not: "DELETED" },
          ...(membership.role === "MEMBER" ? { privacyLevel: { in: ["PUBLIC", "COMMUNITY"] } } : {}),
        },
        include: {
          source: { select: { id: true, name: true, type: true, status: true } },
          _count: { select: { chunks: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
      getCommunityBudgetState(id),
    ]);

    if (!community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }

    return NextResponse.json({
      community,
      budget,
      channels,
      sources,
      documents: documents.map((document) => ({
        id: document.id,
        sourceId: document.sourceId,
        source: document.source,
        title: document.title,
        url: document.url,
        summary: document.summary,
        distilledContent: membership.role === "MEMBER" ? null : document.distilledContent,
        tags: document.tags,
        privacyLevel: document.privacyLevel,
        status: document.status,
        chunks: document._count.chunks,
        metadata: document.metadata,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      })),
      viewer: {
        role: membership.role,
        canManage: ["OWNER", "ADMIN"].includes(membership.role),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
