import { z } from "zod";

export const NetworkingGoal = z.enum(["partnership", "collaboration", "mentor", "peer"]);
export type NetworkingGoal = z.infer<typeof NetworkingGoal>;

export const CONTEXT_SHORT_TEXT_MAX = 500;
export const CONTEXT_LONG_TEXT_MAX = 4_000;
export const CONTEXT_LIST_MAX = 50;
export const CONTEXT_ITEM_MAX = 200;
export const CONTEXT_JSON_MAX = 32_000;

const shortText = z.string().trim().max(CONTEXT_SHORT_TEXT_MAX);
const longText = z.string().trim().max(CONTEXT_LONG_TEXT_MAX);
const stringList = z.array(z.string().trim().min(1).max(CONTEXT_ITEM_MAX)).max(CONTEXT_LIST_MAX);

export const ContextSchema = z.object({
  // From USER.md — stable owner facts (all optional)
  owner_name: shortText.optional(),
  owner_location: shortText.optional(),
  owner_profession: shortText.optional(),
  owner_domain: shortText.optional(),
  owner_experience: shortText.optional(),
  owner_goals: longText.optional(),

  // From AGENTS.md — agent role and specialization (all optional)
  agent_specialization: shortText.optional(),
  agent_domains: stringList.optional(),
  agent_constraints: longText.optional(),

  // From SOUL.md — collaboration style signals (all optional)
  collaboration_style: longText.optional(),
  communication_style: longText.optional(),

  // From MEMORY.md — current active context (required fields kept required)
  current_work: longText.min(1, "current_work is required"),
  expertise: stringList.min(1, "at least one expertise area required"),
  looking_for: longText.min(1, "looking_for is required"),
  not_looking_for: longText.optional(),
  recent_problems: longText.optional(),
  recent_wins: longText.optional(),
  location: shortText.optional(),
  networking_goal: NetworkingGoal,
}).refine((value) => JSON.stringify(value).length <= CONTEXT_JSON_MAX, {
  message: `context payload must not exceed ${CONTEXT_JSON_MAX} characters`,
});

export type ContextInput = z.infer<typeof ContextSchema>;
