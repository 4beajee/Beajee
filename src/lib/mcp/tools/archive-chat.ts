import { prisma } from "@/lib/db";
import { requireMcpActor, type McpActor } from "@/lib/mcp/actor";

export const archiveChatTool = {
  name: "archive_chat" as const,
  description: "Manually archive a chat. Archived chats are visible but accept no new messages.",
  inputSchema: {
    type: "object" as const,
    properties: {
      chat_id: {
        type: "string",
        description: "The chat ID to archive",
      },
    },
    required: ["chat_id"],
  },
  handler: async (args: { chat_id: string }, actor?: McpActor) => {
    const authenticated = requireMcpActor(actor);
    const chat = await prisma.chat.findUnique({
      where: { id: args.chat_id },
      include: {
        match: {
          include: {
            agentA: { include: { owner: true } },
            agentB: { include: { owner: true } },
          },
        },
      },
    });

    if (!chat) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "Chat not found" }) }],
        isError: true,
      };
    }

    const isParticipant =
      chat.match.agentA.owner.id === authenticated.ownerId ||
      chat.match.agentB.owner.id === authenticated.ownerId;

    if (!isParticipant) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "Not a participant" }) }],
        isError: true,
      };
    }

    if (chat.status !== "OPEN") {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: `Chat is already ${chat.status}` }),
          },
        ],
        isError: true,
      };
    }

    await prisma.chat.update({
      where: { id: args.chat_id },
      data: { status: "ARCHIVED" },
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            chatId: args.chat_id,
            status: "ARCHIVED",
            message: "Chat archived. Visible but no new messages accepted.",
          }),
        },
      ],
    };
  },
};
