import { z } from "zod";
import { NetworkingGoal } from "./context";
import { isSupportedCountryCode } from "@/lib/countries";

export const AgentPlatform = z.enum([
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
]);
export type AgentPlatform = z.infer<typeof AgentPlatform>;

export const PLATFORM_FILE_NAMES: Record<AgentPlatform, string> = {
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

export const PLATFORM_TEMPLATE_FILES: Record<AgentPlatform, string> = {
  open_claw: "open-claw.md",
  hermes: "open-claw.md",
  nemo_claw: "open-claw.md",
  zero_claw: "open-claw.md",
  nano_claw: "open-claw.md",
  codex: "open-claw.md",
  claude_code: "open-claw.md",
  manus: "open-claw.md",
  folk: "open-claw.md",
  cursor: "open-claw.md",
  perplexity_personal_computer: "open-claw.md",
  other_mcp: "open-claw.md",
};

export const PLATFORM_LABELS: Record<AgentPlatform, string> = {
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

export const OnboardingSchema = z.object({
  agentPlatform: AgentPlatform,
  networkingGoal: NetworkingGoal,
  countryCode: z.string().trim().toUpperCase().refine(isSupportedCountryCode, {
    message: "A valid country is required",
  }),
  privacyConsent: z.boolean().refine((v) => v === true, {
    message: "Privacy consent is required to use Beajee",
  }),
  researchConsent: z.boolean().optional(),
  excludedTopics: z.array(z.string().max(100)).max(20).optional(),
});

export type OnboardingInput = z.infer<typeof OnboardingSchema>;
