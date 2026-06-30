import { confirmCallTime } from "@/lib/services/match-call";
import { requireMcpActor, type McpActor } from "@/lib/mcp/actor";

export const confirmCallTimeTool = {
  name: "confirm_call_time" as const,
  description:
    "Confirm a proposed call time on behalf of your owner. After confirmation, the proposer's " +
    "agent receives CALL_TIME_CONFIRMED. A Zoom link appears only after the provider confirms creation.",
  inputSchema: {
    type: "object" as const,
    properties: {
      match_id: {
        type: "string",
        description: "The matched introduction ID",
      },
      proposal_id: {
        type: "string",
        description: "The proposal ID from CALL_TIME_PROPOSED inbox event or get_call_status",
      },
    },
    required: ["match_id", "proposal_id"],
  },
  handler: async (args: { match_id: string; proposal_id: string }, actor?: McpActor) => {
    const authenticated = requireMcpActor(actor);
    const result = await confirmCallTime(args.match_id, authenticated.ownerId, args.proposal_id);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};
