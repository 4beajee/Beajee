import { prisma } from "@/lib/db";

export const reportChatTool = {
  name: "report_chat" as const,
  description: "Submit a report for a chat. Platform operator reviews manually.",
  inputSchema: {
    type: "object" as const,
    properties: {
      chat_id: {
        type: "string",
        description: "The chat ID to report",
      },
      reporter_id: {
        type: "string",
        description: "The owner ID submitting the report",
      },
      reason: {
        type: "string",
        description: "Reason for the report",
      },
    },
    required: ["chat_id", "reporter_id", "reason"],
  },
  handler: async (args: { chat_id: string; reporter_id: string; reason: string }) => {
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
      chat.match.agentA.owner.id === args.reporter_id ||
      chat.match.agentB.owner.id === args.reporter_id;

    if (!isParticipant) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "Not a participant in this chat" }) }],
        isError: true,
      };
    }

    const report = await prisma.report.create({
      data: {
        chatId: args.chat_id,
        reporterId: args.reporter_id,
        reason: args.reason,
      },
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            reportId: report.id,
            status: "submitted",
            message: "Report submitted for manual review",
          }),
        },
      ],
    };
  },
};
