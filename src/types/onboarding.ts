import { z } from "zod";
import { NetworkingGoal } from "./context";
import { isSupportedCountryCode } from "@/lib/countries";
import { SchedulingUrlSchema } from "@/lib/scheduling-url";
import {
  AGENT_PLATFORM_OPTIONS,
} from "@/lib/agent-platform";

export {
  AGENT_PLATFORM_OPTIONS,
  PLATFORM_LABELS,
  isOpenClawPlatform,
  supportsNativeContextQuestions,
} from "@/lib/agent-platform";

export const AgentPlatform = z.enum(AGENT_PLATFORM_OPTIONS);
export type AgentPlatform = z.infer<typeof AgentPlatform>;

export const PLATFORM_FILE_NAMES: Record<AgentPlatform, string> = {
  open_claw: "SOUL.md",
  hermes: "SOUL.md",
  fork: "SOUL.md",
  codex: "SOUL.md",
  claude_code: "CLAUDE.md",
  manus: "SOUL.md",
  claude_desktop: "SOUL.md",
  nemo_claw: "SOUL.md",
  zero_claw: "SOUL.md",
  nano_claw: "SOUL.md",
  custom: "SOUL.md",
};

export const PLATFORM_TEMPLATE_FILES: Record<AgentPlatform, string> = {
  open_claw: "open-claw.md",
  hermes: "open-claw.md",
  fork: "open-claw.md",
  codex: "open-claw.md",
  claude_code: "open-claw.md",
  manus: "open-claw.md",
  claude_desktop: "open-claw.md",
  nemo_claw: "open-claw.md",
  zero_claw: "open-claw.md",
  nano_claw: "open-claw.md",
  custom: "open-claw.md",
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
  schedulingUrl: z.union([z.literal(""), SchedulingUrlSchema]).optional(),
});

export type OnboardingInput = z.infer<typeof OnboardingSchema>;
