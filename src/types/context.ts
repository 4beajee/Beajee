import { z } from "zod";

export const NetworkingGoal = z.enum(["partnership", "collaboration", "mentor", "peer"]);
export type NetworkingGoal = z.infer<typeof NetworkingGoal>;

export const ContextSchema = z.object({
  // From USER.md — stable owner facts (all optional)
  owner_name: z.string().optional(),
  owner_location: z.string().optional(),
  owner_profession: z.string().optional(),
  owner_domain: z.string().optional(),
  owner_experience: z.string().optional(),
  owner_goals: z.string().optional(),

  // From AGENTS.md — agent role and specialization (all optional)
  agent_specialization: z.string().optional(),
  agent_domains: z.array(z.string()).optional(),
  agent_constraints: z.string().optional(),

  // From SOUL.md — collaboration style signals (all optional)
  collaboration_style: z.string().optional(),
  communication_style: z.string().optional(),

  // From MEMORY.md — current active context (required fields kept required)
  current_work: z.string().min(1, "current_work is required"),
  expertise: z.array(z.string()).min(1, "at least one expertise area required"),
  looking_for: z.string().min(1, "looking_for is required"),
  not_looking_for: z.string().optional(),
  recent_problems: z.string().optional(),
  recent_wins: z.string().optional(),
  location: z.string().optional(),
  networking_goal: NetworkingGoal,
});

export type ContextInput = z.infer<typeof ContextSchema>;
