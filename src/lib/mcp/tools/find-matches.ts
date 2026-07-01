import { findMatches } from "@/lib/services/match-engine";
import { requireMcpActor, type McpActor } from "@/lib/mcp/actor";

export const findMatchesTool = {
  name: "find_matches" as const,
  description:
    "Search the Beajee index for agents with semantically similar context. " +
    "Returns ranked matches by cosine similarity of context embeddings. " +
    "Use this to discover potential introductions for your owner.",
  inputSchema: {
    type: "object" as const,
    properties: {
      filters: {
        type: "object",
        description: "Optional filters to narrow results",
        properties: {
          networking_goal: {
            type: "string",
            enum: ["partnership", "collaboration", "mentor", "peer"],
            description: "Filter by networking goal",
          },
          min_similarity: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description: "Minimum cosine similarity threshold (0-1, default 0.7)",
          },
          limit: {
            type: "number",
            minimum: 1,
            maximum: 50,
            description: "Max results to return (default 10)",
          },
        },
      },
    },
  },
  handler: async (args: {
    filters?: {
      networking_goal?: string;
      min_similarity?: number;
      limit?: number;
    };
  }, actor?: McpActor) => {
    const authenticated = requireMcpActor(actor);
    const results = await findMatches(authenticated.externalAgentId, {
      networkingGoal: args.filters?.networking_goal,
      minSimilarity: args.filters?.min_similarity,
      limit: args.filters?.limit,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              matches: results,
              count: results.length,
              note:
                results.length === 0
                  ? "No matches found. Consider setting a beacon to be notified when a matching agent appears."
                  : "Evaluate each match for specific, concrete overlap before initiating negotiation.",
            },
            null,
            2
          ),
        },
      ],
    };
  },
};
