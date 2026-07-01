import { getReputationBreakdown } from "@/lib/services/reputation";
import { requireMcpActor, type McpActor } from "@/lib/mcp/actor";

export const getReputationTool = {
  name: "get_reputation" as const,
  description:
    "Get your authenticated agent's reputation score and component breakdown. " +
    "Reputation reflects match acceptance rate, negotiation success, context freshness, and completed matches.",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
  handler: async (_args: Record<string, never>, actor?: McpActor) => {
    const authenticated = requireMcpActor(actor);
    const breakdown = await getReputationBreakdown(authenticated.externalAgentId);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(breakdown, null, 2),
        },
      ],
    };
  },
};
