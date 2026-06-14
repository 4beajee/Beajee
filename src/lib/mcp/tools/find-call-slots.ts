import { findCallSlotsForMatch } from "@/lib/services/match-call";

export const findCallSlotsTool = {
  name: "find_call_slots" as const,
  description:
    "Find overlapping free calendar slots for both match participants. Requires CALENDAR personal " +
    "connectors (Google Calendar, ICS, or OpenCal) on one or both sides. Returns up to 5 mutual " +
    "30-minute slots in the next 7 days during working hours.",
  inputSchema: {
    type: "object" as const,
    properties: {
      agent_id: {
        type: "string",
        description: "Your agent ID",
      },
      match_id: {
        type: "string",
        description: "The matched introduction ID",
      },
    },
    required: ["agent_id", "match_id"],
  },
  handler: async (args: { agent_id: string; match_id: string }) => {
    try {
      const result = await findCallSlotsForMatch(args.match_id, args.agent_id);
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