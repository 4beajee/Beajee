import { findCallSlotsForMatch } from "@/lib/services/match-call";
import { requireMcpActor, type McpActor } from "@/lib/mcp/actor";

export const findCallSlotsTool = {
  name: "find_call_slots" as const,
  description:
    "Find overlapping free calendar slots for both match participants. Requires CALENDAR personal " +
    "connectors (Google Calendar, ICS, or OpenCal) on one or both sides. Returns up to 5 mutual " +
    "30-minute slots in the next 7 days during working hours.",
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
    try {
      const authenticated = requireMcpActor(actor);
      const result = await findCallSlotsForMatch(args.match_id, authenticated.externalAgentId);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  },
};
