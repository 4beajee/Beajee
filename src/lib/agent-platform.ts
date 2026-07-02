export const AGENT_PLATFORM_OPTIONS = [
  "open_claw",
  "hermes",
  "nemo_claw",
  "zero_claw",
  "nano_claw",
  "codex",
  "claude_code",
  "manus",
  "folk",
  "cursor",
  "perplexity_personal_computer",
  "other_mcp",
] as const;

export type AgentPlatformValue = (typeof AGENT_PLATFORM_OPTIONS)[number];

export const ONBOARDING_AGENT_PLATFORMS = [
  "open_claw",
  "hermes",
  "claude_code",
  "codex",
  "manus",
  "folk",
  "cursor",
  "perplexity_personal_computer",
  "other_mcp",
] as const satisfies readonly AgentPlatformValue[];

export const PRIMARY_AGENT_PLATFORMS = ONBOARDING_AGENT_PLATFORMS;

export const SETUP_HELPER_AGENT_PLATFORMS = new Set<AgentPlatformValue>([
  "codex",
  "cursor",
]);

export const MAC_ONLY_AGENT_PLATFORMS = new Set<AgentPlatformValue>([
  "perplexity_personal_computer",
]);

export const PLATFORM_LABELS: Record<AgentPlatformValue, string> = {
  open_claw: "OpenClaw",
  hermes: "Hermes Agent",
  nemo_claw: "Nemo Claw",
  zero_claw: "Zero Claw",
  nano_claw: "Nano-Claw",
  codex: "OpenAI Codex",
  claude_code: "Claude Code",
  manus: "Manus",
  folk: "Folk",
  cursor: "Cursor",
  perplexity_personal_computer: "Perplexity Personal Computer",
  other_mcp: "Other MCP agent",
};

export const PLATFORM_INSTRUCTION_FILE_NAMES: Record<AgentPlatformValue, string> = {
  open_claw: "SOUL.md",
  hermes: "AGENTS.md",
  nemo_claw: "SOUL.md",
  zero_claw: "SOUL.md",
  nano_claw: "SOUL.md",
  codex: "BEAJEE.md",
  claude_code: "CLAUDE.md",
  manus: "BEAJEE.md",
  folk: "BEAJEE.md",
  cursor: "BEAJEE.md",
  perplexity_personal_computer: "BEAJEE.md",
  other_mcp: "BEAJEE.md",
};

export function getAgentInstructionFileName(platform: string): string {
  return PLATFORM_INSTRUCTION_FILE_NAMES[platform as AgentPlatformValue] ?? "BEAJEE.md";
}

export function getAgentPlatformLabel(platform: string): string {
  return PLATFORM_LABELS[platform as AgentPlatformValue] ?? platform;
}

const OPENCLAW_PLATFORM_SET = new Set<string>([
  "open_claw",
  "nemo_claw",
  "zero_claw",
  "nano_claw",
]);

const NATIVE_CONTEXT_QUESTION_PLATFORM_SET = new Set<string>([
  ...OPENCLAW_PLATFORM_SET,
  "hermes",
]);

export function isOpenClawPlatform(platform: string): boolean {
  return OPENCLAW_PLATFORM_SET.has(platform);
}

export type ContextQuestionDeliveryMode =
  | "telegram"
  | "native_agent"
  | "telegram_required";

export function getContextQuestionDeliveryMode(
  platform: string | null | undefined,
  telegramConnected: boolean
): ContextQuestionDeliveryMode {
  if (telegramConnected) return "telegram";
  if (platform && NATIVE_CONTEXT_QUESTION_PLATFORM_SET.has(platform)) {
    return "native_agent";
  }
  return "telegram_required";
}

export function supportsNativeContextQuestions(platform: string | null | undefined): boolean {
  return !!platform && NATIVE_CONTEXT_QUESTION_PLATFORM_SET.has(platform);
}

export function supportsNativeProfilePrompts(platform: string | null | undefined): boolean {
  if (!platform || platform === "codex" || platform === "claude_code") return false;
  return NATIVE_CONTEXT_QUESTION_PLATFORM_SET.has(platform) || [
    "other_mcp",
    "manus",
    "folk",
    "perplexity_personal_computer",
  ].includes(platform);
}
