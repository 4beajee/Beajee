import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getAuthenticatedOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { assertCommunityManager, CommunityPermissionError } from "@/lib/services/community-permissions";
import {
  CommunityKnowledgeError,
  createCommunityKnowledgeSource,
  ingestCommunityKnowledgeDocument,
} from "@/lib/services/community-knowledge";

const ManualKnowledgeSchema = z.object({
  title: z.string().trim().min(1).max(300),
  rawContent: z.string().trim().min(1).max(20_000),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  privacyLevel: z.enum(["PUBLIC", "COMMUNITY", "ADMINS", "OWNER_ONLY"]).default("COMMUNITY"),
});

function errorResponse(error: unknown) {
  if (error instanceof CommunityPermissionError || error instanceof CommunityKnowledgeError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  console.error("[community:knowledge:manual]", error);
  return NextResponse.json({ error: "Failed to ingest manual context" }, { status: 500 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rateLimited = rateLimit(request, {
      maxRequests: 12,
      windowMs: 60_000,
      keyPrefix: "communities:knowledge:manual",
    });
    if (rateLimited) return rateLimited;

    const auth = await getAuthenticatedOwner();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await assertCommunityManager(auth.ownerId, id);
    const body = await request.json().catch(() => null);
    const input = ManualKnowledgeSchema.parse(body);

    let source = await prisma.communityKnowledgeSource.findFirst({
      where: {
        communityId: id,
        type: "MANUAL",
        name: "Manual hub context",
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (!source) {
      source = await createCommunityKnowledgeSource(
        id,
        {
          type: "MANUAL",
          name: "Manual hub context",
          config: { created_by: "community_hub_ui" },
        },
        auth.ownerId
      );
    }

    const result = await ingestCommunityKnowledgeDocument(
      id,
      {
        sourceId: source.id,
        title: input.title,
        rawContent: input.rawContent,
        tags: input.tags,
        privacyLevel: input.privacyLevel,
        metadata: { created_by: "community_hub_ui" },
      },
      { embed: !!process.env.OPENAI_API_KEY }
    );

    return NextResponse.json(result, { status: result.skipped ? 200 : 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
