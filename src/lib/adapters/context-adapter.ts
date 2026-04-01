// ─── Normalized output ─────────────────────────────────────────────
// This is what the adapter produces. Maps 1:1 to ContextSchema.
export interface NormalizedAgentContext {
  // USER.md equivalents
  owner_name?: string;
  owner_location?: string;
  owner_profession?: string;
  owner_domain?: string;
  owner_experience?: string;
  owner_goals?: string;
  // AGENTS.md equivalents
  agent_specialization?: string;
  agent_domains?: string[];
  agent_constraints?: string;
  // SOUL.md equivalents
  collaboration_style?: string;
  communication_style?: string;
  // MEMORY.md equivalents (required for publishing)
  current_work: string;
  expertise: string[];
  looking_for: string;
  not_looking_for?: string;
  recent_problems?: string;
  recent_wins?: string;
  location?: string;
  networking_goal: string;
}

// ─── OpenClaw context input ──────────────────────────────────────

export interface OpenClawContext {
  // From USER.md
  user_name?: string;
  user_location?: string;
  user_profession?: string;
  user_preferences?: string;
  // From AGENTS.md
  agent_role?: string;
  agent_rules?: string;
  // From SOUL.md
  agent_personality?: string;
  collaboration_style?: string;
  // From MEMORY.md (direct mapping)
  current_work: string;
  expertise: string[];
  looking_for: string;
  not_looking_for?: string;
  recent_problems?: string;
  recent_wins?: string;
  location?: string;
  networking_goal: string;
}

// ─── Main normalizer ───────────────────────────────────────────────

export async function normalizeContext(
  raw: OpenClawContext
): Promise<NormalizedAgentContext> {
  return normalizeOpenClawContext(raw);
}

// ─── OpenClaw adapter (richest context) ────────────────────────────

function normalizeOpenClawContext(raw: OpenClawContext): NormalizedAgentContext {
  return {
    owner_name: raw.user_name,
    owner_location: raw.user_location,
    owner_profession: raw.user_profession,
    agent_specialization: raw.agent_role,
    agent_constraints: raw.agent_rules,
    collaboration_style:
      raw.collaboration_style ?? raw.agent_personality,
    current_work: raw.current_work,
    expertise: raw.expertise,
    looking_for: raw.looking_for,
    not_looking_for: raw.not_looking_for,
    recent_problems: raw.recent_problems,
    recent_wins: raw.recent_wins,
    location: raw.location ?? raw.user_location,
    networking_goal: raw.networking_goal,
  };
}
