import {
  PLATFORM_LABELS,
  isOpenClawPlatform,
  type AgentPlatformValue,
} from "@/lib/agent-platform";

export interface ReconnectionGuide {
  platform: AgentPlatformValue;
  platformLabel: string;
  pasteTarget: string;
  setupNotes: string[];
  verificationSteps: string[];
  deliveryNote: string;
  documentationUrl: string | null;
}

const DOCUMENTATION_URLS: Partial<Record<AgentPlatformValue, string>> = {
  open_claw: "https://docs.openclaw.ai/cli/mcp",
  hermes: "https://hermes-agent.nousresearch.com/docs/guides/use-mcp-with-hermes",
  nemo_claw: "https://docs.openclaw.ai/cli/mcp",
  zero_claw: "https://docs.openclaw.ai/cli/mcp",
  nano_claw: "https://docs.openclaw.ai/cli/mcp",
  codex: "https://developers.openai.com/codex/mcp",
  claude_code: "https://docs.anthropic.com/en/docs/claude-code/mcp",
  cursor: "https://cursor.com/docs/context/mcp",
  other_mcp: "https://modelcontextprotocol.io/docs",
};

export function getReconnectionGuide(platform: AgentPlatformValue): ReconnectionGuide {
  const platformLabel = PLATFORM_LABELS[platform];

  if (isOpenClawPlatform(platform)) {
    return {
      platform,
      platformLabel,
      pasteTarget: `Open a normal ${platformLabel} conversation and paste the setup prompt there.`,
      setupNotes: [
        "The agent installs the personalized instruction file and replaces any previous Beajee MCP credentials.",
        "It also installs the outbound Beajee bridge, so match events can reach the agent without a public webhook.",
      ],
      verificationSteps: [
        "Let the agent finish every setup step, including the bridge start.",
        "Confirm that the Beajee tools are listed and the wake stream reports connected.",
        "Ask the agent to run check_in once before leaving this page.",
      ],
      deliveryNote: `${platformLabel} can receive Beajee work through its native personal channel while its runtime and bridge are running.`,
      documentationUrl: DOCUMENTATION_URLS[platform] ?? null,
    };
  }

  const shared: Pick<ReconnectionGuide, "platform" | "platformLabel" | "documentationUrl"> = {
    platform,
    platformLabel,
    documentationUrl: DOCUMENTATION_URLS[platform] ?? null,
  };

  switch (platform) {
    case "hermes":
      return {
        ...shared,
        pasteTarget: "Open a Hermes chat and paste the setup prompt as one message.",
        setupNotes: [
          "Hermes adds Beajee to ~/.hermes/config.yaml and reloads MCP without exposing the credential in chat output.",
          "Keep the Hermes gateway running and let Hermes create the recurring check-in job for background delivery; an empty inbox must end with exactly [SILENT], so Hermes does not send a cron response.",
        ],
        verificationSteps: [
          "Run hermes mcp test beajee or ask Hermes to verify the server.",
          "Confirm that Beajee tools are available after /reload-mcp or a Hermes restart.",
          "Ask Hermes to call check_in once and confirm that its recurring job is enabled.",
        ],
        deliveryNote: "Hermes can deliver Beajee events through its configured personal channel while the gateway and recurring job are running.",
      };
    case "codex":
      return {
        ...shared,
        pasteTarget: "Start a trusted Codex session and paste the setup prompt into that session.",
        setupNotes: [
          "Codex writes the Beajee MCP entry to its user or trusted-project configuration and installs BEAJEE.md.",
          "Codex is a session-based setup helper, not a persistent notification channel.",
        ],
        verificationSteps: [
          "Open /mcp and confirm that Beajee is connected and its tools are available.",
          "Ask Codex to call check_in once with your agent ID.",
          "Connect Telegram in Beajee if you want background match and context-question delivery.",
        ],
        deliveryNote: "Codex must not surface Beajee context questions inside coding sessions; Telegram is required for background delivery.",
      };
    case "claude_code":
      return {
        ...shared,
        pasteTarget: "Start a trusted Claude Code session and paste the setup prompt there.",
        setupNotes: [
          "Claude Code adds the remote Beajee MCP server and installs CLAUDE.md for the selected scope.",
          "The connection exists only while a Claude Code session is active; it is not a background personal-agent runtime.",
        ],
        verificationSteps: [
          "Open /mcp and confirm that Beajee appears as connected.",
          "Ask Claude Code to list the Beajee tools and call check_in once.",
          "Connect Telegram in Beajee for notifications and context questions outside the coding session.",
        ],
        deliveryNote: "Claude Code must never show Beajee context questions in a coding session; Telegram is the background delivery path.",
      };
    case "cursor":
      return {
        ...shared,
        pasteTarget: "Open Cursor Agent in the project where you want Beajee available and paste the setup prompt.",
        setupNotes: [
          "Cursor saves the Beajee remote MCP configuration at project or global scope and installs BEAJEE.md.",
          "Cursor is a session-based helper. It cannot promise persistent background delivery after the editor closes.",
        ],
        verificationSteps: [
          "Open Cursor Customize → MCP and confirm that Beajee is enabled.",
          "Ask Cursor to list the Beajee tools and call check_in once.",
          "Connect Telegram in Beajee for dependable background delivery.",
        ],
        deliveryNote: "Use Telegram for background notifications; Cursor only checks in while an agent session is active.",
      };
    case "manus":
    case "folk":
      return {
        ...shared,
        pasteTarget: `Open ${platformLabel} and paste the setup prompt into a new agent task.`,
        setupNotes: [
          `${platformLabel} must support a custom remote MCP server with an Authorization header.`,
          "The setup stops and reports the limitation if the current plan or runtime cannot support MCP or recurring work.",
        ],
        verificationSteps: [
          "Confirm that the Beajee MCP connection succeeds and its tools are visible.",
          "Ask the agent to call check_in once.",
          "Confirm a real recurring task and owner-delivery channel before treating the connection as persistent.",
        ],
        deliveryNote: `Background delivery depends on the capabilities enabled in your ${platformLabel} account. The setup must not simulate a successful persistent connection.`,
      };
    case "perplexity_personal_computer":
      return {
        ...shared,
        pasteTarget: "Open Perplexity Personal Computer on your Apple silicon Mac and paste the setup prompt into a task.",
        setupNotes: [
          "The agent first verifies that the installed build accepts custom remote MCP servers with authorization headers.",
          "It then installs BEAJEE.md and configures a background check-in workflow if the runtime supports it.",
        ],
        verificationSteps: [
          "Confirm that the Beajee tools are available in the current build.",
          "Ask the agent to call check_in once.",
          "Verify that the background workflow is scheduled; otherwise use Telegram for delivery.",
        ],
        deliveryNote: "Persistent delivery is available only when the installed Personal Computer build supports both remote MCP and background workflows.",
      };
    case "other_mcp":
      return {
        ...shared,
        pasteTarget: "Paste the setup prompt into the agent that will own your Beajee connection.",
        setupNotes: [
          "The agent must support a remote Streamable HTTP MCP server with a Bearer authorization header.",
          "It installs BEAJEE.md and must have a genuine owner-delivery channel before acknowledging inbox events.",
        ],
        verificationSteps: [
          "Confirm that check_in and publish_context appear in the connected tool list.",
          "Ask the agent to call check_in once.",
          "Verify its recurring check-in and owner-delivery behavior before leaving it unattended.",
        ],
        deliveryNote: "Reliability depends on the selected MCP client's background runtime. Inbox events must only be acknowledged after real owner delivery.",
      };
    default:
      return {
        ...shared,
        pasteTarget: `Open ${platformLabel} and paste the setup prompt into a new agent task.`,
        setupNotes: [
          "The agent replaces the previous Beajee credentials and installs its platform-specific instruction file.",
          "It configures the Beajee MCP server and the delivery path supported by this runtime.",
        ],
        verificationSteps: [
          "Confirm that the Beajee MCP server is connected.",
          "Confirm that the Beajee tools are visible.",
          "Ask the agent to call check_in once.",
        ],
        deliveryNote: "Keep the agent runtime active and verify its owner-delivery channel before relying on background notifications.",
      };
  }
}
