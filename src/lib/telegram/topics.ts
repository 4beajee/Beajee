import { TelegramTopicType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getTelegramBotToken } from "@/lib/telegram/bot";
import { escapeTelegramHtml, type TelegramInlineKeyboard } from "@/lib/services/telegram";

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

const TELEGRAM_TIMEOUT_MS = 8_000;

export interface TelegramApiResult {
  sent: boolean;
  mode?: "topic" | "dm" | "disabled";
  error?: string;
}

export type TelegramTopicKey = "matches" | "dates" | "settings" | "agent_log";

type TelegramTopicDefinition = {
  key: TelegramTopicKey;
  type: TelegramTopicType;
  title: string;
  fallbackHeader: string;
};

const TOPIC_DEFINITIONS: TelegramTopicDefinition[] = [
  { key: "matches", type: "MATCHES", title: "My Matches", fallbackHeader: "My Matches" },
  { key: "dates", type: "DATES", title: "Dates", fallbackHeader: "Dates" },
  { key: "settings", type: "SETTINGS", title: "Settings", fallbackHeader: "Settings" },
  { key: "agent_log", type: "AGENT_LOG", title: "Agent Log", fallbackHeader: "Agent Log" },
];

const TOPIC_ICON_COLORS: Record<TelegramTopicKey, number> = {
  matches: 0xffd67e,
  dates: 0x6fb9f0,
  settings: 0xcb86db,
  agent_log: 0x8eee98,
};

type TelegramApiCaller = <T>(method: string, payload: Record<string, unknown>) => Promise<T>;

let telegramApiCaller: TelegramApiCaller | null = null;

export function getTelegramTopicDefinitions() {
  return TOPIC_DEFINITIONS;
}

export function toTelegramTopicType(key: TelegramTopicKey): TelegramTopicType {
  return TOPIC_DEFINITIONS.find((definition) => definition.key === key)?.type ?? "MATCHES";
}

async function defaultTelegramApiCaller<T>(method: string, payload: Record<string, unknown>) {
  const botToken = getTelegramBotToken();
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
  });

  const data = (await response.json()) as TelegramApiResponse<T>;
  if (!data.ok) {
    throw new Error(data.description ?? `Telegram Bot API ${method} failed`);
  }

  return data.result as T;
}

export async function callTelegramApi<T>(
  method: string,
  payload: Record<string, unknown>
): Promise<T> {
  return (telegramApiCaller ?? defaultTelegramApiCaller)<T>(method, payload);
}

export async function sendTelegramMessageToChat(args: {
  chatId: string | number;
  text: string;
  messageThreadId?: number | null;
  replyMarkup?: { inline_keyboard: TelegramInlineKeyboard };
  parseMode?: "HTML" | "MarkdownV2";
}) {
  return callTelegramApi<{ message_id: number }>("sendMessage", {
    chat_id: args.chatId,
    text: args.text,
    parse_mode: args.parseMode ?? "HTML",
    disable_web_page_preview: true,
    ...(args.messageThreadId ? { message_thread_id: args.messageThreadId } : {}),
    ...(args.replyMarkup ? { reply_markup: args.replyMarkup } : {}),
  });
}

export async function createUserTopics(args: {
  ownerId: string;
  chatId: string | number;
  force?: boolean;
}) {
  const chatId = String(args.chatId);
  const owner = await prisma.owner.findUnique({
    where: { id: args.ownerId },
    select: { id: true },
  });
  if (!owner) throw new Error("Owner not found");

  const chat = await callTelegramApi<{ is_forum?: boolean }>("getChat", {
    chat_id: chatId,
  });

  if (!chat.is_forum) {
    return {
      mode: "single_channel" as const,
      created: [],
      reason: "Telegram chat does not have forum topics enabled",
    };
  }

  const existing = args.force
    ? []
    : await prisma.telegramTopic.findMany({
        where: { ownerId: owner.id },
        select: { topicType: true },
      });
  const existingTypes = new Set(existing.map((topic) => topic.topicType));

  const created: Array<{
    topicType: TelegramTopicType;
    messageThreadId: number;
  }> = [];

  for (const definition of TOPIC_DEFINITIONS) {
    if (!args.force && existingTypes.has(definition.type)) continue;

    const topic = await callTelegramApi<{ message_thread_id: number }>("createForumTopic", {
      chat_id: chatId,
      name: definition.title,
      icon_color: TOPIC_ICON_COLORS[definition.key],
    });

    await prisma.telegramTopic.upsert({
      where: {
        ownerId_topicType: {
          ownerId: owner.id,
          topicType: definition.type,
        },
      },
      update: {
        chatId,
        messageThreadId: topic.message_thread_id,
      },
      create: {
        ownerId: owner.id,
        chatId,
        topicType: definition.type,
        messageThreadId: topic.message_thread_id,
      },
    });

    created.push({
      topicType: definition.type,
      messageThreadId: topic.message_thread_id,
    });
  }

  return {
    mode: "topics" as const,
    created,
  };
}

export async function sendOwnerTopicMessage(args: {
  ownerId: string;
  topic: TelegramTopicKey;
  text: string;
  replyMarkup?: { inline_keyboard: TelegramInlineKeyboard };
}): Promise<TelegramApiResult> {
  if (process.env.NODE_ENV === "test") {
    return { sent: false, mode: "disabled", error: "Telegram disabled in test environment" };
  }

  const owner = await prisma.owner.findUnique({
    where: { id: args.ownerId },
    select: {
      id: true,
      telegramId: true,
      telegramTopics: {
        where: { topicType: toTelegramTopicType(args.topic) },
        take: 1,
      },
    },
  });

  if (!owner?.telegramId) {
    return { sent: false, mode: "disabled", error: "Owner is not connected to Telegram" };
  }

  const topic = owner.telegramTopics[0];

  try {
    if (topic) {
      await sendTelegramMessageToChat({
        chatId: topic.chatId,
        messageThreadId: topic.messageThreadId,
        text: args.text,
        replyMarkup: args.replyMarkup,
      });
      return { sent: true, mode: "topic" };
    }

    const definition = TOPIC_DEFINITIONS.find((item) => item.key === args.topic);
    await sendTelegramMessageToChat({
      chatId: owner.telegramId,
      text: `<b>${escapeTelegramHtml(definition?.fallbackHeader ?? "Beajee")}</b>\n${args.text}`,
      replyMarkup: args.replyMarkup,
    });
    return { sent: true, mode: "dm" };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function sendOwnerLivePhotoCard(args: {
  ownerId: string;
  topic: TelegramTopicKey;
  caption: string;
  livePhotoUrl?: string | null;
  photoUrl?: string | null;
  profileTelegramId?: string | null;
  replyMarkup?: { inline_keyboard: TelegramInlineKeyboard };
}): Promise<TelegramApiResult> {
  if (process.env.NODE_ENV === "test") {
    return { sent: false, mode: "disabled", error: "Telegram disabled in test environment" };
  }

  const owner = await prisma.owner.findUnique({
    where: { id: args.ownerId },
    select: {
      telegramId: true,
      telegramTopics: {
        where: { topicType: toTelegramTopicType(args.topic) },
        take: 1,
      },
    },
  });

  if (!owner?.telegramId) {
    return { sent: false, mode: "disabled", error: "Owner is not connected to Telegram" };
  }

  const topic = owner.telegramTopics[0];
  const chatId = topic?.chatId ?? owner.telegramId;
  const common = {
    chat_id: chatId,
    caption: args.caption,
    parse_mode: "HTML",
    ...(topic ? { message_thread_id: topic.messageThreadId } : {}),
    ...(args.replyMarkup ? { reply_markup: args.replyMarkup } : {}),
  };

  try {
    if (args.livePhotoUrl) {
      try {
        await callTelegramApi("sendLivePhoto", {
          ...common,
          live_photo: args.livePhotoUrl,
        });
        return { sent: true, mode: topic ? "topic" : "dm" };
      } catch {
        // Telegram Bot API deployments that do not expose sendLivePhoto yet
        // still get the same match card through sendPhoto/sendMessage.
      }
    }

    if (args.profileTelegramId) {
      try {
        const profilePhotos = await callTelegramApi<{
          photos: Array<Array<{ file_id: string; width: number; height: number }>>;
        }>("getUserProfilePhotos", {
          user_id: args.profileTelegramId,
          offset: 0,
          limit: 3,
        });
        const photoFileIds = selectLargestProfilePhotoFileIds(profilePhotos.photos);

        if (photoFileIds.length > 1) {
          await callTelegramApi("sendMediaGroup", {
            chat_id: chatId,
            ...(topic ? { message_thread_id: topic.messageThreadId } : {}),
            media: photoFileIds.map((fileId) => ({ type: "photo", media: fileId })),
          });
          await sendTelegramMessageToChat({
            chatId,
            messageThreadId: topic?.messageThreadId,
            text: args.caption,
            replyMarkup: args.replyMarkup,
          });
          return { sent: true, mode: topic ? "topic" : "dm" };
        }

        if (photoFileIds[0]) {
          await callTelegramApi("sendPhoto", {
            ...common,
            photo: photoFileIds[0],
          });
          return { sent: true, mode: topic ? "topic" : "dm" };
        }
      } catch {
        // Telegram profile photos may be private or unavailable. Fall back to
        // the stored profile image URL and finally the text-only card.
      }
    }

    if (args.photoUrl) {
      try {
        await callTelegramApi("sendPhoto", {
          ...common,
          photo: args.photoUrl,
        });
        return { sent: true, mode: topic ? "topic" : "dm" };
      } catch {
        // Avatar URLs can expire or be inaccessible to Telegram. The text card is authoritative.
      }
    }

    await sendTelegramMessageToChat({
      chatId,
      messageThreadId: topic?.messageThreadId,
      text: args.caption,
      replyMarkup: args.replyMarkup,
    });
    return { sent: true, mode: topic ? "topic" : "dm" };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function selectLargestProfilePhotoFileIds(
  photos: Array<Array<{ file_id: string; width: number; height: number }>>
) {
  return photos
    .slice(0, 3)
    .map((sizes) => [...sizes].sort((a, b) => b.width * b.height - a.width * a.height)[0]?.file_id)
    .filter((fileId): fileId is string => Boolean(fileId));
}

export const __test = {
  setTelegramApiCaller(caller: TelegramApiCaller | null) {
    telegramApiCaller = caller;
  },
};
