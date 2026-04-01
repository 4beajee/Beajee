import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  PLATFORM_FILE_NAMES,
  PLATFORM_TEMPLATE_FILES,
  type AgentPlatform,
} from "@/types/onboarding";
import fs from "fs";
import path from "path";

// GET /api/soul/[agentId] — serve personalized instruction file for any platform
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;

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

  // Determine platform — fall back to open_claw
  const platform = (agent.owner.agentPlatform ?? "open_claw") as AgentPlatform;
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

  // Build excluded topics block
  const excludedTopics: string[] =
    (agent.owner.excludedTopics as string[]) ?? [];
  const excludedBlock =
    excludedTopics.length > 0
      ? excludedTopics.map((t) => `- ${t}`).join("\n")
      : "None — owner chose to share all categories.";

  // Replace placeholders with agent-specific values
  const personalized = templateContent
    .replace(/\[agent_id\]/g, agent.agentId)
    .replace(/\[api_key\]/g, agent.apiKey)
    .replace(
      /\[networking_goal\]/g,
      agent.owner.networkingGoal ?? "collaboration"
    )
    .replace(
      /\[partnership \| collaboration \| mentor \| peer\]/g,
      agent.owner.networkingGoal ?? "collaboration"
    )
    .replace(/\[excluded_topics\]/g, excludedBlock);

  return new NextResponse(personalized, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
