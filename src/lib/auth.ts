import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth-options";

/**
 * Validate owner authentication from request headers.
 * Used for agent-to-platform API calls (MCP routes).
 * Headers: x-owner-id, x-api-key
 */
export async function validateOwnerAuth(
  request: NextRequest
): Promise<{ ownerId: string; agentId: string } | null> {
  const ownerId = request.headers.get("x-owner-id");
  const apiKey = request.headers.get("x-api-key");

  if (!ownerId || !apiKey) return null;

  try {
    const agent = await prisma.agent.findFirst({
      where: { ownerId, apiKey, isActive: true },
    });
    if (!agent) return null;
    return { ownerId, agentId: agent.agentId };
  } catch {
    return null;
  }
}

/**
 * Get authenticated owner from NextAuth session.
 * Used for human-facing API routes (matches, chat, onboarding).
 */
export async function getAuthenticatedOwner(): Promise<{ ownerId: string; email: string } | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return { ownerId: session.user.id, email: session.user.email };
}
