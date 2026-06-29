import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

type Row = Record<string, any>;

const ROOT = path.resolve(__dirname, "..");
const calls: Array<{ model: string; args: Row }> = [];
const events: Row[] = [];

(globalThis as any).prisma = {
  owner: {
    count: async (args: Row) => {
      calls.push({ model: "owner", args });
      if (args.where.onboarded) return 7;
      if (args.where.createdAt) return 2;
      return 10;
    },
  },
  match: {
    count: async (args: Row) => {
      calls.push({ model: "match", args });
      if (args.where.status === "PROPOSED") return 3;
      if (args.where.status === "NEGOTIATING") return 4;
      if (args.where.matchedAt) return 1;
      return 8;
    },
  },
  analyticsEvent: {
    count: async (args: Row) => {
      calls.push({ model: "analyticsEvent", args });
      return args.where.createdAt ? 1 : 5;
    },
    findMany: async () => events.map((event) => ({ metadata: event.metadata })),
    create: async ({ data }: Row) => {
      events.push(data);
      return data;
    },
  },
};

let passed = 0;
function ok(label: string) {
  passed++;
  console.log(`PASS: ${label}`);
}

async function main() {
  const {
    collectDailyTelegramStats,
    formatDailyTelegramReport,
    getDailyReportPeriodKey,
    runDailyTelegramReport,
    sendDailyStatsTelegramMessage,
  } = await import("../src/lib/services/daily-telegram-report");

  const now = new Date("2026-06-29T18:00:00.000Z");
  const stats = await collectDailyTelegramStats(now);
  assert.deepEqual(stats, {
    registeredUsers: 10,
    registeredLast24Hours: 2,
    onboardedUsers: 7,
    deletedUsers: 5,
    deletedLast24Hours: 1,
    completedMatches: 8,
    completedMatchesLast24Hours: 1,
    pendingProposals: 3,
    activeNegotiations: 4,
  });
  assert.ok(calls.every((call) =>
    call.model === "analyticsEvent" ||
    call.args.where.isDemo === false ||
    (call.args.where.agentA?.isDemo === false && call.args.where.agentB?.isDemo === false)
  ));
  assert.equal(getDailyReportPeriodKey(now), "2026-06-29");
  ok("daily statistics use direct non-demo database counts");

  const report = formatDailyTelegramReport(stats, now);
  assert.match(report, /Зарегистрировано: <b>10<\/b> \(\+2 за 24 ч\)/);
  assert.match(report, /Удалили аккаунт: <b>5<\/b>/);
  assert.match(report, /Готовые мэтчи: <b>8<\/b>/);
  assert.match(report, /без AI/);
  ok("report stays compact and explicitly AI-free");

  const sentTexts: string[] = [];
  const first = await runDailyTelegramReport({
    now,
    send: async (text) => {
      sentTexts.push(text);
      return { sent: true };
    },
  });
  const second = await runDailyTelegramReport({
    now,
    send: async () => {
      throw new Error("duplicate delivery must not run");
    },
  });
  assert.equal(first.sent, true);
  assert.equal(second.skipped, true);
  assert.equal(sentTexts.length, 1);
  ok("successful daily delivery is idempotent for the reporting day");

  process.env.TELEGRAM_ALERTS_BOT_TOKEN = "alerts-token";
  process.env.TELEGRAM_ALERTS_CHAT_ID = "42";
  const previousFetch = globalThis.fetch;
  const telegramCalls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    telegramCalls.push(url);
    if (url.endsWith("/getMe")) {
      return new Response(JSON.stringify({ ok: true, result: { username: "beajeebot" } }));
    }
    return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }));
  }) as typeof fetch;
  const wrongBot = await sendDailyStatsTelegramMessage("private stats");
  assert.equal(wrongBot.sent, false);
  assert.match(wrongBot.error ?? "", /@gennety_alerts_bot/);
  assert.equal(telegramCalls.length, 1);
  globalThis.fetch = previousFetch;
  ok("a token for the user-facing bot is rejected before report delivery");

  const onboarding = fs.readFileSync(path.join(ROOT, "src/app/api/onboarding/route.ts"), "utf8");
  const agentSearch = fs.readFileSync(path.join(ROOT, "src/lib/services/agent-search.ts"), "utf8");
  const deletion = fs.readFileSync(
    path.join(ROOT, "src/app/api/settings/delete-account/route.ts"),
    "utf8"
  );
  const cron = fs.readFileSync(
    path.join(ROOT, "src/app/api/cron/daily-telegram-report/route.ts"),
    "utf8"
  );
  assert.doesNotMatch(onboarding, /sendTelegramNotification/);
  assert.doesNotMatch(agentSearch, /sendTelegramNotification/);
  assert.match(deletion, /deletionEventType/);
  assert.match(cron, /isAuthorizedCronRequest/);
  ok("registration and search alerts are isolated from the personal bot and deletions are durable");

  console.log(`\nAll ${passed} daily Telegram report tests passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
