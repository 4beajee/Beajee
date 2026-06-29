import { prisma } from "@/lib/db";
import { escapeTelegramHtml } from "@/lib/services/telegram";

const DAY_MS = 24 * 60 * 60 * 1000;
const REPORT_EVENT_TYPE = "DAILY_TELEGRAM_STATS_SENT";
const DELETION_EVENT_TYPE = "ACCOUNT_DELETED";
const REPORT_TIME_ZONE = "America/Los_Angeles";
const EXPECTED_ALERTS_BOT_USERNAME = "gennety_alerts_bot";

export interface DailyTelegramStats {
  registeredUsers: number;
  registeredLast24Hours: number;
  onboardedUsers: number;
  deletedUsers: number;
  deletedLast24Hours: number;
  completedMatches: number;
  completedMatchesLast24Hours: number;
  pendingProposals: number;
  activeNegotiations: number;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

function realMatchWhere() {
  return {
    agentA: { isDemo: false },
    agentB: { isDemo: false },
  } as const;
}

export function getDailyReportPeriodKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export async function collectDailyTelegramStats(now = new Date()): Promise<DailyTelegramStats> {
  const since = new Date(now.getTime() - DAY_MS);
  const matchWhere = realMatchWhere();

  const [
    registeredUsers,
    registeredLast24Hours,
    onboardedUsers,
    deletedUsers,
    deletedLast24Hours,
    completedMatches,
    completedMatchesLast24Hours,
    pendingProposals,
    activeNegotiations,
  ] = await Promise.all([
    prisma.owner.count({ where: { isDemo: false } }),
    prisma.owner.count({ where: { isDemo: false, createdAt: { gte: since } } }),
    prisma.owner.count({ where: { isDemo: false, onboarded: true } }),
    prisma.analyticsEvent.count({ where: { type: DELETION_EVENT_TYPE } }),
    prisma.analyticsEvent.count({
      where: { type: DELETION_EVENT_TYPE, createdAt: { gte: since } },
    }),
    prisma.match.count({ where: { ...matchWhere, status: "MATCHED" } }),
    prisma.match.count({
      where: { ...matchWhere, status: "MATCHED", matchedAt: { gte: since } },
    }),
    prisma.match.count({ where: { ...matchWhere, status: "PROPOSED" } }),
    prisma.match.count({ where: { ...matchWhere, status: "NEGOTIATING" } }),
  ]);

  return {
    registeredUsers,
    registeredLast24Hours,
    onboardedUsers,
    deletedUsers,
    deletedLast24Hours,
    completedMatches,
    completedMatchesLast24Hours,
    pendingProposals,
    activeNegotiations,
  };
}

export function formatDailyTelegramReport(stats: DailyTelegramStats, now = new Date()) {
  const periodKey = getDailyReportPeriodKey(now);
  return [
    `<b>Beajee · Ежедневный отчёт</b>`,
    `<code>${escapeTelegramHtml(periodKey)}</code>`,
    "",
    `<b>Пользователи</b>`,
    `Зарегистрировано: <b>${stats.registeredUsers}</b> (+${stats.registeredLast24Hours} за 24 ч)`,
    `Прошли онбординг: <b>${stats.onboardedUsers}</b>`,
    `Удалили аккаунт: <b>${stats.deletedUsers}</b> (+${stats.deletedLast24Hours} за 24 ч)`,
    "",
    `<b>Мэтчинг</b>`,
    `Готовые мэтчи: <b>${stats.completedMatches}</b> (+${stats.completedMatchesLast24Hours} за 24 ч)`,
    `Ждут решения пользователей: <b>${stats.pendingProposals}</b>`,
    `Переговоры агентов: <b>${stats.activeNegotiations}</b>`,
    "",
    `<i>Прямой подсчёт в PostgreSQL, без AI.</i>`,
  ].join("\n");
}

export async function sendDailyStatsTelegramMessage(text: string) {
  const botToken = process.env.TELEGRAM_ALERTS_BOT_TOKEN?.trim() ?? "";
  const chatId = process.env.TELEGRAM_ALERTS_CHAT_ID?.trim() ?? "";
  if (!botToken || !chatId) {
    return {
      sent: false,
      error: "TELEGRAM_ALERTS_BOT_TOKEN or TELEGRAM_ALERTS_CHAT_ID is not configured",
    };
  }

  try {
    const identityResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const identity = (await identityResponse.json()) as TelegramApiResponse<{ username?: string }>;
    const username = identity.result?.username?.toLowerCase();
    if (!identity.ok || username !== EXPECTED_ALERTS_BOT_USERNAME) {
      return {
        sent: false,
        error: `Alerts token must belong to @${EXPECTED_ALERTS_BOT_USERNAME}`,
      };
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    const data = (await response.json()) as TelegramApiResponse<{ message_id: number }>;
    return data.ok
      ? { sent: true }
      : { sent: false, error: data.description ?? "Telegram sendMessage failed" };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function runDailyTelegramReport(options: {
  now?: Date;
  send?: (text: string) => Promise<{ sent: boolean; error?: string }>;
} = {}) {
  const now = options.now ?? new Date();
  const periodKey = getDailyReportPeriodKey(now);
  const recentEvents = await prisma.analyticsEvent.findMany({
    where: {
      type: REPORT_EVENT_TYPE,
      createdAt: { gte: new Date(now.getTime() - 3 * DAY_MS) },
    },
    select: { metadata: true },
  });
  const alreadySent = recentEvents.some((event) => {
    const metadata = event.metadata;
    return !!metadata && typeof metadata === "object" && !Array.isArray(metadata) &&
      metadata.periodKey === periodKey;
  });
  if (alreadySent) return { sent: false, skipped: true, periodKey };

  const stats = await collectDailyTelegramStats(now);
  const text = formatDailyTelegramReport(stats, now);
  const delivery = await (options.send ?? sendDailyStatsTelegramMessage)(text);
  if (!delivery.sent) {
    throw new Error(delivery.error ?? "Daily Telegram report was not sent");
  }

  await prisma.analyticsEvent.create({
    data: {
      type: REPORT_EVENT_TYPE,
      metadata: { periodKey, ...stats },
      createdAt: now,
    },
  });

  return { sent: true, skipped: false, periodKey, stats };
}

export const DAILY_TELEGRAM_REPORT = {
  deletionEventType: DELETION_EVENT_TYPE,
  reportEventType: REPORT_EVENT_TYPE,
  expectedBotUsername: EXPECTED_ALERTS_BOT_USERNAME,
};
