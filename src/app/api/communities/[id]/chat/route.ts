import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getAuthenticatedOwner } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  CommunityChatError,
  getCommunityChat,
  sendCommunityChatMessage,
} from "@/lib/services/community-chat";

const SendCommunityMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

function errorResponse(error: unknown) {
  if (error instanceof CommunityChatError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  console.error("[community:chat]", error);
  return NextResponse.json({ error: "Failed to process community chat" }, { status: 500 });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getAuthenticatedOwner();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getCommunityChat(auth.ownerId, id);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rateLimited = rateLimit(request, {
      maxRequests: 30,
      windowMs: 60_000,
      keyPrefix: "communities:chat",
    });
    if (rateLimited) return rateLimited;

    const auth = await getAuthenticatedOwner();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => null);
    const input = SendCommunityMessageSchema.parse(body);
    const message = await sendCommunityChatMessage(auth.ownerId, id, input.content);
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
