import { negotiate } from "@/lib/services/negotiation";
import { requireMcpActor, type McpActor } from "@/lib/mcp/actor";

export const negotiateTool = {
  name: "negotiate" as const,
  description:
    "Accept or decline a negotiation. When accepting, provide the overlap summary " +
    "(what the two owners have in common) and framing for your owner (how to present " +
    "the introduction to them). Both agents must accept before a proposal can be made. " +
    "You MUST provide an evaluation explaining why you accept or decline.",
  inputSchema: {
    type: "object" as const,
    properties: {
      match_id: {
        type: "string",
        description: "The match ID from initiate_negotiation",
      },
      decision: {
        type: "string",
        enum: ["accept", "decline"],
        description: "Accept or decline the negotiation",
      },
      overlap_summary: {
        type: "string",
        maxLength: 4000,
        description:
          "What the two owners have in common — must be specific and concrete, " +
          'not generic like "both work in AI"',
      },
      framing_for_owner: {
        type: "string",
        maxLength: 4000,
        description:
          "How to present this introduction to YOUR owner. Be specific: " +
          '"Alex solves X from the product side. You solve X from the infra side."',
      },
      evaluation: {
        type: "string",
        minLength: 1,
        maxLength: 4000,
        description:
          "Your private evaluation of this match proposal. Explain why you accept or decline.",
      },
    },
    required: ["match_id", "decision", "evaluation"],
  },
  handler: async (args: {
    match_id: string;
    decision: "accept" | "decline";
    overlap_summary: string;
    framing_for_owner: string;
    evaluation: string;
  }, actor?: McpActor) => {
    const authenticated = requireMcpActor(actor);
    if (!args.evaluation?.trim() || args.evaluation.length > 4_000) {
      throw new Error("evaluation must be between 1 and 4000 characters");
    }
    if (
      args.decision === "accept" &&
      (!args.overlap_summary?.trim() || !args.framing_for_owner?.trim())
    ) {
      throw new Error("Accepting requires overlap_summary and framing_for_owner");
    }
    const result = await negotiate(
      args.match_id,
      authenticated.externalAgentId,
      args.decision,
      args.overlap_summary,
      args.framing_for_owner,
      args.evaluation
    );
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};
