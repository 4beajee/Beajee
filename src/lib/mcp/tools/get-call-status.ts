import { prisma } from "@/lib/db";
import { getMatchCallStatus } from "@/lib/services/match-call";

export const getCallStatusTool = {
  name: "get_call_status" as const,
  description:
    "Get the current Zoom call scheduling state for a match — wants-call flags, pending proposals, " +
    "confirmed time, and generated Zoom link.",
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

    const result = await getMatchCallStatus(args.match_id, agent.ownerId);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};