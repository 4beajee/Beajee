import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma, withDbRetry } from "@/lib/db";
import { getAuthenticatedOwner } from "@/lib/auth";
import { safeErrorResponse } from "@/lib/api-error";
import { rateLimit } from "@/lib/rate-limit";
import {
  AgentPlatform,
  PLATFORM_FILE_NAMES,
  PLATFORM_LABELS,
  type AgentPlatform as AgentPlatformValue,
} from "@/types/onboarding";
import { buildSetupPrompt, getConnectionInstructions } from "@/lib/onboarding/connection-instructions";
import { resolveLocale } from "@/i18n/config";
import { createSetupGrant } from "@/lib/setup-grants";

export async function GET(request: NextRequest) {
  try {
    const rateLimited = await rateLimit(request, {
      maxRequests: 10,
      windowMs: 60_000,
      keyPrefix: "settings-agent-setup-prompt",
    });
    if (rateLimited) return rateLimited;

    const auth = await getAuthenticatedOwner();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const locale = resolveLocale({
      cookie: request.headers.get("cookie"),
      acceptLanguage: request.headers.get("accept-language"),
    });

    const { owner, agent } = await withDbRetry(async () => {
      const o = await prisma.owner.findUnique({ where: { id: auth.ownerId } });
      if (!o) throw new Error("Owner not found");

      let a = await prisma.agent.findUnique({ where: { ownerId: o.id } });
      if (!a) {
        const nameSlug = (o.name ?? o.email.split("@")[0])
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "");
        a = await prisma.agent.create({
          data: {
            agentId: `agent_${nameSlug}_${Date.now().toString(36)}`,
            ownerId: o.id,
            apiKey: `gny_${crypto.randomBytes(32).toString("hex")}`,
            isActive: true,
            agentType: "OPENCLAW",
            integrationMethod: "MCP",
          },
        });
      }

      return { owner: o, agent: a };
    });

    const platform = AgentPlatform.catch("open_claw").parse(owner.agentPlatform);
    const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
    const host = request.headers.get("host");
    const baseUrl = host
      ? `${proto}://${host}`
      : process.env.NEXTAUTH_URL ?? "https://beajee.com";
    const setupGrant = await createSetupGrant(agent.id);
    const prompt = buildSetupPrompt(
      agent.agentId,
      setupGrant,
      baseUrl,
      locale,
      PLATFORM_LABELS[platform]
    );
    const connectionInstructions = getConnectionInstructions(
      agent.agentId,
      agent.apiKey,
      platform as AgentPlatformValue,
      locale
    );

    return NextResponse.json({
      prompt,
      agent_id: agent.agentId,
      platform,
      platformLabel: PLATFORM_LABELS[platform],
      fileName: PLATFORM_FILE_NAMES[platform],
      soulMdEndpoint: `/api/soul/${agent.agentId}`,
      setupUrl: `${baseUrl.replace(/\/$/, "")}/api/setup/${agent.agentId}`,
      connectionInstructions,
    });
  } catch (error) {
    return safeErrorResponse(error, "Failed to load setup prompt");
  }
}
