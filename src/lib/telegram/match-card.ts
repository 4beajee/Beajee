import { getTelegramMiniAppUrl } from "@/lib/telegram/bot";
import {
  sendOwnerLivePhotoCard,
  sendOwnerTopicMessage,
} from "@/lib/telegram/topics";
import { escapeTelegramHtml, type TelegramInlineKeyboard } from "@/lib/services/telegram";

export function buildMatchCardKeyboard(matchId: string): { inline_keyboard: TelegramInlineKeyboard } {
  const miniAppUrl = getTelegramMiniAppUrl();
  const dialogueUrl = miniAppUrl
    ? `${miniAppUrl}/matches?matchId=${encodeURIComponent(matchId)}&view=dialogue`
    : "";

  return {
    inline_keyboard: [
      [{ text: "Start Chat", callback_data: `match_start:${matchId}` }],
      [
        dialogueUrl
          ? { text: "Agent Dialogue", web_app: { url: dialogueUrl } }
          : { text: "Agent Dialogue", callback_data: `match_dialogue:${matchId}` },
      ],
      [
        { text: "Schedule Call", callback_data: `match_schedule:${matchId}` },
        { text: "Skip", callback_data: `match_skip:${matchId}` },
      ],
    ],
  };
}

export function buildMatchCardCaption(args: {
  otherOwnerName: string | null;
  otherAgentDisplayName: string | null;
  framing: string;
  overlapSummary: string;
  similarity?: number | null;
}) {
  const name = args.otherOwnerName ?? args.otherAgentDisplayName ?? "a relevant match";
  const score =
    typeof args.similarity === "number" ? `\nCompatibility: ${Math.round(args.similarity * 100)}%` : "";

  return [
    `<b>Meet ${escapeTelegramHtml(name)}</b>`,
    escapeTelegramHtml(args.framing),
    "",
    `<b>Why now</b>`,
    escapeTelegramHtml(args.overlapSummary),
    score,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendTelegramNegotiationStarted(args: {
  ownerId: string;
  otherOwnerName: string | null;
  otherAgentDisplayName: string | null;
}) {
  const other = args.otherOwnerName ?? args.otherAgentDisplayName ?? "another member";
  return sendOwnerTopicMessage({
    ownerId: args.ownerId,
    topic: "matches",
    text: `Your agent started a conversation with ${escapeTelegramHtml(other)}'s agent.`,
  });
}

export async function sendTelegramMatchCard(args: {
  ownerId: string;
  matchId: string;
  otherOwnerName: string | null;
  otherAgentDisplayName: string | null;
  framing: string;
  overlapSummary: string;
  similarity?: number | null;
}) {
  return sendOwnerLivePhotoCard({
    ownerId: args.ownerId,
    topic: "matches",
    caption: buildMatchCardCaption(args),
    livePhotoUrl: process.env.TELEGRAM_MATCH_CARD_LIVE_PHOTO_URL ?? null,
    photoUrl: process.env.TELEGRAM_MATCH_CARD_PHOTO_URL ?? null,
    replyMarkup: buildMatchCardKeyboard(args.matchId),
  });
}
