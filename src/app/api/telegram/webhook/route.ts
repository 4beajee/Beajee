import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { safeErrorResponse } from "@/lib/api-error";
import { buildMiniAppReplyMarkup } from "@/lib/telegram/bot";
import { redactTelegramSecrets } from "@/lib/telegram/auth";
import {
  createUserTopics,
  sendTelegramMessageToChat,
} from "@/lib/telegram/topics";
import {
  answerTelegramCallbackQuery,
  isConfiguredTelegramChat,
} from "@/lib/services/telegram";
import {
  setAgentSearchPaused,
  setAgentSearchPausedByExternalId,
} from "@/lib/services/agent-search";
import { confirmMatch, markDormant } from "@/lib/services/negotiation";
import { requestZoomCall } from "@/lib/services/match-call";

interface TelegramUpdate {
  message?: TelegramMessage;
  callback_query?: {
    id?: string;
    data?: string;
    from?: { id?: number; username?: string };
    message?: TelegramMessage;
  };
}

interface TelegramMessage {
  text?: string;
  message_thread_id?: number;
  chat?: {
    id?: number | string;
    type?: string;
    title?: string;
    is_forum?: boolean;
  };
  from?: { id?: number; username?: string };
}

function isAuthorized(request: NextRequest, chatId: string | number | null | undefined) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  if (expectedSecret) {
    const actualSecret = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
    return actualSecret === expectedSecret;
  }

  if (process.env.NODE_ENV === "production") return false;
  return !process.env.TELEGRAM_CHAT_ID || isConfiguredTelegramChat(chatId);
}

function parseTextCommand(text: string) {
  const [commandWithBot, agentId] = text.trim().split(/\s+/);
  const command = commandWithBot.split("@")[0];

  if (command === "/start") return { kind: "start" as const };
  if (command === "/setup_topics") return { kind: "setup_topics" as const };

  if (!agentId) return null;
  if (command === "/pause_search" || command === "/stop_matches") {
    return { kind: "search_pause" as const, paused: true, agentId };
  }
  if (command === "/resume_search" || command === "/start_matches") {
    return { kind: "search_pause" as const, paused: false, agentId };
  }

  return null;
}

function parseCallbackCommand(data: string) {
  const [action, id] = data.split(":");
  if (data === "telegram:setup_topics") return { kind: "setup_topics" as const };
  if (action === "pause_search_id" && id) {
    return { kind: "search_pause" as const, paused: true, agentInternalId: id };
  }
  if (action === "resume_search_id" && id) {
    return { kind: "search_pause" as const, paused: false, agentInternalId: id };
  }
  if (action === "match_start" && id) return { kind: "match_confirm" as const, matchId: id };
  if (action === "match_skip" && id) return { kind: "match_skip" as const, matchId: id };
  if (action === "match_dialogue" && id) return { kind: "match_dialogue" as const, matchId: id };
  if (action === "match_schedule" && id) return { kind: "match_schedule" as const, matchId: id };
  return null;
}

async function applySearchCommand(command: {
  paused: boolean;
  agentId?: string;
  agentInternalId?: string;
}) {
  if (command.agentInternalId) {
    await setAgentSearchPaused({
      agentInternalId: command.agentInternalId,
      paused: command.paused,
      source: "telegram",
    });
    return;
  }

  if (!command.agentId) throw new Error("Agent ID is required");
  await setAgentSearchPausedByExternalId({
    agentExternalId: command.agentId,
    paused: command.paused,
    source: "telegram",
  });
}

async function ownerIdFromTelegramUser(telegramUserId: number | string | undefined) {
  if (!telegramUserId) return null;
  const owner = await prisma.owner.findUnique({
    where: { telegramId: String(telegramUserId) },
    select: { id: true },
  });
  return owner?.id ?? null;
}

async function handleStart(message: TelegramMessage, origin?: string) {
  if (!message.chat?.id) return;
  await sendTelegramMessageToChat({
    chatId: message.chat.id,
    text:
      "<b>Welcome to Beajee</b>\n" +
      "Your personal agent can find relevant people, negotiate introductions, and bring you one clear question: Meet?",
    replyMarkup: buildMiniAppReplyMarkup(origin),
  });
}

async function handleTopicSetup(message: TelegramMessage, telegramUserId?: number) {
  if (!message.chat?.id) return "No chat found";

  const ownerId = await ownerIdFromTelegramUser(telegramUserId ?? message.from?.id);
  if (!ownerId) {
    return "Open the Mini App first so Beajee can connect this Telegram account.";
  }

  if (message.chat.type === "private") {
    await sendTelegramMessageToChat({
      chatId: message.chat.id,
      text:
        "<b>Private workspace required</b>\n" +
        "Create a private supergroup, add this bot, enable Topics, then run /setup_topics inside that group.",
    });
    return "Workspace instructions sent";
  }

  const result = await createUserTopics({
    ownerId,
    chatId: message.chat.id,
  });

  await sendTelegramMessageToChat({
    chatId: message.chat.id,
    text:
      result.mode === "topics"
        ? `<b>Beajee topics ready</b>\nCreated ${result.created.length} private workspace topic(s).`
        : `<b>Beajee single-channel mode</b>\n${result.reason}`,
    ...(message.message_thread_id ? { messageThreadId: message.message_thread_id } : {}),
  });

  return result.mode;
}

async function handleMatchCallback(command: { kind: string; matchId: string }, telegramUserId?: number) {
  const ownerId = await ownerIdFromTelegramUser(telegramUserId);
  if (!ownerId) return "Open the Mini App first to connect your Telegram account.";

  if (command.kind === "match_confirm") {
    const result = await confirmMatch(command.matchId, ownerId);
    return result.status === "MATCHED" ? "Match confirmed. Chat is open." : "Confirmed. Waiting for the other owner.";
  }

  if (command.kind === "match_skip") {
    await markDormant(command.matchId, ownerId);
    return "Moved to dormant. No reminders will be sent.";
  }

  if (command.kind === "match_dialogue") {
    return "Open the Mini App to review the agent dialogue.";
  }

  if (command.kind === "match_schedule") {
    try {
      await requestZoomCall(command.matchId, ownerId);
      return "Call requested. Open the Mini App to confirm a time or join when the link is ready.";
    } catch {
      return "Open the Mini App to schedule your Zoom call.";
    }
  }

  return "Unsupported match action.";
}

export async function POST(request: NextRequest) {
  try {
    const update = (await request.json()) as TelegramUpdate;
    const messageChatId = update.message?.chat?.id;
    const callbackChatId = update.callback_query?.message?.chat?.id;
    const chatId = messageChatId ?? callbackChatId;

    if (!isAuthorized(request, chatId)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const callbackId = update.callback_query?.id;
    const callbackCommand = update.callback_query?.data
      ? parseCallbackCommand(update.callback_query.data)
      : null;
    const messageCommand = update.message?.text ? parseTextCommand(update.message.text) : null;
    const command = callbackCommand ?? messageCommand;

    if (!command) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    let callbackAnswer: string | undefined;

    if (command.kind === "start" && update.message) {
      await handleStart(update.message, request.nextUrl.origin);
    } else if (command.kind === "setup_topics") {
      callbackAnswer = await handleTopicSetup(
        update.callback_query?.message ?? update.message ?? {},
        update.callback_query?.from?.id
      );
    } else if (command.kind === "search_pause") {
      await applySearchCommand(command);
      callbackAnswer = command.paused ? "Search paused" : "Search resumed";
    } else if (
      command.kind === "match_confirm" ||
      command.kind === "match_skip" ||
      command.kind === "match_dialogue" ||
      command.kind === "match_schedule"
    ) {
      callbackAnswer = await handleMatchCallback(command, update.callback_query?.from?.id);
    }

    if (callbackId) {
      answerTelegramCallbackQuery(callbackId, callbackAnswer).catch((error) =>
        console.error("[telegram-webhook] callback answer failed:", redactTelegramSecrets(error))
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[telegram-webhook] failed:", redactTelegramSecrets(error));
    return safeErrorResponse(error, "Failed to handle Telegram webhook");
  }
}
