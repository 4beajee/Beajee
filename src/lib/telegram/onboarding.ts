export function buildTelegramWelcomeMessage(firstName?: string) {
  const greeting = firstName ? `Welcome, ${firstName}!` : "Welcome to Beajee!";

  return (
    `<b>${greeting}</b>\n\n` +
    "Beajee is not a general AI chat. You do not need to prompt the bot or describe who you want to meet here. " +
    "Your personal agent does that work in the background.\n\n" +
    "<b>Start here</b>\n" +
    "1. Open Beajee below.\n" +
    "2. Choose your networking goal and connect your personal agent.\n" +
    "3. Come back here for introductions, context check-ins, chat updates, and call reminders.\n\n" +
    "Inside Beajee you can review Today, Matches, Chats, calls, and your settings.\n\n" +
    "When I ask a context question, reply here in plain text. At other times, use the Mini App rather than treating this bot like an open-ended AI chat."
    + `\n\nNeed technical help or found a bug? Use /help to contact <a href="${TELEGRAM_SUPPORT_URL}">@${TELEGRAM_SUPPORT_USERNAME}</a>.`
  );
}

export function buildTelegramGuidanceMessage() {
  return (
    "<b>What should I do with this message?</b>\n\n" +
    "This bot is not an open-ended AI chat, so free-form messages only work while I am asking you a context check-in question.\n\n" +
    "Open Beajee to:\n" +
    "• review introductions and agent reasoning;\n" +
    "• chat after both people confirm;\n" +
    "• schedule or join calls;\n" +
    "• update your goal, privacy, and agent settings.\n\n" +
    `Use /help anytime to see this guide again.\n\n` +
    `<b>Technical help</b>\nFound a bug or something confusing? Message <a href="${TELEGRAM_SUPPORT_URL}">@${TELEGRAM_SUPPORT_USERNAME}</a> directly.`
  );
}
export const TELEGRAM_SUPPORT_USERNAME = "GGen1e";
export const TELEGRAM_SUPPORT_URL = `https://t.me/${TELEGRAM_SUPPORT_USERNAME}`;
