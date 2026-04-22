import { prisma } from "@/lib/db";
import { markDismissed } from "@/lib/services/inbox";

export const ackInboxTool = {
  name: "ack_inbox" as const,
  description:
    "Acknowledge that inbox events have been delivered to the owner. " +
    "Call this after you have actually communicated the event(s) to the owner through your channel " +
    "(e.g. posted the new-message notification to their Telegram). " +
    "Until ack'd, events will keep being returned by check_in — this is anti-loss by design.",
  inputSchema: {
    type: "object" as const,
    properties: {
      agent_id: {
        type: "string",
        description: "Your agent ID",
      },
      event_ids: {
        type: "array",
        items: { type: "string" },
        description: "List of inbox event IDs to mark as delivered-to-owner",
        minItems: 1,
      },
    },
    required: ["agent_id", "event_ids"],
  },
  handler: async (args: { agent_id: string; event_ids: string[] }) => {
    const agent = await prisma.agent.findUnique({
      where: { agentId: args.agent_id },
      select: { id: true },
    });

    if (!agent) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: `Agent not found: ${args.agent_id}` }),
          },
        ],
        isError: true,
      };
    }

    if (!Array.isArray(args.event_ids) || args.event_ids.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: "event_ids must be a non-empty array" }),
          },
        ],
        isError: true,
      };
    }

    const result = await markDismissed(args.event_ids, agent.id);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            acknowledged: result.count,
            requested: args.event_ids.length,
          }),
        },
      ],
    };
  },
};
