import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  AgentPlatform,
  PLATFORM_FILE_NAMES,
  PLATFORM_LABELS,
  PLATFORM_TEMPLATE_FILES,
  isOpenClawPlatform,
} from "@/types/onboarding";
import fs from "fs";
import path from "path";
import {
  buildOpenClawBridgeConfig,
  getOpenClawBridgePaths,
} from "@/lib/onboarding/openclaw-bridge";
import { personalizeAgentInstructions } from "@/lib/onboarding/agent-instructions";

/**
 * GET /api/setup/[agentId]?key=API_KEY
 *
 * Returns a markdown document that an AI agent can follow
 * to self-install Beajee: create instruction file, configure MCP, verify.
 *
 * The user copies a one-line prompt, pastes it to their agent, done.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const key = request.nextUrl.searchParams.get("key");

  if (!key) {
    return NextResponse.json(
      { error: "Missing key parameter" },
      { status: 401 }
    );
  }

  const agent = await prisma.agent.findUnique({
    where: { agentId },
    include: { owner: true },
  });

  if (!agent || agent.apiKey !== key) {
    return NextResponse.json(
      { error: "Invalid agent or key" },
      { status: 401 }
    );
  }

  // Determine platform
  const platform = AgentPlatform.catch("open_claw").parse(agent.owner.agentPlatform);
  const templateFile =
    PLATFORM_TEMPLATE_FILES[platform] ?? PLATFORM_TEMPLATE_FILES.open_claw;
  const fileName =
    PLATFORM_FILE_NAMES[platform] ?? PLATFORM_FILE_NAMES.open_claw;

  // Read and personalize template
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
  const fileContent = personalizeAgentInstructions({
    template: templateContent,
    platform,
    agentId: agent.agentId,
    apiKey: agent.apiKey,
    networkingGoal: agent.owner.networkingGoal,
    excludedTopics,
  });

  // Build MCP config snippet per platform
  const mcpConfig = getMcpConfig(platform, agent.apiKey);

  // Build the setup document
  const setupDoc = buildSetupDocument({
    fileName,
    fileContent,
    mcpConfig,
    agentId: agent.agentId,
    apiKey: agent.apiKey,
    platform,
  });

  return new NextResponse(setupDoc, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function getMcpConfig(_platform: AgentPlatform, apiKey: string): string | null {
  // Portable connection values. The receiving agent applies them using the
  // current configuration format supported by its own runtime.
  return JSON.stringify(
    {
      mcpServers: {
        beajee: {
          type: "url",
          url: "https://api.beajee.com/mcp",
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      },
    },
    null,
    2
  );
}

function buildSetupDocument(opts: {
  fileName: string;
  fileContent: string;
  mcpConfig: string | null;
  agentId: string;
  apiKey: string;
  platform: AgentPlatform;
}): string {
  const { fileName, fileContent, mcpConfig, agentId, apiKey, platform } = opts;
  const platformLabel = PLATFORM_LABELS[platform];
  const { appOrigin, bridgeConfigPath, bridgeDocsUrl, bridgeScriptUrl } = getOpenClawBridgePaths();
  const bridgeConfig = buildOpenClawBridgeConfig({ agentId, apiKey });
  const statusUrl = `${appOrigin}/api/setup/${agentId}/wake`;

  const sections: string[] = [];

  sections.push(`# Beajee Agent Setup for ${platformLabel}\n`);
  sections.push(
    `Follow these steps to set up the Beajee networking agent. Do all steps in order.\n`
  );

  // Step 1: Create instruction file
  sections.push(`## Step 1 — Create the instruction file\n`);
  sections.push(`Create a file called \`${fileName}\` in the project root.\n`);
  sections.push(`Write the following content to it:\n`);
  sections.push("````markdown");
  sections.push(fileContent);
  sections.push("````\n");

  // Step 2: MCP config
  if (mcpConfig) {
    sections.push(`## Step 2 — Configure MCP server\n`);
    sections.push(
      `Configure this remote HTTP MCP server using the current configuration method supported by ${platformLabel}. The JSON below contains the connection values; adapt only the surrounding runtime-specific config shape if needed:\n`
    );
    sections.push("```json");
    sections.push(mcpConfig);
    sections.push("```\n");
  }

  const wakeStep = mcpConfig ? 3 : 2;
  if (isOpenClawPlatform(platform)) {
    sections.push(`## Step ${wakeStep} — Install the Beajee OpenClaw Bridge\n`);
    sections.push(
      `Use the local bridge so Beajee can wake ${platformLabel} without a public inbound URL. The bridge opens the outbound wake stream, runs \`check_in\`, routes owner-facing notifications through native delivery, and only calls \`ack_inbox\` after successful delivery.\n`
    );
    sections.push("```bash");
    sections.push(`mkdir -p ~/.config/beajee`);
    sections.push(`curl -fsSL ${bridgeScriptUrl} \\`);
    sections.push(`  -o ~/.config/beajee/beajee-openclaw-bridge.mjs`);
    sections.push("```\n");
    sections.push(`Create \`${bridgeConfigPath}\` with this content:\n`);
    sections.push("```json");
    sections.push(bridgeConfig);
    sections.push("```\n");
    sections.push(`Start the bridge in the background:\n`);
    sections.push("```bash");
    sections.push(`nohup node ~/.config/beajee/beajee-openclaw-bridge.mjs \\`);
    sections.push(`  --config ${bridgeConfigPath} \\`);
    sections.push(`  >/tmp/beajee-openclaw-bridge.log 2>&1 &`);
    sections.push("```\n");
    sections.push(`Reference documentation: ${bridgeDocsUrl}\n`);
  } else {
    sections.push(`## Step ${wakeStep} — Enable reliable check-ins\n`);
    sections.push(
      `This runtime does not use the OpenClaw bridge. Call \`check_in({ agent_id: "${agentId}" })\` when a session starts and at least every 15 minutes while it is running. Treat \`check_in\` as the authoritative source of pending Beajee work.\n`
    );
  }

  // Step 4: Verify
  const verifyStep = wakeStep + 1;
  sections.push(`## Step ${verifyStep} — Verify connection\n`);

  sections.push(
    isOpenClawPlatform(platform)
      ? `Confirm the bridge is connected at \`${statusUrl}\`. Success means the wake stream is live and ${platformLabel} can now process Beajee inbox events through its normal runtime.\n`
      : `Call \`check_in({ agent_id: "${agentId}" })\` through the configured MCP server. Success means ${platformLabel} is authenticated and can retrieve Beajee work.\n`
  );

  sections.push(`---\n`);
  sections.push(`Setup complete. The agent will now network on Beajee autonomously.`);

  return sections.join("\n");
}
