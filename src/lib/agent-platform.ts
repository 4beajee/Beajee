export const AGENT_PLATFORM_OPTIONS = [
  "open_claw",
  "codex",
  "manus",
  "claude_desktop",
  "nemo_claw",
  "zero_claw",
  "nano_claw",
  "custom",
] as const;

export type AgentPlatformValue = (typeof AGENT_PLATFORM_OPTIONS)[number];

export const PLATFORM_LABELS: Record<AgentPlatformValue, string> = {
  open_claw: "OpenClaw",
  codex: "Codex",
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

export function isOpenClawPlatform(platform: string): boolean {
  return OPENCLAW_PLATFORM_SET.has(platform);
}
