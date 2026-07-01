export const AGENT_PLATFORM_OPTIONS = [
  "open_claw",
  "hermes",
  "fork",
  "codex",
  "claude_code",
  "manus",
  "claude_desktop",
  "nemo_claw",
  "zero_claw",
  "nano_claw",
  "custom",
] as const;

export type AgentPlatformValue = (typeof AGENT_PLATFORM_OPTIONS)[number];

export const PRIMARY_AGENT_PLATFORMS = [
  "open_claw",
  "hermes",
  "fork",
  "codex",
  "claude_code",
  "manus",
] as const satisfies readonly AgentPlatformValue[];

export const PLATFORM_LABELS: Record<AgentPlatformValue, string> = {
  open_claw: "OpenClaw",
  hermes: "Hermes",
  fork: "Fork",
  codex: "Codex",
  claude_code: "Claude Code",
  manus: "Manus",
  claude_desktop: "Claude Desktop",
  nemo_claw: "Nemo Claw",
  zero_claw: "Zero Claw",
  nano_claw: "Nano-Claw",
  custom: "Custom MCP agent",
};

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
  "fork",
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
    "custom",
    "manus",
    "claude_desktop",
  ].includes(platform);
}
