import { getTelegramMiniAppUrl } from "@/lib/telegram/bot";
import {
  sendOwnerLivePhotoCard,
  sendOwnerTopicMessage,
} from "@/lib/telegram/topics";
import { escapeTelegramHtml, type TelegramInlineKeyboard } from "@/lib/services/telegram";
import type { SocialProfiles } from "@/lib/social-profile";

function buildMiniAppKeyboard(
  text: string,
  params: Record<string, string>
): { inline_keyboard: TelegramInlineKeyboard } | undefined {
  const miniAppUrl = getTelegramMiniAppUrl();
  if (!miniAppUrl) return undefined;
  const url = new URL(miniAppUrl);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return { inline_keyboard: [[{ text, web_app: { url: url.toString() } }]] };
}

export function buildMatchCardKeyboard(
  matchId: string,
  socialProfiles?: SocialProfiles
): { inline_keyboard: TelegramInlineKeyboard } {
  const miniAppUrl = getTelegramMiniAppUrl();
  let reviewUrl = "";
  if (miniAppUrl) {
    const url = new URL(miniAppUrl);
    url.searchParams.set("tab", "matches");
    url.searchParams.set("matchId", matchId);
    reviewUrl = url.toString();
  }

  const socialRow: TelegramInlineKeyboard[number] = [];
  if (socialProfiles?.linkedin) {
    socialRow.push({
      text: "in  LinkedIn",
      style: "primary",
      url: socialProfiles.linkedin.url,
    });
  }
  if (socialProfiles?.twitter) {
    socialRow.push({ text: "𝕏", url: socialProfiles.twitter.url });
  }
  const reviewRow: TelegramInlineKeyboard[number] = reviewUrl
    ? [{ text: "Review introduction", web_app: { url: reviewUrl } }]
    : [{ text: "Review introduction", callback_data: `match_dialogue:${matchId}` }];
  return { inline_keyboard: [...(socialRow.length ? [socialRow] : []), reviewRow] };
}

export function buildMatchCardCaption(args: {
  otherOwnerName: string | null;
  otherAgentDisplayName: string | null;
  framing: string;
  overlapSummary: string;
  similarity?: number | null;
}) {
  const name = args.otherOwnerName ?? args.otherAgentDisplayName ?? "a relevant match";
  return [
    `<b>Meet ${escapeTelegramHtml(name)}</b>`,
    escapeTelegramHtml(args.framing),
    "",
    `<b>Why now</b>`,
    escapeTelegramHtml(args.overlapSummary),
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
  otherOwnerImage?: string | null;
  otherOwnerTelegramId?: string | null;
  socialProfiles?: SocialProfiles;
}) {
  return sendOwnerLivePhotoCard({
    ownerId: args.ownerId,
    topic: "matches",
    caption: buildMatchCardCaption(args),
    livePhotoUrl: process.env.TELEGRAM_MATCH_CARD_LIVE_PHOTO_URL ?? null,
    photoUrl: args.otherOwnerImage ?? process.env.TELEGRAM_MATCH_CARD_PHOTO_URL ?? null,
    profileTelegramId: args.otherOwnerTelegramId,
    replyMarkup: buildMatchCardKeyboard(args.matchId, args.socialProfiles),
  });
}

export async function sendTelegramChatNotification(args: {
  ownerId: string;
  matchId: string;
  senderName: string | null;
  preview: string;
}) {
  const sender = escapeTelegramHtml(args.senderName ?? "Your connection");
  const preview = escapeTelegramHtml(args.preview.slice(0, 240));
  return sendOwnerTopicMessage({
    ownerId: args.ownerId,
    topic: "matches",
    text: `<b>${sender}</b> sent you a message\n${preview}`,
    replyMarkup: buildMiniAppKeyboard("Open chat", {
      tab: "chats",
      matchId: args.matchId,
    }),
  });
}

export async function sendTelegramCallRequest(args: {
  ownerId: string;
  matchId: string;
  requesterName: string | null;
}) {
  const requester = escapeTelegramHtml(args.requesterName ?? "Your connection");
  return sendOwnerTopicMessage({
    ownerId: args.ownerId,
    topic: "dates",
    text: `<b>${requester}</b> would like to schedule a call.`,
    replyMarkup: buildMiniAppKeyboard("Review call", {
      tab: "matches",
      matchId: args.matchId,
    }),
  });
}
