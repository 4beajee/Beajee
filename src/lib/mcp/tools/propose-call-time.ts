import { proposeCallTime } from "@/lib/services/match-call";
import { requireMcpActor, type McpActor } from "@/lib/mcp/actor";

export const proposeCallTimeTool = {
  name: "propose_call_time" as const,
  description:
    "Propose one or more call time slots to the other match participant. Use after find_call_slots " +
    "or when your owner suggests specific times. The other owner's agent receives a CALL_TIME_PROPOSED " +
    "inbox event and should ask their owner to confirm.",
  inputSchema: {
    type: "object" as const,
    properties: {
      match_id: {
        type: "string",
        description: "The matched introduction ID",
      },
      slots: {
        type: "array",
        description: "Time slots to propose (max 5)",
        items: {
          type: "object",
          properties: {
            start: { type: "string", description: "ISO 8601 start time" },
            end: { type: "string", description: "ISO 8601 end time" },
          },
          required: ["start", "end"],
        },
      },
    },
    required: ["match_id", "slots"],
  },
  handler: async (args: {
    match_id: string;
    slots: Array<{ start: string; end: string }>;
  }, actor?: McpActor) => {
    const authenticated = requireMcpActor(actor);
    const result = await proposeCallTime(args.match_id, authenticated.ownerId, args.slots);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};
