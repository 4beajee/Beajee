import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { safeErrorResponse } from "@/lib/api-error";
import { buildMiniAppReplyMarkup } from "@/lib/telegram/bot";
import { redactTelegramSecrets } from "@/lib/telegram/auth";
import { sendTelegramMessageToChat } from "@/lib/telegram/topics";
import {
  answerTelegramCallbackQuery,
  isConfiguredTelegramChat,
} from "@/lib/services/telegram";
import { confirmMatch, markDormant } from "@/lib/services/negotiation";
import { requestZoomCall } from "@/lib/services/match-call";
import { consumeTelegramLink } from "@/lib/telegram/link";
import {
  answerContextQuestion,
  confirmContextQuestionBatch,
  formatQuestionBatchSummary,
  formatTelegramQuestion,
  getActiveTelegramQuestion,
  skipContextQuestionBatch,
  startContextQuestionBatch,
} from "@/lib/services/context-questions";
import { escapeTelegramHtml } from "@/lib/services/telegram";
import { dismissSocialProfilePrompt } from "@/lib/services/social-profile-prompt";

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
  from?: { id?: number; username?: string; first_name?: string; last_name?: string };
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

  if (command === "/start") {
    return agentId?.startsWith("sync_")
      ? { kind: "telegram_sync" as const, rawToken: agentId.slice("sync_".length) }
      : { kind: "start" as const };
  }
  return null;
}

function parseCallbackCommand(data: string) {
  const [action, id] = data.split(":");
  if (action === "match_start" && id) return { kind: "match_confirm" as const, matchId: id };
  if (action === "match_skip" && id) return { kind: "match_skip" as const, matchId: id };
  if (action === "match_dialogue" && id) return { kind: "match_dialogue" as const, matchId: id };
  if (action === "match_schedule" && id) return { kind: "match_schedule" as const, matchId: id };
  if (action === "context_start" && id) return { kind: "context_start" as const, batchId: id };
  if (action === "context_skip" && id) return { kind: "context_skip" as const, batchId: id };
  if (action === "context_save" && id) return { kind: "context_save" as const, batchId: id };
  if (action === "context_discard" && id) return { kind: "context_discard" as const, batchId: id };
  if (action === "social_profiles_dismiss" && id) return { kind: "social_profiles_dismiss" as const };
  return null;
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

async function handleTelegramSync(message: TelegramMessage, rawToken: string) {
  const telegramId = message.from?.id;
  if (!message.chat?.id || !telegramId) throw new Error("Telegram identity is missing");
  const name =
    [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ").trim() ||
    (message.from?.username ? `@${message.from.username}` : `Telegram ${telegramId}`);
  try {
    const owner = await consumeTelegramLink({ rawToken, telegramId: String(telegramId), name });
    await sendTelegramMessageToChat({
      chatId: message.chat.id,
      text:
        "<b>Telegram connected</b>\n" +
        "Your Beajee account and personal agent are now synced. Context check-ins will arrive here.",
    });
    return owner;
  } catch (error) {
    await sendTelegramMessageToChat({
      chatId: message.chat.id,
      text: `<b>Telegram sync failed</b>\n${escapeTelegramHtml(
        error instanceof Error ? error.message : "Start again from the Beajee web app"
      )}`,
    });
    return null;
  }
}

async function handleContextCallback(
  command: { kind: string; batchId: string },
  telegramUserId?: number
) {
  try {
    const ownerId = await ownerIdFromTelegramUser(telegramUserId);
    if (!ownerId) return "Open the Mini App first or sync Telegram from the Beajee web app.";

    if (command.kind === "context_skip") {
      await skipContextQuestionBatch({ batchId: command.batchId, ownerId });
      return "Skipped for this week";
    }
    if (command.kind === "context_save" || command.kind === "context_discard") {
      const result = await confirmContextQuestionBatch({
        batchId: command.batchId,
        ownerId,
        decision: command.kind === "context_save" ? "save" : "discard",
      });
      return result.status === "COMPLETED" ? "Saved to your Beajee context" : "Answers discarded";
    }

    const started = await startContextQuestionBatch({ batchId: command.batchId, ownerId });
    if (!started.question) return "This check-in has no pending questions";
    const total = started.batch.questions.filter((question) => !question.isFollowUp).length;
    await sendTelegramMessageToChat({
      chatId: String(telegramUserId),
      text: formatTelegramQuestion(started.question, 1, total),
    });
    return "Check-in started";
  } catch (error) {
    return error instanceof Error ? error.message : "Could not update this check-in";
  }
}

async function handleContextAnswer(message: TelegramMessage) {
  const text = message.text?.trim();
  const telegramId = message.from?.id;
  if (!text || !telegramId || text.startsWith("/")) return false;
  const active = await getActiveTelegramQuestion(String(telegramId));
  if (!active?.question || !message.chat?.id) return false;

  const result = await answerContextQuestion({
    ownerId: active.ownerId,
    questionId: active.question.id,
    answer: text,
  });
  if (result.status === "ACTIVE" && result.question) {
    const total = active.batch.questions.filter((question) => !question.isFollowUp).length;
    const position = Math.min(total, Math.max(1, Math.floor(result.question.sequence / 10)));
    await sendTelegramMessageToChat({
      chatId: message.chat.id,
      text: formatTelegramQuestion(result.question, position, total),
    });
    return true;
  }

  const summary = formatQuestionBatchSummary(result.summary);
  await sendTelegramMessageToChat({
    chatId: message.chat.id,
    text:
      "<b>Done. Here is what I understood:</b>\n" +
      `${escapeTelegramHtml(summary)}\n\nSave these facts to your Beajee matching context?`,
    replyMarkup: {
      inline_keyboard: [[
        { text: "Save", callback_data: `context_save:${active.batch.id}` },
        { text: "Discard", callback_data: `context_discard:${active.batch.id}` },
      ]],
    },
  });
  return true;
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
      if (update.message && (await handleContextAnswer(update.message))) {
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ ok: true, ignored: true });
    }

    let callbackAnswer: string | undefined;

    if (command.kind === "start" && update.message) {
      await handleStart(update.message, request.nextUrl.origin);
    } else if (command.kind === "telegram_sync" && update.message) {
      await handleTelegramSync(update.message, command.rawToken);
      callbackAnswer = "Telegram connected";
    } else if (
      command.kind === "match_confirm" ||
      command.kind === "match_skip" ||
      command.kind === "match_dialogue" ||
      command.kind === "match_schedule"
    ) {
      callbackAnswer = await handleMatchCallback(command, update.callback_query?.from?.id);
    } else if (
      command.kind === "context_start" ||
      command.kind === "context_skip" ||
      command.kind === "context_save" ||
      command.kind === "context_discard"
    ) {
      callbackAnswer = await handleContextCallback(command, update.callback_query?.from?.id);
    } else if (command.kind === "social_profiles_dismiss") {
      const ownerId = await ownerIdFromTelegramUser(update.callback_query?.from?.id);
      if (ownerId) {
        await dismissSocialProfilePrompt(ownerId, "telegram");
        callbackAnswer = "Okay — you can add profiles later from You.";
      } else {
        callbackAnswer = "Open the Mini App first to connect your Telegram account.";
      }
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
