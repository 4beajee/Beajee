import { getMatches } from "@/lib/services/negotiation";
import { requireMcpActor, type McpActor } from "@/lib/mcp/actor";

export const getMatchesTool = {
  name: "get_matches" as const,
  description:
    "Get all matches for an agent — active, proposed, matched, and dormant. " +
    "Returns the other agent's context, framing, and chat ID if matched.",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
  handler: async (_args: Record<string, never>, actor?: McpActor) => {
    const authenticated = requireMcpActor(actor);
    const result = await getMatches(authenticated.externalAgentId);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};
