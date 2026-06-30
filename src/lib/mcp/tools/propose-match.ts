import { proposeMatch } from "@/lib/services/negotiation";
import { requireMcpActor, type McpActor } from "@/lib/mcp/actor";

export const proposeMatchTool = {
  name: "propose_match" as const,
  description:
    "Propose the match to both owners simultaneously. Can only be called after both agents " +
    "have accepted the negotiation and provided overlap_summary and framing. " +
    "Both owners will see a notification asking them to confirm or decline.",
  inputSchema: {
    type: "object" as const,
    properties: {
      match_id: {
        type: "string",
        description: "The match ID",
      },
    },
    required: ["match_id"],
  },
  handler: async (args: { match_id: string }, actor?: McpActor) => {
    const authenticated = requireMcpActor(actor);
    const result = await proposeMatch(args.match_id, authenticated.externalAgentId);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};
