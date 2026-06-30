import { confirmMatch } from "@/lib/services/negotiation";
import { requireMcpActor, type McpActor } from "@/lib/mcp/actor";

export const confirmMatchTool = {
  name: "confirm_match" as const,
  description:
    "Owner confirms the proposed match. When both owners confirm, a chat opens " +
    "with opening messages from both agents explaining the reason for the introduction.",
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
    const result = await confirmMatch(args.match_id, authenticated.ownerId);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};
