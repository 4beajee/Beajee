import { confirmContextQuestionBatch } from "@/lib/services/context-questions";
import { requireMcpActor, type McpActor } from "@/lib/mcp/actor";

export const confirmContextQuestionBatchTool = {
  name: "confirm_context_question_batch" as const,
  description:
    "Save or discard a completed context check-in batch after showing the summary to the owner. " +
    "Saving republishes the approved context and refreshes matching; never call save without explicit owner approval.",
  inputSchema: {
    type: "object" as const,
    properties: {
      batch_id: { type: "string", description: "The context question batch ID" },
      decision: {
        type: "string",
        enum: ["save", "discard"],
        description: "The owner's explicit decision after reviewing the summary",
      },
    },
    required: ["batch_id", "decision"],
  },
  handler: async (args: {
    batch_id: string;
    decision: "save" | "discard";
  }, actor?: McpActor) => {
    const authenticated = requireMcpActor(actor);
    const result = await confirmContextQuestionBatch({
      agentExternalId: authenticated.externalAgentId,
      batchId: args.batch_id,
      decision: args.decision,
    });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};
