import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getAuthenticatedOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { closeAgentWakeStreams } from "@/lib/services/agent-wake-stream";
import { AgentPlatform, PLATFORM_LABELS } from "@/types/onboarding";

const ChangeAgentPlatformSchema = z.object({
  agentPlatform: AgentPlatform,
});

export async function POST(request: NextRequest) {
  const rateLimited = await rateLimit(request, {
    maxRequests: 3,
    windowMs: 300_000,
    keyPrefix: "change-agent-platform",
  });
  if (rateLimited) return rateLimited;

  const auth = await getAuthenticatedOwner();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { agentPlatform } = ChangeAgentPlatformSchema.parse(await request.json());
    const current = await prisma.owner.findUnique({
      where: { id: auth.ownerId },
      include: { agent: true },
    });

    if (!current) {
      return NextResponse.json({ error: "Owner not found" }, { status: 404 });
    }
    if (!current.agent) {
      return NextResponse.json({ error: "No agent found" }, { status: 404 });
    }
    const agent = current.agent;
    if (current.agentPlatform === agentPlatform) {
      return NextResponse.json({
        agentPlatform,
        platformLabel: PLATFORM_LABELS[agentPlatform],
        changed: false,
      });
    }

    const previousPlatform = current.agentPlatform;

    const newApiKey = `gny_${crypto.randomBytes(32).toString("hex")}`;

    const changedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.owner.update({
        where: { id: current.id },
        data: { agentPlatform },
      });
      await tx.agent.update({
        where: { id: agent.id },
        data: {
          apiKey: newApiKey,
          credentialVersion: { increment: 1 },
          webhookUrl: null,
          webhookToken: null,
          wakeWebhookEnabled: false,
          wakeWebhookLastPingAt: null,
          wakeWebhookLastPingOk: null,
          wakeWebhookLastPingError: null,
          wakeStreamLastDisconnectedAt: changedAt,
          wakeStreamLastError: null,
        },
      });
      await tx.oAuthAccessToken.updateMany({
        where: { agentId: agent.id, revokedAt: null },
        data: { revokedAt: changedAt },
      });
      await tx.setupGrant.updateMany({
        where: { agentId: agent.id, usedAt: null },
        data: { usedAt: changedAt },
      });
    });

    closeAgentWakeStreams(agent.id, "platform_changed");

    return NextResponse.json({
      agentPlatform,
      platformLabel: PLATFORM_LABELS[agentPlatform],
      previousPlatform,
      agentId: agent.agentId,
      changed: true,
      credentialsRotated: true,
      reconnectPath: `/settings/reconnect/${agentPlatform}?from=${encodeURIComponent(previousPlatform ?? "")}`,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid platform" },
        { status: 400 }
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    console.error("[settings/agent-platform] Failed to change platform:", error);
    return NextResponse.json({ error: "Failed to change agent platform" }, { status: 500 });
  }
}
