import { getMatchCallStatus } from "@/lib/services/match-call";
import { requireMcpActor, type McpActor } from "@/lib/mcp/actor";

export const getCallStatusTool = {
  name: "get_call_status" as const,
  description:
    "Get the current Zoom call scheduling state for a match — wants-call flags, pending proposals, " +
    "confirmed time, and generated Zoom link.",
  inputSchema: {
    type: "object" as const,
    properties: {
      match_id: {
        type: "string",
        description: "The matched introduction ID",
      },
    },
    required: ["match_id"],
  },
  handler: async (args: { match_id: string }, actor?: McpActor) => {
    const authenticated = requireMcpActor(actor);
    const result = await getMatchCallStatus(args.match_id, authenticated.ownerId);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};
