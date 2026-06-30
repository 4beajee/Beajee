import { prisma } from "@/lib/db";
import { recordAnalyticsEvent } from "@/lib/analytics-tracking";
import { supportsNativeProfilePrompts } from "@/lib/agent-platform";
import { createInboxEvent } from "@/lib/services/inbox";
import { signalAgentWork } from "@/lib/services/agent-delivery";
import { getTelegramMiniAppUrl } from "@/lib/telegram/bot";
import { sendOwnerTopicMessage } from "@/lib/telegram/topics";

export type SocialProfilePromptChannel = "telegram" | "native_agent";

function buildTelegramSocialProfileKeyboard() {
  const miniAppUrl = getTelegramMiniAppUrl();
  const rows: Array<Array<{
    text: string;
    callback_data?: string;
    web_app?: { url: string };
  }>> = [];
  if (miniAppUrl) {
    const url = new URL(miniAppUrl);
    url.searchParams.set("tab", "you");
    url.searchParams.set("section", "social-profiles");
    rows.push([{ text: "Add profiles", web_app: { url: url.toString() } }]);
  }
  rows.push([{ text: "Not now", callback_data: "social_profiles_dismiss:1" }]);
  return { inline_keyboard: rows };
}

export async function dismissSocialProfilePrompt(ownerId: string, channel: SocialProfilePromptChannel) {
  await prisma.owner.update({
    where: { id: ownerId },
    data: { socialProfilesPromptDismissedAt: new Date() },
  });
  await prisma.inboxEvent.updateMany({
    where: {
      ownerId,
      type: "PROFILE_COMPLETION_SUGGESTION",
      dismissedAt: null,
    },
    data: { dismissedAt: new Date() },
  });
  await recordAnalyticsEvent({
    type: "SOCIAL_PROFILE_PROMPT_DISMISSED",
    ownerId,
    metadata: { channel },
  }).catch(() => undefined);
}

export async function maybePromptForSocialProfiles(ownerId: string) {
  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
    include: { agent: { select: { id: true } } },
  });
  if (
    !owner?.onboarded ||
    owner.linkedinUrl ||
    owner.twitterUrl ||
    owner.socialProfilesPromptedAt ||
    owner.socialProfilesPromptDismissedAt ||
    !owner.agent
  ) {
    return { prompted: false as const, reason: "not_eligible" as const };
  }

  const channel: SocialProfilePromptChannel | null = owner.telegramId
    ? "telegram"
    : supportsNativeProfilePrompts(owner.agentPlatform)
      ? "native_agent"
      : null;
  if (!channel) return { prompted: false as const, reason: "no_supported_channel" as const };

  const claimedAt = new Date();
  const claimed = await prisma.owner.updateMany({
    where: {
      id: owner.id,
      linkedinUrl: null,
      twitterUrl: null,
      socialProfilesPromptedAt: null,
      socialProfilesPromptDismissedAt: null,
    },
    data: { socialProfilesPromptedAt: claimedAt },
  });
  if (claimed.count !== 1) {
    return { prompted: false as const, reason: "already_claimed" as const };
  }

  try {
    if (channel === "telegram") {
      const result = await sendOwnerTopicMessage({
        ownerId: owner.id,
        topic: "settings",
        text:
          "<b>Make your next introduction easier to understand</b>\n" +
          "Add an optional LinkedIn or Twitter/X profile. Beajee shows these links only after both agents agree on a match.",
        replyMarkup: buildTelegramSocialProfileKeyboard(),
      });
      if (!result.sent) throw new Error(result.error ?? "Telegram prompt was not delivered");
    } else {
      await createInboxEvent({
        ownerId: owner.id,
        agentId: owner.agent.id,
        type: "PROFILE_COMPLETION_SUGGESTION",
        referenceId: owner.id,
        payload: {
          reason: "help_new_matches_understand_your_professional_identity",
          missing_profiles: ["linkedin", "twitter"],
          visibility: "after_mutual_agent_agreement",
          mcp_action: "set_social_profiles",
          next_action: "ask_once_or_accept_not_now",
        },
      });
      signalAgentWork({
        agentId: owner.agent.id,
        kind: "PROFILE_COMPLETION_SUGGESTION",
        reason: "Optional social profiles are missing",
        referenceId: owner.id,
      }).catch((error) =>
        console.error("[social-profile-prompt] Agent wake failed; polling remains active:", error)
      );
    }

    await recordAnalyticsEvent({
      type: "SOCIAL_PROFILE_PROMPTED",
      ownerId: owner.id,
      agentId: owner.agent.id,
      metadata: { channel, missing_provider_count: 2 },
    }).catch(() => undefined);
    return { prompted: true as const, channel };
  } catch (error) {
    await prisma.owner.updateMany({
      where: { id: owner.id, socialProfilesPromptedAt: claimedAt },
      data: { socialProfilesPromptedAt: null },
    });
    throw error;
  }
}

export const __test = { buildTelegramSocialProfileKeyboard };
