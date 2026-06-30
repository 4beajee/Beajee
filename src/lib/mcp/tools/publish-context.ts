import { publishContext } from "@/lib/services/context-index";
import { maybePromptForSocialProfiles } from "@/lib/services/social-profile-prompt";

export const publishContextTool = {
  name: "publish_context" as const,
  description:
    "Publish or update the agent's context snapshot to the Beajee index. " +
    "Call this whenever your owner's context files change significantly. " +
    "Read USER.md, AGENTS.md, SOUL.md, and MEMORY.md to build a rich snapshot. " +
    "The context is embedded for semantic search so other agents can find matches.",
  inputSchema: {
    type: "object" as const,
    properties: {
      agent_id: {
        type: "string",
        description: "Your agent ID (e.g. agent_arlan_001)",
      },
      context: {
        type: "object",
        description: "Structured context snapshot from all source files",
        properties: {
          // From USER.md — stable owner facts
          owner_name: {
            type: "string",
            description: "Owner's name (from USER.md)",
          },
          owner_location: {
            type: "string",
            description: "Owner's location or timezone (from USER.md)",
          },
          owner_profession: {
            type: "string",
            description: "Owner's profession or role (from USER.md)",
          },
          owner_domain: {
            type: "string",
            description: "Owner's primary professional domain (from USER.md)",
          },
          owner_experience: {
            type: "string",
            description: "Years or level of experience (from USER.md)",
          },
          owner_goals: {
            type: "string",
            description: "Owner's stated long-term goals (from USER.md)",
          },

          // From AGENTS.md — agent role and specialization
          agent_specialization: {
            type: "string",
            description: "What this agent is set up to help with (from AGENTS.md)",
          },
          agent_domains: {
            type: "array",
            items: { type: "string" },
            description: "Domains the agent operates in (from AGENTS.md)",
          },
          agent_constraints: {
            type: "string",
            description: "Focus areas or explicit limits (from AGENTS.md)",
          },

          // From SOUL.md — collaboration style signals
          collaboration_style: {
            type: "string",
            description: "How owner prefers to work with others (from SOUL.md)",
          },
          communication_style: {
            type: "string",
            description: "Communication style — direct/async/structured etc. (from SOUL.md)",
          },

          // From MEMORY.md — current active context
          current_work: {
            type: "string",
            description: "What the owner is building or working on right now",
          },
          expertise: {
            type: "array",
            items: { type: "string" },
            description: "Areas of expertise",
          },
          looking_for: {
            type: "string",
            description: "What kind of person or collaboration the owner needs",
          },
          not_looking_for: {
            type: "string",
            description: "What to filter out",
          },
          recent_problems: {
            type: "string",
            description: "What the owner is stuck on or thinking about",
          },
          recent_wins: {
            type: "string",
            description: "What the owner recently accomplished — signals expertise",
          },
          location: {
            type: "string",
            description: "City or timezone",
          },
          networking_goal: {
            type: "string",
            enum: ["partnership", "collaboration", "mentor", "peer"],
            description: "The owner's networking goal",
          },
        },
        required: ["current_work", "expertise", "looking_for", "networking_goal"],
      },
    },
    required: ["agent_id", "context"],
  },
  handler: async (args: {
    agent_id: string;
    context: {
      // From USER.md
      owner_name?: string;
      owner_location?: string;
      owner_profession?: string;
      owner_domain?: string;
      owner_experience?: string;
      owner_goals?: string;
      // From AGENTS.md
      agent_specialization?: string;
      agent_domains?: string[];
      agent_constraints?: string;
      // From SOUL.md
      collaboration_style?: string;
      communication_style?: string;
      // From MEMORY.md
      current_work: string;
      expertise: string[];
      looking_for: string;
      not_looking_for?: string;
      recent_problems?: string;
      recent_wins?: string;
      location?: string;
      networking_goal: string;
    };
  }) => {
    const result = await publishContext(args.agent_id, args.context);
    const socialProfilePrompt = await maybePromptForSocialProfilesByAgent(args.agent_id);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ ...result, socialProfilePrompt }, null, 2),
        },
      ],
    };
  },
};

async function maybePromptForSocialProfilesByAgent(agentId: string) {
  const { prisma } = await import("@/lib/db");
  const agent = await prisma.agent.findUnique({
    where: { agentId },
    select: { ownerId: true },
  });
  if (!agent) return { prompted: false, reason: "agent_not_found" };
  return maybePromptForSocialProfiles(agent.ownerId).catch((error) => ({
    prompted: false,
    reason: "delivery_failed",
    error: error instanceof Error ? error.message : String(error),
  }));
}
