import { markDismissed } from "@/lib/services/inbox";
import { requireMcpActor, type McpActor } from "@/lib/mcp/actor";

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
      event_ids: {
        type: "array",
        items: { type: "string" },
        description: "List of inbox event IDs to mark as delivered-to-owner",
        minItems: 1,
      },
    },
    required: ["event_ids"],
  },
  handler: async (args: { event_ids: string[] }, actor?: McpActor) => {
    const authenticated = requireMcpActor(actor);

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

    const result = await markDismissed(args.event_ids, authenticated.internalAgentId);

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
