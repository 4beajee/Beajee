import { prisma } from "@/lib/db";
import { SocialProfilePatchSchema } from "@/lib/social-profile";
import { setOwnerSocialProfiles } from "@/lib/services/owner-social-profile";

export const setSocialProfilesTool = {
  name: "set_social_profiles" as const,
  description:
    "Save or clear the owner's optional LinkedIn and Twitter/X profile links. " +
    "Use only URLs the owner supplied or explicitly confirmed. Never search for, infer, " +
    "or scrape a profile. Omit a provider to leave it unchanged; pass null to clear it.",
  inputSchema: {
    type: "object" as const,
    properties: {
      agent_id: {
        type: "string",
        description: "Your agent ID",
      },
      linkedin_url: {
        anyOf: [{ type: "string" }, { type: "null" }],
        description: "Personal LinkedIn URL, or null to clear it",
      },
      twitter_url: {
        anyOf: [{ type: "string" }, { type: "null" }],
        description: "Twitter/X profile URL, or null to clear it",
      },
    },
    required: ["agent_id"],
    anyOf: [{ required: ["linkedin_url"] }, { required: ["twitter_url"] }],
  },
  handler: async (args: {
    agent_id: string;
    linkedin_url?: string | null;
    twitter_url?: string | null;
  }) => {
    const patch = SocialProfilePatchSchema.parse({
      ...(args.linkedin_url !== undefined ? { linkedin: args.linkedin_url } : {}),
      ...(args.twitter_url !== undefined ? { twitter: args.twitter_url } : {}),
    });
    const agent = await prisma.agent.findUnique({
      where: { agentId: args.agent_id },
      select: { ownerId: true },
    });
    if (!agent) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "Agent not found" }) }],
        isError: true,
      };
    }

    const socialProfiles = await setOwnerSocialProfiles({
      ownerId: agent.ownerId,
      patch,
      source: "mcp",
    });
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ ok: true, social_profiles: socialProfiles }, null, 2),
        },
      ],
    };
  },
};
