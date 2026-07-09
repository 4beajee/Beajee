import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  buildContextQuestions,
  getQuestionCadenceKey,
  isExcludedSensitiveAnswer,
} from "@/lib/context-questions";
import { assertContextRespectsExclusions } from "@/lib/sensitive-topics";
import { getContextQuestionDeliveryMode } from "@/lib/agent-platform";
import { publishContext } from "@/lib/services/context-index";
import { escapeTelegramHtml } from "@/lib/services/telegram";
import { sendOwnerTopicMessage } from "@/lib/telegram/topics";

const BATCH_TTL_MS = 6 * 24 * 60 * 60 * 1000;

type BatchWithQuestions = Prisma.ContextQuestionBatchGetPayload<{
  include: { questions: true };
}>;

function orderedQuestions(batch: BatchWithQuestions) {
  return [...batch.questions].sort((a, b) => a.sequence - b.sequence);
}

function nextUnanswered(batch: BatchWithQuestions) {
  return orderedQuestions(batch).find((question) => !question.answeredAt) ?? null;
}

function summaryPayload(batch: BatchWithQuestions) {
  return {
    facts: orderedQuestions(batch)
      .filter((question) => question.answer)
      .map((question) => ({
        topic: question.topic,
        question: question.prompt,
        answer: question.answer,
      })),
  } satisfies Prisma.InputJsonValue;
}

export function formatQuestionBatchSummary(summary: Prisma.JsonValue | null) {
  const facts =
    summary && typeof summary === "object" && !Array.isArray(summary) && Array.isArray(summary.facts)
      ? summary.facts
      : [];
  return facts
    .map((fact) => {
      if (!fact || typeof fact !== "object" || Array.isArray(fact)) return null;
      const answer = typeof fact.answer === "string" ? fact.answer : null;
      return answer ? `• ${answer}` : null;
    })
    .filter((line): line is string => !!line)
    .join("\n");
}

async function dispatchBatch(batchId: string) {
  const batch = await prisma.contextQuestionBatch.findUnique({
    where: { id: batchId },
    include: { questions: { orderBy: { sequence: "asc" } }, owner: true, agent: true },
  });
  if (!batch || batch.deliveredAt || batch.status !== "READY") return batch;

  if (batch.delivery === "TELEGRAM") {
    const firstQuestion = batch.questions[0];
    if (!firstQuestion) return batch;
    const result = await sendOwnerTopicMessage({
      ownerId: batch.ownerId,
      topic: "settings",
      text: formatTelegramQuestion(firstQuestion),
      replyMarkup: questionReplyMarkup(batch.id),
    });
    return prisma.contextQuestionBatch.update({
      where: { id: batch.id },
      data: result.sent
        ? { deliveredAt: new Date(), deliveryError: null, status: "ACTIVE", startedAt: new Date() }
        : { deliveryError: result.error ?? "Telegram delivery failed" },
      include: { questions: true },
    });
  }

  return prisma.contextQuestionBatch.update({
    where: { id: batch.id },
    data: { deliveryError: "Telegram is required for context check-ins" },
    include: { questions: true },
  });
}

export async function createWeeklyContextQuestionBatches(options: {
  now?: Date;
  limit?: number;
} = {}) {
  const now = options.now ?? new Date();
  const cadenceKey = getQuestionCadenceKey(now);
  const owners = await prisma.owner.findMany({
    where: { onboarded: true, agent: { isNot: null } },
    include: {
      agent: { include: { context: true } },
      contextQuestionBatches: { where: { cadenceKey }, take: 1 },
    },
    take: options.limit ?? 100,
    orderBy: { createdAt: "asc" },
  });

  const result = { created: 0, delivered: 0, ineligible: 0, failed: 0 };
  for (const owner of owners) {
    if (!owner.agent) continue;
    if (!owner.agent.context) {
      result.ineligible++;
      continue;
    }
    const deliveryMode = getContextQuestionDeliveryMode(owner.agentPlatform, !!owner.telegramId);
    if (deliveryMode === "telegram_required") {
      result.ineligible++;
      continue;
    }

    let batch = owner.contextQuestionBatches[0] ?? null;
    if (!batch) {
      const generated = buildContextQuestions(owner.agent.context ?? {});
      try {
        batch = await prisma.contextQuestionBatch.create({
          data: {
            ownerId: owner.id,
            agentId: owner.agent.id,
            cadenceKey,
            delivery: deliveryMode === "telegram" ? "TELEGRAM" : "NATIVE_AGENT",
            expiresAt: new Date(now.getTime() + BATCH_TTL_MS),
            questions: { create: generated },
          },
        });
        result.created++;
      } catch (error) {
        const raced = await prisma.contextQuestionBatch.findUnique({
          where: { ownerId_cadenceKey: { ownerId: owner.id, cadenceKey } },
        });
        if (!raced) {
          result.failed++;
          console.error("[context-questions] Failed to create batch:", error);
          continue;
        }
        batch = raced;
      }
    }

    try {
      const wasUndelivered = !batch.deliveredAt;
      const delivered = await dispatchBatch(batch.id);
      if (wasUndelivered && delivered?.deliveredAt) result.delivered++;
      else if (delivered?.deliveryError) result.failed++;
    } catch (error) {
      result.failed++;
      console.error("[context-questions] Failed to deliver batch:", error);
    }
  }
  return result;
}

async function loadOwnedBatch(args: { batchId: string; ownerId: string }) {
  const batch = await prisma.contextQuestionBatch.findFirst({
    where: {
      id: args.batchId,
      ownerId: args.ownerId,
    },
    include: { questions: true },
  });
  if (!batch) throw new Error("Context question batch not found");
  if (batch.expiresAt.getTime() <= Date.now() && !["COMPLETED", "DISCARDED"].includes(batch.status)) {
    await prisma.contextQuestionBatch.update({ where: { id: batch.id }, data: { status: "EXPIRED" } });
    throw new Error("This context question batch expired");
  }
  return batch;
}

export async function skipContextQuestion(args: { batchId: string; ownerId: string }) {
  const batch = await loadOwnedBatch(args);
  if (batch.status !== "ACTIVE") throw new Error("This check-in is not accepting answers");
  const question = nextUnanswered(batch);
  if (!question) throw new Error("This check-in has no pending question");
  await prisma.contextQuestion.update({
    where: { id: question.id },
    data: { answeredAt: new Date() },
  });
  return nextQuestionOrReview(batch.id);
}

export async function answerContextQuestion(args: {
  questionId: string;
  answer: string;
  ownerId: string;
}) {
  const answer = args.answer.trim();
  if (!answer || answer.length > 2_000) throw new Error("Answer must be between 1 and 2000 characters");

  const question = await prisma.contextQuestion.findUnique({
    where: { id: args.questionId },
    include: {
      batch: {
        include: {
          questions: true,
          agent: true,
          owner: { select: { excludedTopics: true } },
        },
      },
    },
  });
  if (!question) throw new Error("Context question not found");
  if (question.batch.ownerId !== args.ownerId) throw new Error("Context question not found");
  if (question.batch.status !== "ACTIVE") throw new Error("This batch is not accepting answers");
  const expected = nextUnanswered(question.batch);
  if (!expected || expected.id !== question.id) throw new Error("Answer the current question first");

  assertContextRespectsExclusions(
    { answer },
    question.batch.owner?.excludedTopics ?? []
  );

  await prisma.contextQuestion.update({
    where: { id: question.id },
    data: { answer, answeredAt: new Date() },
  });

  return nextQuestionOrReview(question.batchId);
}

async function nextQuestionOrReview(batchId: string) {
  const refreshed = await prisma.contextQuestionBatch.findUniqueOrThrow({
    where: { id: batchId },
    include: { questions: true },
  });
  const upcoming = nextUnanswered(refreshed);
  if (upcoming) return { status: "ACTIVE" as const, question: upcoming, summary: null };

  const summary = summaryPayload(refreshed);
  await prisma.contextQuestionBatch.update({
    where: { id: refreshed.id },
    data: { status: "REVIEW", summary },
  });
  return { status: "REVIEW" as const, question: null, summary };
}

function appendContext(existing: string | null | undefined, label: string, values: string[]) {
  const additions = values.map((value) => value.trim()).filter(Boolean);
  if (additions.length === 0) return existing ?? undefined;
  return [existing?.trim(), `${label}: ${additions.join(" ")}`].filter(Boolean).join("\n");
}

async function publishApprovedBatch(batch: BatchWithQuestions) {
  const agent = await prisma.agent.findUnique({
    where: { id: batch.agentId },
    include: { context: true, owner: true },
  });
  if (!agent?.context) throw new Error("Publish context before saving context check-ins");

  const byTopic = new Map<string, string[]>();
  for (const question of orderedQuestions(batch)) {
    if (!question.answer) continue;
    if (isExcludedSensitiveAnswer(question.answer, agent.owner.excludedTopics)) continue;
    byTopic.set(question.topic, [...(byTopic.get(question.topic) ?? []), question.answer]);
  }
  const context = agent.context;
  await publishContext(agent.agentId, {
    owner_name: context.ownerName ?? undefined,
    owner_location: context.ownerLocation ?? undefined,
    owner_profession: context.ownerProfession ?? undefined,
    owner_domain: context.ownerDomain ?? undefined,
    owner_experience: context.ownerExperience ?? undefined,
    owner_goals: appendContext(context.ownerGoals, "Additional current context", byTopic.get("hidden_context") ?? []),
    agent_specialization: context.agentSpecialization ?? undefined,
    agent_domains: context.agentDomains,
    agent_constraints: context.agentConstraints ?? undefined,
    collaboration_style: context.collaborationStyle ?? undefined,
    communication_style: context.communicationStyle ?? undefined,
    current_work: context.currentWork,
    expertise: [
      ...context.expertise,
      ...(byTopic.get("value_offer") ?? []).map((value) => `Can help with: ${value}`),
    ],
    looking_for: appendContext(context.lookingFor, "Latest desired outcome", [
      ...(byTopic.get("current_need") ?? []),
      ...(byTopic.get("ideal_connection") ?? []),
    ])!,
    not_looking_for: context.notLookingFor ?? undefined,
    recent_problems: appendContext(context.recentProblems, "Current bottleneck", byTopic.get("current_need") ?? []),
    recent_wins: context.recentWins ?? undefined,
    location: context.location ?? undefined,
    networking_goal: context.networkingGoal,
  });
}

export async function confirmContextQuestionBatch(args: {
  batchId: string;
  decision: "save" | "discard";
  ownerId: string;
}) {
  const batch = await loadOwnedBatch(args);
  if (batch.status !== "REVIEW") throw new Error("This batch is not ready for review");
  if (args.decision === "discard") {
    await prisma.$transaction([
      prisma.contextQuestion.updateMany({
        where: { batchId: batch.id },
        data: { answer: null, answeredAt: null },
      }),
      prisma.contextQuestionBatch.update({
        where: { id: batch.id },
        data: { status: "DISCARDED", summary: Prisma.JsonNull, completedAt: new Date() },
      }),
    ]);
    return { status: "DISCARDED" as const };
  }

  await publishApprovedBatch(batch);
  await prisma.contextQuestionBatch.update({
    where: { id: batch.id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  return { status: "COMPLETED" as const };
}

export async function getActiveTelegramQuestion(telegramId: string) {
  const owner = await prisma.owner.findUnique({ where: { telegramId }, select: { id: true } });
  if (!owner) return null;
  const batch = await prisma.contextQuestionBatch.findFirst({
    where: { ownerId: owner.id, delivery: "TELEGRAM", status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: { questions: true },
  });
  if (!batch) return null;
  return { ownerId: owner.id, batch, question: nextUnanswered(batch) };
}

export function formatTelegramQuestion(question: { prompt: string }) {
  return escapeTelegramHtml(question.prompt);
}

export function questionReplyMarkup(batchId: string) {
  return {
    inline_keyboard: [[{ text: "Пропустить", callback_data: `context_skip_question:${batchId}` }]],
  };
}

export const __test = { BATCH_TTL_MS, summaryPayload };
