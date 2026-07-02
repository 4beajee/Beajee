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
import { consumeSetupGrant } from "@/lib/setup-grants";

/**
 * GET /api/setup/[agentId] with Authorization: Bearer <one-use setup grant>
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
  const authorization = request.headers.get("authorization") ?? "";
  const grant = authorization.match(/^Bearer\s+(setup_[A-Za-z0-9]+)$/)?.[1] ?? null;

  if (!grant) {
    return NextResponse.json(
      { error: "Missing setup grant" },
      { status: 401 }
    );
  }

  const agent = await prisma.agent.findUnique({
    where: { agentId },
    include: { owner: true },
  });

  if (!agent || !(await consumeSetupGrant(grant, agent.id))) {
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
    apiKey: "$BEAJEE_API_KEY",
    networkingGoal: agent.owner.networkingGoal,
    excludedTopics,
  });

  // Build MCP config snippet per platform
  const mcpSetup = getMcpSetup(platform, agent.apiKey);

  // Build the setup document
  const setupDoc = buildSetupDocument({
    fileName,
    fileContent,
    mcpSetup,
    agentId: agent.agentId,
    apiKey: agent.apiKey,
    platform,
  });

  return new NextResponse(setupDoc, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "no-store, private",
      "Referrer-Policy": "no-referrer",
    },
  });
}

interface McpSetup {
  language: "json" | "toml" | "yaml";
  config: string;
  instructions: string;
  verification: string;
  documentationUrl: string;
}

function getMcpSetup(platform: AgentPlatform, apiKey: string): McpSetup {
  const endpoint = "https://api.beajee.com/mcp";

  if (isOpenClawPlatform(platform)) {
    return {
      language: "json",
      config: JSON.stringify({
        url: endpoint,
        transport: "streamable-http",
        headers: { Authorization: `Bearer ${apiKey}` },
      }, null, 2),
      instructions: "Run `openclaw mcp set beajee '<JSON below>'`, keeping the JSON as one shell argument.",
      verification: "Run `openclaw mcp doctor beajee --probe` and confirm that Beajee tools are listed.",
      documentationUrl: "https://docs.openclaw.ai/cli/mcp",
    };
  }

  if (platform === "hermes") {
    return {
      language: "yaml",
      config: [
        "mcp_servers:",
        "  beajee:",
        `    url: \"${endpoint}\"`,
        "    headers:",
        `      Authorization: \"Bearer ${apiKey}\"`,
      ].join("\n"),
      instructions: "Add this entry to `~/.hermes/config.yaml`, then run `/reload-mcp` or restart Hermes.",
      verification: "Run `hermes mcp test beajee`, then confirm that Beajee tools are available.",
      documentationUrl: "https://hermes-agent.nousresearch.com/docs/guides/use-mcp-with-hermes",
    };
  }

  if (platform === "codex") {
    return {
      language: "toml",
      config: [
        "[mcp_servers.beajee]",
        `url = \"${endpoint}\"`,
        `http_headers = { Authorization = \"Bearer ${apiKey}\" }`,
      ].join("\n"),
      instructions: "Add this block to `~/.codex/config.toml` or a trusted project's `.codex/config.toml`.",
      verification: "Open Codex and run `/mcp`; confirm that the Beajee server and tools are available.",
      documentationUrl: "https://developers.openai.com/codex/mcp",
    };
  }

  if (platform === "cursor") {
    return {
      language: "json",
      config: JSON.stringify({
        mcpServers: {
          beajee: {
            url: endpoint,
            headers: { Authorization: `Bearer ${apiKey}` },
          },
        },
      }, null, 2),
      instructions: "Save this as `.cursor/mcp.json` in the project or merge it into `~/.cursor/mcp.json` for global use.",
      verification: "Open Cursor Customize → MCP and confirm that Beajee is enabled and its tools are listed.",
      documentationUrl: "https://cursor.com/docs/context/mcp",
    };
  }

  const config = JSON.stringify({
    mcpServers: {
      beajee: {
        type: "http",
        url: endpoint,
        headers: { Authorization: `Bearer ${apiKey}` },
      },
    },
  }, null, 2);

  const documentationUrl = platform === "claude_code"
    ? "https://docs.anthropic.com/en/docs/claude-code/mcp"
    : "https://modelcontextprotocol.io/docs";

  return {
    language: "json",
    config,
    instructions: `Add Beajee as a custom remote Streamable HTTP MCP server in ${PLATFORM_LABELS[platform]}. Use the values below if its UI asks for URL and headers separately.`,
    verification: "Confirm that the MCP connection succeeds and that `check_in` and `publish_context` are available before saving any persistent instructions.",
    documentationUrl,
  };
}

function buildSetupDocument(opts: {
  fileName: string;
  fileContent: string;
  mcpSetup: McpSetup;
  agentId: string;
  apiKey: string;
  platform: AgentPlatform;
}): string {
  const { fileName, fileContent, mcpSetup, agentId, apiKey, platform } = opts;
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

  // Step 2: platform-specific MCP config
  sections.push(`## Step 2 — Configure MCP server\n`);
  sections.push(`${mcpSetup.instructions}\n`);
  sections.push(`Official platform documentation: ${mcpSetup.documentationUrl}\n`);
  sections.push(`\`\`\`${mcpSetup.language}`);
  sections.push(mcpSetup.config);
  sections.push("```\n");

  const wakeStep = 3;
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
    if (platform === "hermes") {
      sections.push(`Use Hermes cron with its gateway running. Create a recurring job that calls \`check_in({ agent_id: "${agentId}" })\`, delivers every inbox event through the owner's configured Hermes channel, and calls \`ack_inbox\` only after delivery. Follow \`next_check_in_ms\` from each response.\n`);
    } else if (platform === "codex" || platform === "cursor") {
      sections.push(`This is a session-based setup helper. Call \`check_in({ agent_id: "${agentId}" })\` at session start and publish context only with owner approval. Tell the owner to connect Telegram in Beajee for background match and context-question delivery; do not claim this coding session stays alive.\n`);
    } else if (platform === "claude_code") {
      sections.push(`Call \`check_in({ agent_id: "${agentId}" })\` at session start and while the session is active. Beajee context questions must be delivered through linked Telegram, never inside the coding session.\n`);
    } else if (platform === "manus" || platform === "folk") {
      sections.push(`Before proceeding, verify that ${platformLabel} supports both custom remote MCP servers with Bearer headers and recurring/background tasks. If either capability is unavailable, stop and tell the owner that this platform cannot run Beajee persistently; do not simulate a successful integration.\n`);
    } else if (platform === "perplexity_personal_computer") {
      sections.push(`Verify that this is Perplexity Personal Computer on an Apple silicon Mac and that its current build accepts custom remote MCP servers. Schedule \`check_in({ agent_id: "${agentId}" })\` in its background workflow; if either capability is absent, stop and report it.\n`);
    } else {
      sections.push(`Call \`check_in({ agent_id: "${agentId}" })\` when the agent starts and on the cadence returned in \`next_check_in_ms\`. The agent must have a real owner-delivery channel before it acknowledges inbox events.\n`);
    }
  }

  // Step 4: Verify
  const verifyStep = wakeStep + 1;
  sections.push(`## Step ${verifyStep} — Verify connection\n`);

  sections.push(
    isOpenClawPlatform(platform)
      ? `Confirm the bridge is connected at \`${statusUrl}\`. Success means the wake stream is live and ${platformLabel} can now process Beajee inbox events through its normal runtime.\n`
      : `${mcpSetup.verification}\nThen call \`check_in({ agent_id: "${agentId}" })\`. Success means ${platformLabel} is authenticated and can retrieve Beajee work.\n`
  );

  sections.push(`---\n`);
  sections.push(`Setup complete. The agent will now network on Beajee autonomously.`);

  return sections.join("\n");
}
