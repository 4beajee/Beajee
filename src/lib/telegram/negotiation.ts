import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveModel } from "@/lib/model-router";
import {
  initiateNegotiation,
  negotiate,
} from "@/lib/services/negotiation";

export const NegotiationPayloadSchema = z.object({
  type: z.literal("negotiation_request"),
  fromAgentId: z.string().min(1),
  matchCandidateId: z.string().min(1),
  contextSummary: z.string().min(1).max(4000),
  compatibilityScore: z.number().min(0).max(1),
  proposedTopics: z.array(z.string().min(1).max(120)).max(12),
});

export type NegotiationPayload = z.infer<typeof NegotiationPayloadSchema>;

function summarizeTopics(topics: string[]) {
  return topics.length ? topics.join(", ") : "specific collaboration overlap";
}

async function resolveExternalAgentId(value: string) {
  const agent = await prisma.agent.findFirst({
    where: {
      OR: [{ id: value }, { agentId: value }],
    },
    select: {
      id: true,
      agentId: true,
    },
  });

  if (!agent) throw new Error(`Agent not found: ${value}`);
  return agent;
}

export async function runTelegramNegotiationProtocol(rawPayload: unknown) {
  const payload = NegotiationPayloadSchema.parse(rawPayload);
  const [fromAgent, candidateAgent] = await Promise.all([
    resolveExternalAgentId(payload.fromAgentId),
    resolveExternalAgentId(payload.matchCandidateId),
  ]);
  const model = await resolveModel("negotiation", { forceQuality: true });

  const initiated = await initiateNegotiation(
    fromAgent.agentId,
    candidateAgent.agentId,
    payload.contextSummary,
    {
      candidateSimilarity: payload.compatibilityScore,
      discoverySource: "SEARCH",
    }
  );

  if (initiated.alreadyExists) {
    return {
      matchId: initiated.matchId,
      status: initiated.status,
      alreadyExists: true,
      model,
    };
  }

  const topicSummary = summarizeTopics(payload.proposedTopics);
  const overlapSummary =
    `Telegram negotiation payload evaluated by ${model}. ` +
    `Compatibility score: ${Math.round(payload.compatibilityScore * 100)}%. ` +
    `Proposed topics: ${topicSummary}. ${payload.contextSummary}`;

  if (payload.compatibilityScore < 0.7) {
    const declined = await negotiate(
      initiated.matchId,
      candidateAgent.agentId,
      "decline",
      undefined,
      undefined,
      `Declined by ${model}: score below threshold for a high-quality Beajee intro.`
    );

    return {
      matchId: declined.matchId,
      status: declined.status,
      decision: "decline" as const,
      model,
    };
  }

  await negotiate(
    initiated.matchId,
    fromAgent.agentId,
    "accept",
    overlapSummary,
    `This looks relevant because the candidate intersects on ${topicSummary}.`,
    `Accepted by ${model}: initiator payload is specific enough for owner review.`
  );

  const accepted = await negotiate(
    initiated.matchId,
    candidateAgent.agentId,
    "accept",
    overlapSummary,
    `This looks relevant because the initiator intersects on ${topicSummary}.`,
    `Accepted by ${model}: candidate-side evaluation found a concrete overlap.`
  );

  await prisma.negotiationLog.create({
    data: {
      matchId: initiated.matchId,
      agentId: candidateAgent.id,
      role: "responder",
      type: "evaluation",
      content: JSON.stringify({
        protocol: "telegram_bot_to_bot",
        model,
        compatibilityScore: payload.compatibilityScore,
        proposedTopics: payload.proposedTopics,
      }),
    },
  });

  return {
    matchId: accepted.matchId,
    status: accepted.status,
    decision: "accept" as const,
    model,
  };
}

export const __test = {
  summarizeTopics,
};
