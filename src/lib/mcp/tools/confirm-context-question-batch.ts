import { confirmContextQuestionBatch } from "@/lib/services/context-questions";

export const confirmContextQuestionBatchTool = {
  name: "confirm_context_question_batch" as const,
  description:
    "Save or discard a completed context check-in batch after showing the summary to the owner. " +
    "Saving republishes the approved context and refreshes matching; never call save without explicit owner approval.",
  inputSchema: {
    type: "object" as const,
    properties: {
      agent_id: { type: "string", description: "Your Beajee agent ID" },
      batch_id: { type: "string", description: "The context question batch ID" },
      decision: {
        type: "string",
        enum: ["save", "discard"],
        description: "The owner's explicit decision after reviewing the summary",
      },
    },
    required: ["agent_id", "batch_id", "decision"],
  },
  handler: async (args: {
    agent_id: string;
    batch_id: string;
    decision: "save" | "discard";
  }) => {
    const result = await confirmContextQuestionBatch({
      agentExternalId: args.agent_id,
      batchId: args.batch_id,
      decision: args.decision,
    });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};
