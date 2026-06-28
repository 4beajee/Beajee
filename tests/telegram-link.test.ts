import assert from "node:assert/strict";

type Row = Record<string, any>;

process.env.TELEGRAM_BOT_USERNAME = "beajee_test_bot";
Object.assign(process.env, { NODE_ENV: "test" });

const db = {
  owners: [
    {
      id: "owner_web",
      email: "owner@example.com",
      name: "Web Owner",
      image: null,
      telegramId: null,
      schedulingUrl: null,
      agentPlatform: "codex",
      agent: { id: "agent_web" },
    },
    {
      id: "owner_placeholder",
      email: "telegram-42@telegram.beajee.local",
      name: "Telegram Owner",
      image: null,
      telegramId: "42",
      schedulingUrl: "https://cal.com/telegram-owner",
      agentPlatform: null,
      agent: null,
    },
  ] as Row[],
  tokens: [] as Row[],
  topics: [{ id: "topic_1", ownerId: "owner_placeholder", topicType: "SETTINGS" }] as Row[],
};

function fakePrisma() {
  const api: Row = {
    verificationToken: {
      deleteMany: async ({ where }: Row) => {
        db.tokens = db.tokens.filter((row) => row.identifier !== where.identifier);
        return { count: 1 };
      },
      create: async ({ data }: Row) => {
        db.tokens.push({ ...data });
        return data;
      },
      findUnique: async ({ where }: Row) => db.tokens.find((row) => row.token === where.token) ?? null,
      delete: async ({ where }: Row) => {
        db.tokens = db.tokens.filter((row) => row.token !== where.token);
        return where;
      },
    },
    owner: {
      findUnique: async ({ where }: Row) => {
        const owner = db.owners.find((row) => row.id === where.id || row.telegramId === where.telegramId);
        return owner ? { ...owner } : null;
      },
      update: async ({ where, data, select }: Row) => {
        const owner = db.owners.find((row) => row.id === where.id)!;
        Object.assign(owner, data);
        if (!select) return { ...owner };
        return Object.fromEntries(Object.keys(select).map((key) => [key, owner[key]]));
      },
      delete: async ({ where }: Row) => {
        db.owners = db.owners.filter((row) => row.id !== where.id);
        return where;
      },
    },
    telegramTopic: {
      updateMany: async ({ where, data }: Row) => {
        for (const topic of db.topics) if (topic.ownerId === where.ownerId) Object.assign(topic, data);
        return { count: 1 };
      },
    },
  };
  api.$transaction = async (value: any) => {
    if (typeof value === "function") return value(api);
    return Promise.all(value);
  };
  return api;
}

(globalThis as any).prisma = fakePrisma();

async function main() {
  const { createTelegramLink, consumeTelegramLink } = await import("../src/lib/telegram/link");

  const link = await createTelegramLink("owner_web");
  assert.match(link.url, /^https:\/\/t\.me\/beajee_test_bot\?start=sync_/);
  assert.equal(db.tokens.length, 1);
  const rawToken = link.url.split("sync_")[1];

  const result = await consumeTelegramLink({
    rawToken,
    telegramId: "42",
    name: "Telegram Owner",
  });
  assert.equal(result.id, "owner_web");
  assert.equal(db.owners.length, 1);
  assert.equal(db.owners[0].telegramId, "42");
  assert.equal(db.owners[0].schedulingUrl, "https://cal.com/telegram-owner");
  assert.equal(db.topics[0].ownerId, "owner_web");
  assert.equal(db.tokens.length, 0);
  await assert.rejects(
    () => consumeTelegramLink({ rawToken, telegramId: "42", name: "Telegram Owner" }),
    /invalid or already used/
  );

  console.log("PASS: one-use Telegram link merges the placeholder owner and preserves personal data");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
