import assert from "node:assert/strict";

type Row = Record<string, any>;
Object.assign(process.env, { NODE_ENV: "test" });

const batch: Row = {
  id: "batch_1",
  ownerId: "owner_1",
  agentId: "agent_internal",
  cadenceKey: "2026-W26",
  delivery: "TELEGRAM",
  status: "READY",
  summary: null,
  expiresAt: new Date(Date.now() + 60_000),
  questions: [
    {
      id: "q1",
      batchId: "batch_1",
      sequence: 10,
      topic: "current_need",
      prompt: "What is blocked?",
      reason: "Current need",
      followUpPrompt: "What experience would help?",
      isFollowUp: false,
      answer: null,
      answeredAt: null,
    },
    {
      id: "q2",
      batchId: "batch_1",
      sequence: 20,
      topic: "value_offer",
      prompt: "How can you help?",
      reason: "Mutual value",
      followUpPrompt: null,
      isFollowUp: false,
      answer: null,
      answeredAt: null,
    },
  ],
};

function cloneBatch() {
  return { ...batch, questions: batch.questions.map((question: Row) => ({ ...question })) };
}

const prisma: Row = {
  contextQuestionBatch: {
    findFirst: async ({ where }: Row) => {
      if (where.id !== batch.id || (where.ownerId && where.ownerId !== batch.ownerId)) return null;
      return cloneBatch();
    },
    update: async ({ where, data }: Row) => {
      assert.equal(where.id, batch.id);
      Object.assign(batch, data);
      return cloneBatch();
    },
    findUniqueOrThrow: async ({ where }: Row) => {
      assert.equal(where.id, batch.id);
      return cloneBatch();
    },
  },
  contextQuestion: {
    findUnique: async ({ where }: Row) => {
      const question = batch.questions.find((item: Row) => item.id === where.id);
      return question
        ? { ...question, batch: { ...cloneBatch(), agent: { agentId: "agent_external" } } }
        : null;
    },
    update: async ({ where, data }: Row) => {
      const question = batch.questions.find((item: Row) => item.id === where.id)!;
      Object.assign(question, data);
      return { ...question };
    },
    create: async ({ data }: Row) => {
      const question = { id: `q${batch.questions.length + 1}`, answer: null, answeredAt: null, ...data };
      batch.questions.push(question);
      return { ...question };
    },
    updateMany: async ({ where, data }: Row) => {
      let count = 0;
      for (const question of batch.questions) {
        if (question.batchId === where.batchId) {
          Object.assign(question, data);
          count++;
        }
      }
      return { count };
    },
  },
};
prisma.$transaction = async (operations: Promise<unknown>[]) => Promise.all(operations);
(globalThis as any).prisma = prisma;

async function main() {
  const {
    answerContextQuestion,
    confirmContextQuestionBatch,
    startContextQuestionBatch,
  } = await import("../src/lib/services/context-questions");

  const started = await startContextQuestionBatch({ batchId: batch.id, ownerId: batch.ownerId });
  assert.equal(batch.status, "ACTIVE");
  assert.equal(started.question?.id, "q1");

  const first = await answerContextQuestion({
    questionId: "q1",
    answer: "distribution",
    ownerId: batch.ownerId,
  });
  assert.equal(first.status, "ACTIVE");
  assert.equal(first.question?.isFollowUp, true);

  const clarified = await answerContextQuestion({
    questionId: first.question!.id,
    answer: "Someone who launched a paid developer product in Europe",
    ownerId: batch.ownerId,
  });
  assert.equal(clarified.question?.id, "q2");

  const finished = await answerContextQuestion({
    questionId: "q2",
    answer: "I can help founders design privacy-safe agent workflows",
    ownerId: batch.ownerId,
  });
  assert.equal(finished.status, "REVIEW");
  assert.equal(batch.status, "REVIEW");
  assert.equal((finished.summary as Row).facts.length, 3);

  const discarded = await confirmContextQuestionBatch({
    batchId: batch.id,
    ownerId: batch.ownerId,
    decision: "discard",
  });
  assert.equal(discarded.status, "DISCARDED");
  assert.equal(batch.status, "DISCARDED");
  assert.equal(batch.questions.every((question: Row) => question.answer === null), true);

  console.log("PASS: context question workflow enforces order, clarification caps, review, and discard");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
