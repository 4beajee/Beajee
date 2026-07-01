import { answerContextQuestion } from "@/lib/services/context-questions";
import { SensitiveContextError } from "@/lib/sensitive-topics";
import { requireMcpActor, type McpActor } from "@/lib/mcp/actor";

export const answerContextQuestionTool = {
  name: "answer_context_question" as const,
  description:
    "Record the owner's answer to the current Beajee context check-in question. " +
    "Ask exactly one question at a time in the owner's personal channel, never in Codex or Claude Code. " +
    "The response returns either the next question or a review summary.",
  inputSchema: {
    type: "object" as const,
    properties: {
      question_id: { type: "string", description: "The current question ID" },
      answer: { type: "string", description: "The owner's answer, unchanged" },
    },
    required: ["question_id", "answer"],
  },
  handler: async (args: { question_id: string; answer: string }, actor?: McpActor) => {
    const authenticated = requireMcpActor(actor);
    let result;
    try {
      result = await answerContextQuestion({
        agentExternalId: authenticated.externalAgentId,
        questionId: args.question_id,
        answer: args.answer,
      });
    } catch (error) {
      if (error instanceof SensitiveContextError) {
        return {
          isError: true,
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: error.code,
              message: error.message,
              violations: error.violations,
            }),
          }],
        };
      }
      throw error;
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};
