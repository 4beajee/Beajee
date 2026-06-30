import { markDormant } from "@/lib/services/negotiation";
import { requireMcpActor, type McpActor } from "@/lib/mcp/actor";

export const markDormantTool = {
  name: "mark_dormant" as const,
  description:
    'Owner said "not now" — match moves to dormant status. No reminders, no re-proposals. ' +
    "Owner can return to dormant matches manually at any time.",
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
    const result = await markDormant(args.match_id, authenticated.ownerId);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};
