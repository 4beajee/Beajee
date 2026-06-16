import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const ROOT = path.resolve(__dirname, "../..");

function loadFile(fileName: string) {
  const filePath = path.join(ROOT, fileName);
  if (!fs.existsSync(filePath)) return;
  dotenv.config({ path: filePath, override: true });
}

export function loadTelegramDevEnv() {
  loadFile(".env");
  loadFile(".env.local");
  loadFile(".env.telegram.dev");
}

export function requireTelegramDevConfig() {
  loadTelegramDevEnv();

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim() ?? "";
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? "";
  const appBaseUrl = (process.env.TELEGRAM_DEV_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3001").replace(/\/+$/, "");

  if (!botToken) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN missing. Copy .env.telegram.dev.example → .env.telegram.dev and paste the dev bot token."
    );
  }

  return {
    botToken,
    chatId,
    webhookSecret,
    appBaseUrl,
    webhookUrl: `${appBaseUrl}/api/telegram/webhook`,
  };
}

export async function telegramApi<T = unknown>(
  botToken: string,
  method: string,
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await res.json()) as { ok: boolean; description?: string; result?: T };
  if (!data.ok) {
    throw new Error(data.description ?? `Telegram API ${method} failed`);
  }

  return data.result as T;
}