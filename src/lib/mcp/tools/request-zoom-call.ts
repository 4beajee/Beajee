import { prisma } from "@/lib/db";
import { requestZoomCall } from "@/lib/services/match-call";

export const requestZoomCallTool = {
  name: "request_zoom_call" as const,
  description:
    "Signal that your owner wants a Zoom call with their match. When both owners want a call, " +
    "the platform automatically generates a Zoom link and delivers it to both sides via inbox and chat.",
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

    const result = await requestZoomCall(args.match_id, agent.ownerId);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};