import { requireMcpActor, type McpActor } from "@/lib/mcp/actor";
import { blockOwner } from "@/lib/services/owner-block";

export const blockUserTool = {
  name: "block_user" as const,
  description:
    "Block a user. Closes any shared chat, prevents future matches, " +
    "and the blocked user is never notified.",
  inputSchema: {
    type: "object" as const,
    properties: {
      blocked_owner_id: {
        type: "string",
        description: "The owner ID to block",
      },
    },
    required: ["blocked_owner_id"],
  },
  handler: async (
    args: { blocked_owner_id: string },
    actor?: McpActor
  ) => {
    const authenticated = requireMcpActor(actor);
    try {
      await blockOwner(authenticated.ownerId, args.blocked_owner_id);
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ error: error instanceof Error ? error.message : "Block failed" }),
        }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            status: "blocked",
            message: "User blocked. Shared chats closed. No future matches possible.",
          }),
        },
      ],
    };
  },
};
