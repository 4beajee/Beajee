import type { AgentPlatform } from "@/types/onboarding";

export type AgentRuntimeClass =
  | "local_persistent"
  | "local_hybrid"
  | "cloud_persistent"
  | "setup_only";

export interface AgentPlatformFeatures {
  showOpenClawInstall: boolean;
  showWakeSetup: boolean;
  showSoulDownload: boolean;
  showBridgeSetup: boolean;
  expectedDeliveryMode: "stream" | "polling";
  isSetupHelperOnly: boolean;
  requiresMacSilicon?: boolean;
}

export interface AgentPlatformMeta {
  label: string;
  runtimeClass: AgentRuntimeClass;
  features: AgentPlatformFeatures;
  instructionFileName: string | null;
  connectHintKey: string;
}

const CLAW_FEATURES: AgentPlatformFeatures = {
  showOpenClawInstall: true,
  showWakeSetup: true,
  showSoulDownload: true,
  showBridgeSetup: true,
  expectedDeliveryMode: "stream",
  isSetupHelperOnly: false,
};

export const AGENT_PLATFORM_META: Record<AgentPlatform, AgentPlatformMeta> = {
  open_claw: {
    label: "OpenClaw",
    runtimeClass: "local_persistent",
    features: CLAW_FEATURES,
    instructionFileName: "SOUL.md",
    connectHintKey: "openClaw",
  },
  hermes: {
    label: "Hermes Agent",
    runtimeClass: "local_persistent",
    features: {
      showOpenClawInstall: false,
      showWakeSetup: false,
      showSoulDownload: false,
      showBridgeSetup: false,
      expectedDeliveryMode: "polling",
      isSetupHelperOnly: false,
    },
    instructionFileName: "AGENTS.md",
    connectHintKey: "hermes",
  },
  nemo_claw: {
    label: "Nemo Claw",
    runtimeClass: "local_persistent",
    features: CLAW_FEATURES,
    instructionFileName: "SOUL.md",
    connectHintKey: "openClaw",
  },
  zero_claw: {
    label: "Zero Claw",
    runtimeClass: "local_persistent",
    features: CLAW_FEATURES,
    instructionFileName: "SOUL.md",
    connectHintKey: "openClaw",
  },
  nano_claw: {
    label: "Nano-Claw",
    runtimeClass: "local_persistent",
    features: CLAW_FEATURES,
    instructionFileName: "SOUL.md",
    connectHintKey: "openClaw",
  },
  codex: {
    label: "OpenAI Codex",
    runtimeClass: "setup_only",
    features: {
      showOpenClawInstall: false,
      showWakeSetup: false,
      showSoulDownload: false,
      showBridgeSetup: false,
      expectedDeliveryMode: "polling",
      isSetupHelperOnly: true,
    },
    instructionFileName: null,
    connectHintKey: "codex",
  },
  claude_code: {
    label: "Claude Code",
    runtimeClass: "cloud_persistent",
    features: {
      showOpenClawInstall: false,
      showWakeSetup: false,
      showSoulDownload: false,
      showBridgeSetup: false,
      expectedDeliveryMode: "polling",
      isSetupHelperOnly: false,
    },
    instructionFileName: "CLAUDE.md",
    connectHintKey: "claudeCode",
  },
  manus: {
    label: "Manus",
    runtimeClass: "cloud_persistent",
    features: {
      showOpenClawInstall: false,
      showWakeSetup: false,
      showSoulDownload: false,
      showBridgeSetup: false,
      expectedDeliveryMode: "polling",
      isSetupHelperOnly: false,
    },
    instructionFileName: null,
    connectHintKey: "manus",
  },
  folk: {
    label: "Folk",
    runtimeClass: "cloud_persistent",
    features: {
      showOpenClawInstall: false,
      showWakeSetup: false,
      showSoulDownload: false,
      showBridgeSetup: false,
      expectedDeliveryMode: "polling",
      isSetupHelperOnly: false,
    },
    instructionFileName: null,
    connectHintKey: "folk",
  },
  cursor: {
    label: "Cursor",
    runtimeClass: "setup_only",
    features: {
      showOpenClawInstall: false,
      showWakeSetup: false,
      showSoulDownload: false,
      showBridgeSetup: false,
      expectedDeliveryMode: "polling",
      isSetupHelperOnly: true,
    },
    instructionFileName: null,
    connectHintKey: "cursor",
  },
  perplexity_personal_computer: {
    label: "Perplexity Personal Computer",
    runtimeClass: "local_hybrid",
    features: {
      showOpenClawInstall: false,
      showWakeSetup: true,
      showSoulDownload: false,
      showBridgeSetup: false,
      expectedDeliveryMode: "polling",
      isSetupHelperOnly: false,
      requiresMacSilicon: true,
    },
    instructionFileName: "BEAJEE.md",
    connectHintKey: "perplexityPersonal",
  },
  other_mcp: {
    label: "Other MCP agent",
    runtimeClass: "cloud_persistent",
    features: {
      showOpenClawInstall: false,
      showWakeSetup: false,
      showSoulDownload: false,
      showBridgeSetup: false,
      expectedDeliveryMode: "polling",
      isSetupHelperOnly: false,
    },
    instructionFileName: null,
    connectHintKey: "otherMcp",
  },
};

export const ONBOARDING_AGENT_PLATFORMS: AgentPlatform[] = [
  "open_claw",
  "hermes",
  "claude_code",
  "codex",
  "manus",
  "folk",
  "cursor",
  "perplexity_personal_computer",
  "other_mcp",
];

export function isClawPlatform(platform: AgentPlatform): boolean {
  return (
    platform === "open_claw" ||
    platform === "nemo_claw" ||
    platform === "zero_claw" ||
    platform === "nano_claw"
  );
}

export function getAgentPlatformMeta(platform: AgentPlatform): AgentPlatformMeta {
  return AGENT_PLATFORM_META[platform];
}

export function supportsWakePrompt(platform: AgentPlatform): boolean {
  return isClawPlatform(platform) || platform === "perplexity_personal_computer";
}