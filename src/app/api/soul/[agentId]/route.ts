import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  AgentPlatform,
  PLATFORM_FILE_NAMES,
  PLATFORM_TEMPLATE_FILES,
} from "@/types/onboarding";
import { personalizeAgentInstructions } from "@/lib/onboarding/agent-instructions";
import fs from "fs";
import path from "path";
import { getAuthenticatedOwner } from "@/lib/auth";
import { authenticateAgent } from "@/lib/mcp/auth";

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

// GET /api/soul/[agentId] — serve personalized instruction file for any platform
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;

  const bearerToken = getBearerToken(request);
  const authenticatedAgent = bearerToken
    ? await authenticateAgent(bearerToken)
    : null;
  const authenticatedOwner = bearerToken
    ? null
    : await getAuthenticatedOwner();

  if (!authenticatedAgent && !authenticatedOwner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let agent;
  try {
    agent = await prisma.agent.findUnique({
      where: { agentId },
      include: { owner: true },
    });
  } catch {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const authorized =
    authenticatedAgent?.id === agent.id ||
    authenticatedOwner?.ownerId === agent.ownerId;

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Determine platform — fall back to open_claw
  const platform = AgentPlatform.catch("open_claw").parse(agent.owner.agentPlatform);
  const templateFile =
    PLATFORM_TEMPLATE_FILES[platform] ?? PLATFORM_TEMPLATE_FILES.open_claw;
  const fileName =
    PLATFORM_FILE_NAMES[platform] ?? PLATFORM_FILE_NAMES.open_claw;

  const templatePath = path.join(process.cwd(), "templates", templateFile);
  let templateContent: string;

  try {
    templateContent = fs.readFileSync(templatePath, "utf-8");
  } catch {
    return NextResponse.json(
      { error: `Template not found: ${templateFile}` },
      { status: 500 }
    );
  }

  const excludedTopics: string[] =
    (agent.owner.excludedTopics as string[]) ?? [];
  const personalized = personalizeAgentInstructions({
    template: templateContent,
    platform,
    agentId: agent.agentId,
    apiKey: "$BEAJEE_API_KEY",
    networkingGoal: agent.owner.networkingGoal,
    excludedTopics,
  });

  return new NextResponse(personalized, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store, private",
      "Referrer-Policy": "no-referrer",
    },
  });
}
