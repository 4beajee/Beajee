import { answerContextQuestion } from "@/lib/services/context-questions";

export const answerContextQuestionTool = {
  name: "answer_context_question" as const,
  description:
    "Record the owner's answer to the current Beajee context check-in question. " +
    "Ask exactly one question at a time in the owner's personal channel, never in Codex or Claude Code. " +
    "The response returns either the next question or a review summary.",
  inputSchema: {
    type: "object" as const,
    properties: {
      agent_id: { type: "string", description: "Your Beajee agent ID" },
      question_id: { type: "string", description: "The current question ID" },
      answer: { type: "string", description: "The owner's answer, unchanged" },
    },
    required: ["agent_id", "question_id", "answer"],
  },
  handler: async (args: { agent_id: string; question_id: string; answer: string }) => {
    const result = await answerContextQuestion({
      agentExternalId: args.agent_id,
      questionId: args.question_id,
      answer: args.answer,
    });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};
