import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";

// GET /api/soul/[agentId] — serve personalized SOUL.md for an agent
export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  const { agentId } = params;

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

  // Read the base SOUL.md template
  const soulPath = path.join(process.cwd(), "SOUL.md");
  let soulContent: string;

  try {
    soulContent = fs.readFileSync(soulPath, "utf-8");
  } catch {
    return NextResponse.json({ error: "SOUL.md template not found" }, { status: 500 });
  }

  // Build excluded topics block
  const excludedTopics: string[] = (agent.owner.excludedTopics as string[]) ?? [];
  const excludedBlock =
    excludedTopics.length > 0
      ? excludedTopics.map((t) => `- ${t}`).join("\n")
      : "None — owner chose to share all categories.";

  // Mask API key — the full key was already provided during onboarding
  const maskedKey = `${agent.apiKey.slice(0, 8)}${"*".repeat(12)}${agent.apiKey.slice(-4)}`;

  // Replace placeholders with agent-specific values
  const personalizedSoul = soulContent
    .replace("[agent_id]", agent.agentId)
    .replace("[api_key]", maskedKey)
    .replace(
      "[partnership | collaboration | mentor | peer]",
      agent.owner.networkingGoal ?? "collaboration"
    )
    .replace("[excluded_topics]", excludedBlock);

  return new NextResponse(personalizedSoul, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}
