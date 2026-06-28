import { Bot, InlineKeyboard } from "grammy";
import type { Context } from "grammy";

let botInstance: Bot<Context> | null = null;
let botTokenForInstance: string | null = null;

export function getTelegramBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
}

export function getTelegramBotUsername() {
  return process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") ?? "";
}

export function getTelegramMiniAppUrl(origin?: string) {
  return (
    process.env.TELEGRAM_MINI_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    origin ||
    ""
  ).replace(/\/$/, "");
}

export function buildMiniAppKeyboard(origin?: string) {
  const miniAppUrl = getTelegramMiniAppUrl(origin);
  const keyboard = new InlineKeyboard();

  if (miniAppUrl) {
    keyboard.webApp("Open Beajee", miniAppUrl);
  }

  keyboard.row().text("Set up workspace topics", "telegram:setup_topics");
  return keyboard;
}

export function buildMiniAppReplyMarkup(origin?: string) {
  const miniAppUrl = getTelegramMiniAppUrl(origin);
  const inlineKeyboard = [];

  if (miniAppUrl) {
    inlineKeyboard.push([{ text: "Open Beajee", web_app: { url: miniAppUrl } }]);
  }

  inlineKeyboard.push([{ text: "Set up workspace topics", callback_data: "telegram:setup_topics" }]);
  return { inline_keyboard: inlineKeyboard };
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
