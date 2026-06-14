import { prisma } from "@/lib/db";
import { proposeCallTime } from "@/lib/services/match-call";

export const proposeCallTimeTool = {
  name: "propose_call_time" as const,
  description:
    "Propose one or more call time slots to the other match participant. Use after find_call_slots " +
    "or when your owner suggests specific times. The other owner's agent receives a CALL_TIME_PROPOSED " +
    "inbox event and should ask their owner to confirm.",
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
    required: ["agent_id", "match_id", "slots"],
  },
  handler: async (args: {
    agent_id: string;
    match_id: string;
    slots: Array<{ start: string; end: string }>;
  }) => {
    const agent = await prisma.agent.findUnique({
      where: { agentId: args.agent_id },
      select: { ownerId: true },
    });
    if (!agent) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: `Agent not found: ${args.agent_id}` }) }],
        isError: true,
      };
    }

    const result = await proposeCallTime(args.match_id, agent.ownerId, args.slots);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};