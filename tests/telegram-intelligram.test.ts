import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type Row = Record<string, unknown>;
type SelectEntry = boolean | { where?: { topicType?: unknown }; take?: number };
type PrismaArgs = {
  where: {
    id?: string;
    telegramId?: string;
    ownerId?: string;
    ownerId_topicType?: { ownerId: string; topicType: string };
  };
  select?: Record<string, SelectEntry>;
  create?: Row;
  update?: Row;
};

const ROOT = path.resolve(__dirname, "..");
const previousNodeEnv = process.env.NODE_ENV;
const previousTelegramToken = process.env.TELEGRAM_BOT_TOKEN;
const previousNextAuthSecret = process.env.NEXTAUTH_SECRET;

Object.assign(process.env, { NODE_ENV: "test" });
process.env.TELEGRAM_BOT_TOKEN = "123456:test-token";
process.env.NEXTAUTH_SECRET = "test-nextauth-secret";

let passed = 0;
function ok(label: string) {
  passed++;
  console.log(`PASS: ${label}`);
}

function restoreEnv() {
  if (previousNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
  else Object.assign(process.env, { NODE_ENV: previousNodeEnv });
  if (previousTelegramToken === undefined) Reflect.deleteProperty(process.env, "TELEGRAM_BOT_TOKEN");
  else process.env.TELEGRAM_BOT_TOKEN = previousTelegramToken;
  if (previousNextAuthSecret === undefined) Reflect.deleteProperty(process.env, "NEXTAUTH_SECRET");
  else process.env.NEXTAUTH_SECRET = previousNextAuthSecret;
  delete testGlobal.prisma;
}

function signInitData(fields: Record<string, string>, botToken: string) {
  const dataCheckString = Object.entries(fields)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  const params = new URLSearchParams(fields);
  params.set("hash", hash);
  return params.toString();
}

function createFakePrisma() {
  const db = {
    owners: [
      {
        id: "owner_telegram",
        email: "telegram-42@telegram.beajee.local",
        name: "Ada Lovelace",
        telegramId: "42",
        image: null,
        onboarded: false,
      },
    ] as Row[],
    telegramTopics: [] as Row[],
  };

  const shapeSelected = (row: Row | null | undefined, args?: Pick<PrismaArgs, "select">) => {
    if (!row) return null;
    if (!args?.select) return { ...row };
    return Object.fromEntries(
      Object.entries(args.select)
        .filter(([, enabled]) => enabled)
        .map(([key, enabled]) => {
          if (key === "telegramTopics") {
            const config = typeof enabled === "object" ? enabled : {};
            const where = config.where ?? {};
            const topics = db.telegramTopics.filter(
              (topic) =>
                topic.ownerId === row.id &&
                (!where.topicType || topic.topicType === where.topicType)
            );
            return [key, topics.slice(0, config.take ?? topics.length)];
          }
          return [key, row[key]];
        })
    );
  };

  return {
    __db: db,
    owner: {
      findUnique: async (args: PrismaArgs) => {
        const where = args.where ?? {};
        const row =
          ("id" in where && db.owners.find((owner) => owner.id === where.id)) ||
          ("telegramId" in where &&
            db.owners.find((owner) => owner.telegramId === where.telegramId)) ||
          null;
        return shapeSelected(row ?? null, args);
      },
      upsert: async (args: PrismaArgs) => {
        let owner = db.owners.find((item) => item.telegramId === args.where.telegramId);
        if (!owner) {
          const newOwner: Row = { id: `owner_${db.owners.length + 1}`, ...args.create };
          db.owners.push(newOwner);
          owner = newOwner;
        } else {
          Object.assign(owner, args.update);
        }
        return shapeSelected(owner, args);
      },
    },
    telegramTopic: {
      findMany: async (args: PrismaArgs) =>
        db.telegramTopics
          .filter((topic) => !args.where?.ownerId || topic.ownerId === args.where.ownerId)
          .map((topic) => shapeSelected(topic, args)),
      upsert: async (args: PrismaArgs) => {
        const key = args.where.ownerId_topicType!;
        let topic = db.telegramTopics.find(
          (item) => item.ownerId === key.ownerId && item.topicType === key.topicType
        );
        if (!topic) {
          const newTopic: Row = { id: `topic_${db.telegramTopics.length + 1}`, createdAt: new Date(), ...args.create };
          db.telegramTopics.push(newTopic);
          topic = newTopic;
        } else {
          Object.assign(topic, args.update);
        }
        return { ...topic };
      },
    },
  };
}

const testGlobal = globalThis as typeof globalThis & {
  prisma?: ReturnType<typeof createFakePrisma>;
};

async function main() {
  testGlobal.prisma = createFakePrisma();

  const { verifyInitData, issueUnifiedToken, __test: authTest } = await import(
    "../src/lib/telegram/auth"
  );
  const { createUserTopics, sendOwnerTopicMessage, selectLargestProfilePhotoFileIds, __test: topicsTest } = await import(
    "../src/lib/telegram/topics"
  );
  const { buildMatchCardKeyboard, buildMatchCardCaption } = await import(
    "../src/lib/telegram/match-card"
  );
  const { NegotiationPayloadSchema } = await import("../src/lib/telegram/negotiation");

  {
    const schema = fs.readFileSync(path.join(ROOT, "prisma/schema.prisma"), "utf8");
    assert.match(schema, /telegramId\s+String\?\s+@unique\s+@map\("telegram_id"\)/);
    assert.match(schema, /model TelegramTopic \{/);
    assert.match(schema, /messageThreadId\s+Int\s+@map\("message_thread_id"\)/);
    assert.doesNotMatch(schema, /TEAM_SPACE|teamMode/);
    ok("Prisma schema stores personal Telegram identity and topics without Team Space");
  }

  {
    const routePolicy = fs.readFileSync(path.join(ROOT, "src/lib/route-policy.ts"), "utf8");
    const layout = fs.readFileSync(
      path.join(ROOT, "src/app/(public)/telegram/layout.tsx"),
      "utf8"
    );
    assert.match(routePolicy, /APP_EXACT\s*=\s*\[[^\]]*"\/telegram"/s);
    assert.match(routePolicy, /PUBLIC_API_PREFIXES\s*=\s*\[[^\]]*"\/api\/telegram"/s);
    assert.match(layout, /https:\/\/telegram\.org\/js\/telegram-web-app\.js/);
    ok("Mini App page, auth API, and Telegram WebApp SDK are public");
  }

  {
    const authDate = Math.floor(Date.now() / 1000);
    const initData = signInitData(
      {
        auth_date: String(authDate),
        query_id: "query_1",
        user: JSON.stringify({ id: 42, first_name: "Ada", last_name: "Lovelace" }),
      },
      process.env.TELEGRAM_BOT_TOKEN!
    );
    const verified = verifyInitData(initData, {
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      now: new Date(authDate * 1000),
      maxAgeSeconds: authTest.DEFAULT_INIT_DATA_MAX_AGE_SECONDS,
    });
    assert.equal(verified.telegramId, "42");
    assert.equal(verified.user.first_name, "Ada");
    const tampered = new URLSearchParams(initData);
    tampered.set("hash", "0".repeat(64));
    assert.throws(
      () => verifyInitData(tampered.toString(), { botToken: process.env.TELEGRAM_BOT_TOKEN }),
      /signature is invalid/
    );
    ok("Telegram initData HMAC verification accepts valid payloads and rejects tampering");
  }

  {
    const issued = await issueUnifiedToken({
      telegramId: "42",
      authDate: new Date(),
      queryId: null,
      startParam: null,
      user: { id: 42, first_name: "Ada", last_name: "Lovelace" },
    });
    const [, payload] = issued.token.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    assert.equal(decoded.ownerId, "owner_telegram");
    assert.equal(decoded.telegramId, "42");
    assert.ok(decoded.exp - decoded.iat <= 7 * 24 * 60 * 60);
    ok("Mini App auth issues a unified owner Telegram JWT with 7-day max expiry");
  }

  {
    const calls: Row[] = [];
    let threadId = 10;
    topicsTest.setTelegramApiCaller(async <T,>(method: string, payload: Record<string, unknown>) => {
      calls.push({ method, payload });
      if (method === "getChat") return { is_forum: true } as T;
      if (method === "createForumTopic") return { message_thread_id: ++threadId } as T;
      if (method === "sendMessage") return { message_id: 99 } as T;
      throw new Error(`Unexpected method ${method}`);
    });

    const result = await createUserTopics({ ownerId: "owner_telegram", chatId: "-10042" });
    assert.equal(result.mode, "topics");
    assert.equal(result.created.length, 4);
    assert.equal(testGlobal.prisma!.__db.telegramTopics.length, 4);
    assert.equal(calls.filter((call) => call.method === "createForumTopic").length, 4);
    ok("createUserTopics creates and persists the four personal forum topics");

    Object.assign(process.env, { NODE_ENV: "development" });
    await sendOwnerTopicMessage({
      ownerId: "owner_telegram",
      topic: "matches",
      text: "<b>Test</b>",
    });
    const sendPayload = calls.findLast((call) => call.method === "sendMessage")?.payload;
    assert.equal(sendPayload.chat_id, "-10042");
    assert.equal(sendPayload.message_thread_id, 11);
    Object.assign(process.env, { NODE_ENV: "test" });
    ok("owner topic messages route to the persisted message_thread_id");
  }

  {
    const keyboard = buildMatchCardKeyboard("match_123", {
      linkedin: {
        provider: "linkedin",
        url: "https://www.linkedin.com/in/grace",
        label: "/in/grace",
      },
      twitter: {
        provider: "twitter",
        url: "https://x.com/grace_builds",
        label: "@grace_builds",
      },
    });
    assert.deepEqual(keyboard.inline_keyboard[0], [
      {
        text: "in  LinkedIn",
        style: "primary",
        url: "https://www.linkedin.com/in/grace",
      },
      { text: "𝕏", url: "https://x.com/grace_builds" },
    ]);
    assert.match(keyboard.inline_keyboard[1][0].web_app?.url ?? "", /tab=matches/);
    assert.match(keyboard.inline_keyboard[1][0].web_app?.url ?? "", /matchId=match_123/);
    assert.deepEqual(selectLargestProfilePhotoFileIds([
      [{ file_id: "small", width: 80, height: 80 }, { file_id: "large", width: 640, height: 640 }],
      [{ file_id: "second", width: 320, height: 320 }],
    ]), ["large", "second"]);
    const caption = buildMatchCardCaption({
      otherOwnerName: "Grace",
      otherAgentDisplayName: null,
      framing: "Specific overlap.",
      overlapSummary: "Shared problem from different angles.",
      similarity: 0.82,
    });
    assert.match(caption, /Meet Grace/);
    assert.doesNotMatch(caption, /Compatibility/);
    ok("Match Cards show social profiles above the exact Web App review state");
  }

  {
    NegotiationPayloadSchema.parse({
      type: "negotiation_request",
      fromAgentId: "agent_alpha",
      matchCandidateId: "agent_beta",
      contextSummary: "They both care about onboarding, but from product and GTM angles.",
      compatibilityScore: 0.81,
      proposedTopics: ["onboarding", "distribution"],
    });
    assert.throws(
      () =>
        NegotiationPayloadSchema.parse({
          type: "negotiation_request",
          fromAgentId: "",
          matchCandidateId: "agent_beta",
          contextSummary: "",
          compatibilityScore: 2,
          proposedTopics: [],
        }),
      /Too small|Too big/
    );
    ok("Bot-to-bot negotiation payload schema enforces the Telegram contract");
  }

  console.log(`\nAll Telegram Intelligram tests passed (${passed} checks).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    restoreEnv();
  });
