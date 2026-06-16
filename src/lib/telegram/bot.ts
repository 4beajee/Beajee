import { Bot, InlineKeyboard } from "grammy";
import type { Context } from "grammy";

let botInstance: Bot<Context> | null = null;
let botTokenForInstance: string | null = null;

export function getTelegramBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
}

export function getTelegramMiniAppUrl(origin?: string) {
  const base = (
    process.env.TELEGRAM_MINI_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    origin ||
    ""
  ).replace(/\/$/, "");

  if (!base) return "";
  if (base.endsWith("/telegram")) return base;
  return `${base}/telegram`;
}

function parseMiniAppUrl(url: string) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function canUseTelegramWebApp(url: string) {
  return parseMiniAppUrl(url)?.protocol === "https:";
}

function canUseTelegramUrlButton(url: string) {
  const parsed = parseMiniAppUrl(url);
  if (!parsed) return false;
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const host = parsed.hostname;
  return host !== "localhost" && host !== "127.0.0.1";
}

export function buildMiniAppKeyboard(origin?: string) {
  const miniAppUrl = getTelegramMiniAppUrl(origin);
  const keyboard = new InlineKeyboard();

  if (miniAppUrl && canUseTelegramWebApp(miniAppUrl)) {
    keyboard.webApp("Open Beajee", miniAppUrl);
  } else if (miniAppUrl && canUseTelegramUrlButton(miniAppUrl)) {
    keyboard.url("Open Beajee", miniAppUrl);
  }

  keyboard.row().text("Set up workspace topics", "telegram:setup_topics");
  return keyboard;
}

export function buildMiniAppReplyMarkup(origin?: string) {
  const miniAppUrl = getTelegramMiniAppUrl(origin);
  const inlineKeyboard = [];

  if (miniAppUrl && canUseTelegramWebApp(miniAppUrl)) {
    inlineKeyboard.push([{ text: "Open Beajee", web_app: { url: miniAppUrl } }]);
  } else if (miniAppUrl && canUseTelegramUrlButton(miniAppUrl)) {
    inlineKeyboard.push([{ text: "Open Beajee", url: miniAppUrl }]);
  }

  inlineKeyboard.push([{ text: "Set up workspace topics", callback_data: "telegram:setup_topics" }]);
  return { inline_keyboard: inlineKeyboard };
}

export function buildLocalDevMiniAppHint(origin?: string) {
  const miniAppUrl = getTelegramMiniAppUrl(origin);
  if (!miniAppUrl || canUseTelegramWebApp(miniAppUrl) || canUseTelegramUrlButton(miniAppUrl)) {
    return "";
  }
  return `\n\nLocal dev: open <code>${miniAppUrl}</code> in your browser.`;
}

export function getTelegramBot() {
  const token = getTelegramBotToken();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  if (!botInstance || botTokenForInstance !== token) {
    botInstance = new Bot<Context>(token);
    botTokenForInstance = token;
  }

  return botInstance;
}

export function getOptionalTelegramBot() {
  return getTelegramBotToken() ? getTelegramBot() : null;
}
