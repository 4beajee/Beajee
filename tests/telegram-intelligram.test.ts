import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type Row = Record<string, any>;

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
  delete (globalThis as any).prisma;
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
      {
        id: "owner_team",
        email: "team@beajee.test",
        name: "Team Owner",
        telegramId: "100",
        image: null,
        onboarded: true,
      },
    ] as Row[],
    telegramTopics: [] as Row[],
    communities: [
      { id: "community_off", name: "Quiet Team", status: "ACTIVE", teamMode: false },
      { id: "community_on", name: "Active Team", status: "ACTIVE", teamMode: true },
    ] as Row[],
    communityMembers: [
      { communityId: "community_on", ownerId: "owner_team", status: "ACTIVE" },
      { communityId: "community_off", ownerId: "owner_team", status: "ACTIVE" },
    ] as Row[],
  };

  const shapeSelected = (row: Row | null | undefined, args?: Row) => {
    if (!row) return null;
    if (!args?.select) return { ...row };
    return Object.fromEntries(
      Object.entries(args.select)
        .filter(([, enabled]) => enabled)
        .map(([key, enabled]) => {
          if (key === "telegramTopics") {
            const where = (enabled as Row).where ?? {};
            const topics = db.telegramTopics.filter(
              (topic) =>
                topic.ownerId === row.id &&
                (!where.topicType || topic.topicType === where.topicType)
            );
            return [key, topics.slice(0, (enabled as Row).take ?? topics.length)];
          }
          return [key, row[key]];
        })
    );
  };

  return {
    __db: db,
    owner: {
      findUnique: async (args: Row) => {
        const where = args.where ?? {};
        const row =
          ("id" in where && db.owners.find((owner) => owner.id === where.id)) ||
          ("telegramId" in where &&
            db.owners.find((owner) => owner.telegramId === where.telegramId)) ||
          null;
        return shapeSelected(row ?? null, args);
      },
      upsert: async (args: Row) => {
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
      findMany: async (args: Row) =>
        db.telegramTopics
          .filter((topic) => !args.where?.ownerId || topic.ownerId === args.where.ownerId)
          .map((topic) => shapeSelected(topic, args)),
      upsert: async (args: Row) => {
        const key = args.where.ownerId_topicType;
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
    community: {
      findUnique: async (args: Row) => {
        const row = db.communities.find((community) => community.id === args.where.id) ?? null;
        return shapeSelected(row ?? null, args);
      },
    },
    communityMember: {
      findMany: async (args: Row) =>
        db.communityMembers
          .filter((member) => {
            const where = args.where ?? {};
            return (
              (!where.communityId || member.communityId === where.communityId) &&
              (!where.status || member.status === where.status)
            );
          })
          .map((member) => shapeSelected(member, args)),
    },
  };
}

async function main() {
  (globalThis as any).prisma = createFakePrisma();

  const { verifyInitData, issueUnifiedToken, __test: authTest } = await import(
    "../src/lib/telegram/auth"
  );
  const { createUserTopics, sendOwnerTopicMessage, __test: topicsTest } = await import(
    "../src/lib/telegram/topics"
  );
  const { __test: teamSpaceTest } = await import("../src/lib/telegram/team-space");
  const { buildMatchCardKeyboard, buildMatchCardCaption } = await import(
    "../src/lib/telegram/match-card"
  );
  const { NegotiationPayloadSchema } = await import("../src/lib/telegram/negotiation");

  {
    const schema = fs.readFileSync(path.join(ROOT, "prisma/schema.prisma"), "utf8");
    assert.match(schema, /telegramId\s+String\?\s+@unique\s+@map\("telegram_id"\)/);
    assert.match(schema, /model TelegramTopic \{/);
    assert.match(schema, /messageThreadId\s+Int\s+@map\("message_thread_id"\)/);
    assert.match(schema, /teamMode\s+Boolean\s+@default\(false\)\s+@map\("team_mode"\)/);
    ok("Prisma schema stores Telegram owner identity, topics, and Team Space flag");
  }

  {
    const middleware = fs.readFileSync(path.join(ROOT, "src/middleware.ts"), "utf8");
    const layout = fs.readFileSync(
      path.join(ROOT, "src/app/(public)/telegram/layout.tsx"),
      "utf8"
    );
    assert.match(middleware, /appExact\s*=\s*\[[^\]]*"\/telegram"/);
    assert.match(middleware, /publicApiPrefixes\s*=\s*\[[^\]]*"\/api\/telegram"/);
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
    assert.throws(
      () => verifyInitData(initData.replace(/.$/, "0"), { botToken: process.env.TELEGRAM_BOT_TOKEN }),
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
    assert.equal(result.created.length, 5);
    assert.equal((globalThis as any).prisma.__db.telegramTopics.length, 5);
    assert.equal(calls.filter((call) => call.method === "createForumTopic").length, 5);
    ok("createUserTopics creates and persists the five private forum topics");

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
    Object.assign(process.env, { NODE_ENV: "development" });
    let sendCount = 0;
    topicsTest.setTelegramApiCaller(async <T,>(method: string, payload: Record<string, unknown>) => {
      if (method === "sendMessage") {
        sendCount++;
        assert.equal(payload.message_thread_id, 15);
        return { message_id: 100 + sendCount } as T;
      }
      return { is_forum: true } as T;
    });
    (globalThis as any).prisma.__db.telegramTopics.push({
      id: "topic_team",
      ownerId: "owner_team",
      chatId: "-100team",
      topicType: "TEAM_SPACE",
      messageThreadId: 15,
    });

    const skipped = await teamSpaceTest.notifyTeamSpace({
      communityId: "community_off",
      kind: "task_proposed",
      text: "Skipped",
    });
    const sent = await teamSpaceTest.notifyTeamSpace({
      communityId: "community_on",
      kind: "task_proposed",
      text: "Sent",
    });
    assert.equal(skipped.skipped, true);
    assert.equal(sent.sent, 1);
    Object.assign(process.env, { NODE_ENV: "test" });
    ok("Team Space Telegram alerts are gated by community.teamMode and active membership");
  }

  {
    const previousMiniAppUrl = process.env.TELEGRAM_MINI_APP_URL;
    process.env.TELEGRAM_MINI_APP_URL = "https://example.ngrok.dev/telegram";

    const keyboard = buildMatchCardKeyboard("match_123");
    assert.equal(keyboard.inline_keyboard[0][0].callback_data, "match_start:match_123");
    assert.equal(keyboard.inline_keyboard[2][1].callback_data, "match_skip:match_123");
    const dialogueButton = keyboard.inline_keyboard[1][0];
    assert.equal(
      dialogueButton.web_app?.url,
      "https://example.ngrok.dev/telegram/matches?matchId=match_123&view=dialogue"
    );

    if (previousMiniAppUrl === undefined) {
      delete process.env.TELEGRAM_MINI_APP_URL;
    } else {
      process.env.TELEGRAM_MINI_APP_URL = previousMiniAppUrl;
    }

    const dialoguePage = path.join(
      ROOT,
      "src/app/(public)/telegram/matches/page.tsx"
    );
    assert.ok(fs.existsSync(dialoguePage));
    const dialogueRoute = path.join(
      ROOT,
      "src/app/api/telegram/matches/[matchId]/dialogue/route.ts"
    );
    assert.ok(fs.existsSync(dialogueRoute));
    const caption = buildMatchCardCaption({
      otherOwnerName: "Grace",
      otherAgentDisplayName: null,
      framing: "Specific overlap.",
      overlapSummary: "Shared problem from different angles.",
      similarity: 0.82,
    });
    assert.match(caption, /Meet Grace/);
    assert.match(caption, /Compatibility: 82%/);
    ok("Match Cards expose start, dialogue, schedule, and skip actions");
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
