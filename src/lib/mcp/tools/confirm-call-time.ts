import { prisma } from "@/lib/db";
import { confirmCallTime } from "@/lib/services/match-call";

export const confirmCallTimeTool = {
  name: "confirm_call_time" as const,
  description:
    "Confirm a proposed call time on behalf of your owner. After confirmation, the proposer's " +
    "agent receives CALL_TIME_CONFIRMED. If both owners already want a call, a Zoom link is generated automatically.",
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
      proposal_id: {
        type: "string",
        description: "The proposal ID from CALL_TIME_PROPOSED inbox event or get_call_status",
      },
    },
    required: ["agent_id", "match_id", "proposal_id"],
  },
  handler: async (args: { agent_id: string; match_id: string; proposal_id: string }) => {
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

    const result = await confirmCallTime(args.match_id, agent.ownerId, args.proposal_id);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};