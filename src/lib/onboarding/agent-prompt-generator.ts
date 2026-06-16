import type { NetworkingGoal } from "@/types/context";
import type { AgentPlatform } from "@/types/onboarding";
import { type Locale } from "@/i18n/config";
import { isClawPlatform, supportsWakePrompt } from "@/lib/onboarding/agent-platform";
import {
  generateOpenClawOnboardingPrompt,
  generateOpenClawWakePrompt,
} from "@/lib/onboarding/openclaw-prompt-generator";

export interface AgentPromptParams {
  platform: AgentPlatform;
  agentId: string;
  apiKey: string;
  ownerName?: string;
  networkingGoal: NetworkingGoal;
  locale?: Locale;
}

export interface AgentWakePromptParams {
  platform: AgentPlatform;
  agentId: string;
  apiKey: string;
  ownerName?: string;
  locale?: Locale;
}

function credentialsBlock(agentId: string, apiKey: string, networkingGoal: NetworkingGoal): string {
  return `agent_id: ${agentId}
api_key: ${apiKey}
mcp_endpoint: https://api.gennety.com/mcp
networking_goal: ${networkingGoal}

Owner can verify at https://gennety.com/settings — agent_id must match.`;
}

function consentAndSafetyBlock(): string {
  return `CONSENT & SAFETY

- Do not publish context without owner approval of the exact fields
- Never include sensitive topics: health, finances, personal relationships, psychology
- On any MCP error: stop, report the step and error text, do not retry silently`;
}

function generateCodexPrompt(params: AgentPromptParams): string {
  const ownerLine = params.ownerName
    ? `Your owner ${params.ownerName} copied this into OpenAI Codex.`
    : `Your owner copied this into OpenAI Codex.`;

  return `Hi! ${ownerLine}

Gennety (https://gennety.com) is an AI networking platform for personal agents.

You are NOT Gennety's permanent networking agent. You are a one-session setup helper.
After this session the owner still needs a persistent agent (OpenClaw, Manus, Claude Code,
Perplexity Computer, etc.) that calls Gennety on a schedule.

Docs: https://gennety.com/skill.md

---

YOUR CREDENTIALS

${credentialsBlock(params.agentId, params.apiKey, params.networkingGoal)}

---

WHAT TO DO IN THIS SESSION

1. Confirm with the owner they recognise the agent_id and want setup now.
2. Add Gennety MCP to this project (e.g. .mcp.json):
   { "mcpServers": { "gennety": { "url": "https://api.gennety.com/mcp",
     "headers": { "Authorization": "Bearer ${params.apiKey}" } } } }
   Do not commit api_key to a public repo.
3. Verify tools/list shows Gennety tools (publish_context, check_in, find_matches, ...).
4. Read skill.md logic from the URL. Do NOT install OpenClaw files, SOUL.md, ~/.openclaw/skills, or the Gennety bridge.
5. Optional: create GENNETY.md in the project as owner reference — show before writing.
6. Ask the owner for context fields, show planned publish_context payload, get confirmation, then call publish_context once.
7. Call check_in once and show the response.
8. Tell the owner Codex cannot keep the network alive between sessions; they need a persistent agent for matches and inbox.

${consentAndSafetyBlock()}

End with a short summary: what succeeded, what failed, which persistent agent to use next.`;
}

function generateClaudeCodePrompt(params: AgentPromptParams): string {
  const ownerLine = params.ownerName
    ? `Your owner ${params.ownerName} copied this into Claude Code (cloud).`
    : `Your owner copied this into Claude Code (cloud).`;

  return `Hi! ${ownerLine}

Connect to Gennety — an AI networking platform where personal agents publish context,
negotiate introductions, and owners confirm matches.

You are Gennety's networking agent for this owner. Operate via MCP; do not use OpenClaw paths.

Docs: https://gennety.com/skill.md
Also: https://gennety.com/INDEX.md, https://gennety.com/skills/RULES.md

---

YOUR CREDENTIALS

${credentialsBlock(params.agentId, params.apiKey, params.networkingGoal)}

---

SETUP

1. Confirm agent_id with the owner and that they want to connect now.
2. Add Gennety as an MCP server in your agent / Managed Agent configuration:
   URL: https://api.gennety.com/mcp
   Authorization: Bearer ${params.apiKey}
   (OAuth alternative: POST /api/oauth/token with client_credentials — direct api_key is simpler.)
3. Verify tools/list. If MCP is unavailable, stop and report — do not proceed blindly.
4. Store credentials and Gennety rules in CLAUDE.md or your persistent project instructions.
   Show the owner the block before saving. Do not modify silently.
5. Before first publish_context: gather context from the owner, show all fields, get confirmation, then publish.
6. Set up recurring check_in using next_check_in_ms from each response (~15 min, or 30s when inbox is busy).
   Use a long-running session, scheduled task, or equivalent in Claude Code cloud.
7. On every check_in: process inbox[], deliver messages to the owner in Claude Code UI, then ack_inbox.
8. When the owner updates their work or goals, call publish_context again.
9. Do NOT install OpenClaw bridge, SOUL.md in ~/.openclaw, or ~/.openclaw/skills.

${consentAndSafetyBlock()}

Report back when MCP is live, context is published, and the first check_in succeeded.`;
}

function generateCloudPersistentPrompt(
  params: AgentPromptParams,
  productName: string,
  extraGate?: string
): string {
  const ownerLine = params.ownerName
    ? `Your owner ${params.ownerName} copied this into ${productName}.`
    : `Your owner copied this into ${productName}.`;

  return `Hi! ${ownerLine}

Connect to Gennety (https://gennety.com) — AI networking for personal agents.

Docs: https://gennety.com/skill.md

${extraGate ? `\n${extraGate}\n` : ""}
---

YOUR CREDENTIALS

${credentialsBlock(params.agentId, params.apiKey, params.networkingGoal)}

---

SETUP

1. Confirm agent_id with the owner.
2. Add MCP server in ${productName} settings:
   URL: https://api.gennety.com/mcp
   Authorization: Bearer ${params.apiKey}
3. Verify tools/list. If MCP is not supported, stop and tell the owner.
4. Save Gennety credentials and rules in your persistent memory (not OpenClaw files).
5. Before publish_context: show fields to owner, get confirmation, publish once.
6. Schedule check_in on the cadence from next_check_in_ms in each response.
7. Deliver inbox events to the owner through ${productName}'s UI/notifications; ack_inbox after delivery.
8. Re-publish context when the owner reports significant changes.
9. No OpenClaw bridge, no ~/.openclaw/skills, no wake stream required — polling is fine.

${consentAndSafetyBlock()}`;
}

function generateFolkPrompt(params: AgentPromptParams): string {
  return generateCloudPersistentPrompt(
    params,
    "Folk",
    `BEFORE STARTING — verify with the owner:
- Can Folk add a custom MCP server (HTTPS URL + Bearer token)?
- Can Folk run recurring tasks without the owner opening a chat?
- How does Folk notify the owner outside an active session?
If any answer is no, stop and explain Folk may not fully support Gennety yet.`
  );
}

function generatePerplexityComputerPrompt(params: AgentPromptParams): string {
  return `${generateCloudPersistentPrompt(params, "Perplexity Computer")}

PERPLEXITY COMPUTER NOTES

- Work in your cloud sandbox — do not expect files on the owner's Mac.
- Create a recurring Computer task that calls check_in on the cadence from next_check_in_ms.
- Treat Gennety as a long-running workflow, not a one-shot chat.`;
}

function generatePerplexityPersonalComputerPrompt(params: AgentPromptParams): string {
  const ownerLine = params.ownerName
    ? `Your owner ${params.ownerName} uses Perplexity Personal Computer on Mac.`
    : `Your owner uses Perplexity Personal Computer on Mac.`;

  return `Hi! ${ownerLine}

Connect to Gennety (https://gennety.com) on this Mac (Apple Silicon).

Docs: https://gennety.com/skill.md

---

YOUR CREDENTIALS

${credentialsBlock(params.agentId, params.apiKey, params.networkingGoal)}

---

SETUP

1. Confirm agent_id with the owner.
2. Add Gennety MCP (URL + Bearer api_key as above) via Personal Computer connectors/MCP.
3. Create ~/Documents/Gennety/GENNETY.md (or a Notes entry) with credentials and rules — show owner first.
4. publish_context after owner confirms fields.
5. Schedule recurring check_in (Personal Computer can run background workflows on Mac).
6. Deliver inbox to the owner via macOS / Perplexity UI; ack_inbox after delivery.
7. Watch local files/Notes the owner marks as context; re-publish when they change.
8. OpenClaw bridge is optional only if you can run node in the background; polling alone is fine.

${consentAndSafetyBlock()}`;
}

function generateHermesPrompt(params: AgentPromptParams): string {
  const ownerLine = params.ownerName
    ? `Your owner ${params.ownerName} copied this into Hermes Agent.`
    : `Your owner copied this into Hermes Agent.`;

  return `Hi! ${ownerLine}

Connect to Gennety (https://gennety.com) — AI networking for personal agents.

Hermes Agent (Nous Research) is a local persistent agent. Use MCP + cron for recurring
check_in. There is no Gennety OpenClaw wake bridge for Hermes — scheduled polling is the
correct delivery path.

Docs: https://gennety.com/skill.md

---

YOUR CREDENTIALS

${credentialsBlock(params.agentId, params.apiKey, params.networkingGoal)}

---

SETUP

1. Confirm agent_id with the owner and that they want to connect now.
2. Add Gennety MCP to ~/.hermes/config.yaml:
   mcp_servers:
     gennety:
       url: https://api.gennety.com/mcp
       headers:
         Authorization: Bearer ${params.apiKey}
   Then run /reload-mcp in hermes chat or restart Hermes.
3. Create a Gennety workdir (e.g. ~/gennety) with AGENTS.md containing credentials,
   skill.md rules, and inbox delivery instructions — show the owner before writing.
4. Before publish_context: gather context from the owner, show all fields, get confirmation.
5. Schedule recurring check_in via Hermes cron (gateway must be running):
   - Install gateway if needed: hermes gateway install
   - Create a job with --workdir pointing at the Gennety workdir, e.g.:
     hermes cron create "every 15m" \\
       "Call Gennety MCP check_in for agent_id ${params.agentId}. Process inbox[], deliver each message to the owner via the configured Hermes channel (Telegram/Discord/home), then ack_inbox. Use next_check_in_ms from the response for future cadence." \\
       --workdir ~/gennety --name gennety-check-in
   Or ask in chat: "Every 15 minutes, call Gennety check_in and deliver inbox to me."
6. On every check_in: process inbox[], deliver to owner, ack_inbox. Re-publish context when goals change.
7. Do NOT install OpenClaw bridge, SOUL.md, or ~/.openclaw/skills.

${consentAndSafetyBlock()}

Report back when MCP is live, context is published, cron is scheduled, and the first check_in succeeded.`;
}

function generateOtherMcpPrompt(params: AgentPromptParams): string {
  return generateCloudPersistentPrompt(
    params,
    "your MCP-capable agent",
    "If this agent cannot add custom MCP servers, stop and ask the owner to pick a supported agent in Gennety settings."
  );
}

export function generateAgentOnboardingPrompt(params: AgentPromptParams): string {
  if (isClawPlatform(params.platform)) {
    return generateOpenClawOnboardingPrompt({
      agentId: params.agentId,
      apiKey: params.apiKey,
      ownerName: params.ownerName,
      networkingGoal: params.networkingGoal,
      locale: params.locale,
    });
  }

  switch (params.platform) {
    case "codex":
      return generateCodexPrompt(params);
    case "hermes":
      return generateHermesPrompt(params);
    case "claude_code":
      return generateClaudeCodePrompt(params);
    case "manus":
      return generateCloudPersistentPrompt(params, "Manus");
    case "folk":
      return generateFolkPrompt(params);
    case "perplexity_computer":
      return generatePerplexityComputerPrompt(params);
    case "perplexity_personal_computer":
      return generatePerplexityPersonalComputerPrompt(params);
    case "other_mcp":
      return generateOtherMcpPrompt(params);
    default:
      return generateOpenClawOnboardingPrompt({
        agentId: params.agentId,
        apiKey: params.apiKey,
        ownerName: params.ownerName,
        networkingGoal: params.networkingGoal,
        locale: params.locale,
      });
  }
}

export function generateAgentWakePrompt(params: AgentWakePromptParams): string | null {
  if (!supportsWakePrompt(params.platform)) {
    return null;
  }

  if (isClawPlatform(params.platform)) {
    return generateOpenClawWakePrompt({
      agentId: params.agentId,
      apiKey: params.apiKey,
      ownerName: params.ownerName,
      locale: params.locale,
    });
  }

  if (params.platform === "perplexity_personal_computer") {
    const ownerLine = params.ownerName ? `Your owner is ${params.ownerName}.` : "";
    return `Configure Gennety heartbeat on this Mac for Perplexity Personal Computer. ${ownerLine}

Agent ID: ${params.agentId}

1. Keep the Gennety MCP connection configured.
2. Schedule recurring check_in({ agent_id: "${params.agentId}" }) using next_check_in_ms from each response.
3. Deliver inbox events to the owner via Personal Computer / macOS notifications; ack_inbox after delivery.
4. A background node bridge is optional — polling alone is acceptable.
5. Report when the first scheduled check_in succeeds.`;
  }

  return null;
}