#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { loadTelegramDevEnv, requireTelegramDevConfig, telegramApi } from "./load-env";

const ROOT = path.resolve(__dirname, "../..");

type Update = {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat?: { id: number; type?: string; username?: string; first_name?: string };
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat?: { id: number } };
  };
};

function usage() {
  console.log(`Beajee backend — Telegram dev tooling

Usage:
  npm run telegram:dev -- <command>

Commands:
  info              Show bot identity + current webhook
  gen-secret        Print a TELEGRAM_WEBHOOK_SECRET value
  resolve-chat-id   Read latest private chat id from getUpdates
  delete-webhook    Switch bot to polling mode (required for poll)
  poll              Forward getUpdates → local /api/telegram (no ngrok)
  set-webhook       Register webhook (needs public TELEGRAM_DEV_APP_URL)
  test-send         Send a test HTML message to TELEGRAM_CHAT_ID
  sync-local        Copy telegram vars from .env.telegram.dev → .env.local
  smoke             info + test-send + optional pause/resume dry-run hints

Setup (first time):
  1. cp .env.telegram.dev.example .env.telegram.dev
  2. Paste dev bot token + your chat id into .env.telegram.dev
  3. npm run telegram:dev -- sync-local
  4. npm run dev -- -p 3001   (in another terminal)
  5. npm run telegram:dev -- poll
`);
}

async function cmdInfo(cfg: ReturnType<typeof requireTelegramDevConfig>) {
  const me = await telegramApi<{ id: number; username?: string; first_name?: string }>(
    cfg.botToken,
    "getMe"
  );
  const webhook = await telegramApi<{ url?: string; has_custom_certificate?: boolean } | null>(
    cfg.botToken,
    "getWebhookInfo"
  );

  console.log("Bot:", `@${me.username ?? "unknown"}`, `(${me.first_name ?? "dev bot"})`);
  console.log("Chat ID:", cfg.chatId || "(not set — run resolve-chat-id)");
  console.log("Local app:", cfg.appBaseUrl);
  console.log("Webhook target:", cfg.webhookUrl);
  console.log("Webhook secret:", cfg.webhookSecret ? "set" : "not set (optional for local poll)");
  console.log("Active webhook:", webhook?.url || "(none — polling mode)");
}

async function cmdResolveChatId(cfg: ReturnType<typeof requireTelegramDevConfig>) {
  await telegramApi(cfg.botToken, "deleteWebhook", { drop_pending_updates: false });
  const updates = await telegramApi<Update[]>(cfg.botToken, "getUpdates", { limit: 20 });

  const chats = new Map<number, { type?: string; username?: string; first_name?: string }>();
  for (const update of updates ?? []) {
    const chat = update.message?.chat ?? update.callback_query?.message?.chat;
    if (chat?.id) {
      const record = chat as {
        type?: string;
        username?: string;
        first_name?: string;
      };
      chats.set(chat.id, {
        type: record.type,
        username: record.username,
        first_name: record.first_name,
      });
    }
  }

  if (chats.size === 0) {
    console.log("No chats yet. Message your dev bot in Telegram, then run this again.");
    return;
  }

  console.log("Recent chats:");
  for (const [id, chat] of chats) {
    const label = [chat.first_name, chat.username ? `@${chat.username}` : null, chat.type]
      .filter(Boolean)
      .join(" · ");
    console.log(`  ${id}  ${label}`);
  }

  const latest = [...chats.keys()].at(-1);
  if (latest) {
    console.log("\nSuggested TELEGRAM_CHAT_ID:", latest);
  }
}

async function cmdDeleteWebhook(cfg: ReturnType<typeof requireTelegramDevConfig>) {
  await telegramApi(cfg.botToken, "deleteWebhook", { drop_pending_updates: false });
  console.log("Webhook deleted. Bot is in polling mode.");
}

async function forwardUpdate(cfg: ReturnType<typeof requireTelegramDevConfig>, update: Update) {
  const chatId = update.message?.chat?.id ?? update.callback_query?.message?.chat?.id;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.webhookSecret) {
    headers["x-telegram-bot-api-secret-token"] = cfg.webhookSecret;
  }

  const res = await fetch(cfg.webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(update),
  });

  const text = await res.text();
  console.log(
    `[forward] update=${update.update_id} chat=${chatId ?? "?"} status=${res.status} body=${text}`
  );
}

async function cmdPoll(cfg: ReturnType<typeof requireTelegramDevConfig>) {
  await cmdDeleteWebhook(cfg);
  console.log(`Polling Telegram → ${cfg.webhookUrl}`);
  console.log("Press Ctrl+C to stop.\n");

  let offset = 0;
  for (;;) {
    const updates = await telegramApi<Update[]>(cfg.botToken, "getUpdates", {
      timeout: 25,
      offset,
      allowed_updates: ["message", "callback_query"],
    });

    for (const update of updates ?? []) {
      offset = update.update_id + 1;
      await forwardUpdate(cfg, update);
    }

    await new Promise((r) => setTimeout(r, 200));
  }
}

async function cmdSetWebhook(cfg: ReturnType<typeof requireTelegramDevConfig>) {
  if (!cfg.appBaseUrl.startsWith("https://")) {
    throw new Error(
      "TELEGRAM_DEV_APP_URL must be a public HTTPS URL (ngrok/cloudflared). For pure local dev use: npm run telegram:dev -- poll"
    );
  }

  const body: Record<string, unknown> = {
    url: cfg.webhookUrl,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  };
  if (cfg.webhookSecret) body.secret_token = cfg.webhookSecret;

  await telegramApi(cfg.botToken, "setWebhook", body);
  console.log("Webhook registered:", cfg.webhookUrl);
}

async function cmdTestSend(cfg: ReturnType<typeof requireTelegramDevConfig>) {
  if (!cfg.chatId) throw new Error("TELEGRAM_CHAT_ID missing in .env.telegram.dev");

  await telegramApi(cfg.botToken, "sendMessage", {
    chat_id: cfg.chatId,
    text: "<b>Beajee dev bot</b>\n\nTest notification from local tooling.",
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
  console.log("Test message sent to chat", cfg.chatId);
}

function cmdGenSecret() {
  console.log(crypto.randomBytes(24).toString("hex"));
}

const MANAGED_LOCAL_KEYS = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "TELEGRAM_WEBHOOK_SECRET",
  "TELEGRAM_DEV_APP_URL",
  "TELEGRAM_MINI_APP_URL",
  "TELEGRAM_JWT_SECRET",
  "NEXTAUTH_URL",
  "NEXT_PUBLIC_APP_URL",
] as const;

function upsertEnvLocal(vars: Record<string, string>) {
  const localPath = path.join(ROOT, ".env.local");
  const lines = fs.existsSync(localPath)
    ? fs.readFileSync(localPath, "utf8").split(/\r?\n/)
    : ["# Local overrides — never commit"];

  const managed = new Set<string>(MANAGED_LOCAL_KEYS);
  const kept = lines.filter((line) => {
    const key = line.split("=")[0]?.trim();
    return !key || !managed.has(key);
  });

  const block = [
    "",
    "# Telegram dev bot (synced from .env.telegram.dev)",
    ...MANAGED_LOCAL_KEYS.filter((key) => vars[key]).map((key) => `${key}="${vars[key]}"`),
  ];

  fs.writeFileSync(localPath, [...kept, ...block].join("\n").trimEnd() + "\n");
  console.log("Updated", localPath);
}

function cmdSyncLocal() {
  loadTelegramDevEnv();
  const vars: Record<string, string> = {};
  for (const key of [
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID",
    "TELEGRAM_WEBHOOK_SECRET",
    "TELEGRAM_DEV_APP_URL",
    "TELEGRAM_MINI_APP_URL",
  ]) {
    const value = process.env[key]?.trim();
    if (value) vars[key] = value;
  }

  if (!vars.TELEGRAM_BOT_TOKEN) {
    throw new Error(".env.telegram.dev is missing TELEGRAM_BOT_TOKEN");
  }

  const localAppUrl = (vars.TELEGRAM_DEV_APP_URL ?? "http://localhost:3001").replace(/\/+$/, "");
  vars.TELEGRAM_DEV_APP_URL = localAppUrl;
  vars.NEXTAUTH_URL = localAppUrl;
  vars.NEXT_PUBLIC_APP_URL = localAppUrl;

  const miniAppUrl = (vars.TELEGRAM_MINI_APP_URL ?? `${localAppUrl}/telegram`).replace(/\/+$/, "");
  vars.TELEGRAM_MINI_APP_URL = miniAppUrl.endsWith("/telegram") ? miniAppUrl : `${miniAppUrl}/telegram`;

  if (!process.env.TELEGRAM_JWT_SECRET?.trim()) {
    vars.TELEGRAM_JWT_SECRET = crypto.randomBytes(24).toString("hex");
  } else {
    vars.TELEGRAM_JWT_SECRET = process.env.TELEGRAM_JWT_SECRET.trim();
  }

  upsertEnvLocal(vars);
  console.log("Restart `npm run dev` so Next.js picks up .env.local changes.");
  console.log(`Web onboarding: ${localAppUrl}/login`);
  console.log(`Telegram Mini App: ${vars.TELEGRAM_MINI_APP_URL}`);
}

async function cmdSmoke(cfg: ReturnType<typeof requireTelegramDevConfig>) {
  await cmdInfo(cfg);
  console.log("");
  await cmdTestSend(cfg);
  console.log("\nManual webhook test (with poll running):");
  console.log("  /pause_search <your_agent_id>");
  console.log("  /resume_search <your_agent_id>");
}

async function main() {
  const command = process.argv[2] ?? "help";

  if (command === "help" || command === "--help" || command === "-h") {
    usage();
    return;
  }

  if (command === "gen-secret") {
    cmdGenSecret();
    return;
  }

  if (command === "sync-local") {
    cmdSyncLocal();
    return;
  }

  const cfg = requireTelegramDevConfig();

  switch (command) {
    case "info":
      await cmdInfo(cfg);
      break;
    case "resolve-chat-id":
      await cmdResolveChatId(cfg);
      break;
    case "delete-webhook":
      await cmdDeleteWebhook(cfg);
      break;
    case "poll":
      await cmdPoll(cfg);
      break;
    case "set-webhook":
      await cmdSetWebhook(cfg);
      break;
    case "test-send":
      await cmdTestSend(cfg);
      break;
    case "smoke":
      await cmdSmoke(cfg);
      break;
    default:
      usage();
      process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});