import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/db";
import { NetworkingGoal } from "@/types/context";
import { SchedulingUrlSchema } from "@/lib/scheduling-url";
import { getPrivacySyncStatus, syncPrivacyTopicsForAgent } from "@/lib/services/privacy-sync";
import { syncNetworkingGoalForAgent } from "@/lib/services/networking-goal-sync";
import { setAgentSearchPaused } from "@/lib/services/agent-search";
import { getContextQuestionDeliveryMode } from "@/lib/agent-platform";
import { TelegramAuthError, verifyUnifiedToken } from "@/lib/telegram/auth";
import { SocialProfilePatchSchema, socialProfilesFromOwner } from "@/lib/social-profile";
import { setOwnerSocialProfiles } from "@/lib/services/owner-social-profile";

const TelegramSettingsSchema = z.object({
  agentActive: z.boolean().optional(),
  networkingGoal: NetworkingGoal.optional(),
  excludedTopics: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  schedulingUrl: z.union([z.literal(""), SchedulingUrlSchema]).optional(),
  socialProfiles: SocialProfilePatchSchema.optional(),
}).refine((value) => Object.keys(value).length > 0, "No settings supplied");

function bearer(request: NextRequest) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
}

export async function GET(request: NextRequest) {
  try {
    const auth = verifyUnifiedToken(bearer(request));
    const owner = await prisma.owner.findUnique({
      where: { id: auth.ownerId },
      include: {
        agent: { include: { context: true } },
        contextQuestionBatches: {
          where: { status: { in: ["READY", "ACTIVE", "REVIEW"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    if (!owner) return NextResponse.json({ ok: false, error: "Owner not found" }, { status: 404 });
    const privacySync = owner.agent ? await getPrivacySyncStatus(owner.agent.id) : null;
    return NextResponse.json({
      ok: true,
      settings: {
        name: owner.name,
        image: owner.image,
        onboarded: owner.onboarded,
        networkingGoal: owner.networkingGoal,
        excludedTopics: owner.excludedTopics,
        schedulingUrl: owner.schedulingUrl,
        socialProfiles: socialProfilesFromOwner(owner),
        agentId: owner.agent?.agentId ?? null,
        agentPlatform: owner.agentPlatform,
        agentActive: owner.agent ? owner.agent.isActive && !owner.agent.searchPaused : false,
        contextPublished: !!owner.agent?.context,
        freshnessState: owner.agent?.context?.freshnessState ?? null,
        privacySync,
        contextQuestionDelivery: getContextQuestionDeliveryMode(owner.agentPlatform, !!owner.telegramId),
        pendingCheckIn: owner.contextQuestionBatches[0] ? {
          batchId: owner.contextQuestionBatches[0].id,
          status: owner.contextQuestionBatches[0].status,
        } : null,
      },
    });
  } catch (error) {
    if (error instanceof TelegramAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = verifyUnifiedToken(bearer(request));
    const input = TelegramSettingsSchema.parse(await request.json());
    const owner = await prisma.owner.findUnique({
      where: { id: auth.ownerId },
      include: { agent: true },
    });
    if (!owner) return NextResponse.json({ ok: false, error: "Owner not found" }, { status: 404 });

    const ownerUpdate: Record<string, unknown> = {};
    if (input.networkingGoal !== undefined) ownerUpdate.networkingGoal = input.networkingGoal;
    if (input.schedulingUrl !== undefined) ownerUpdate.schedulingUrl = input.schedulingUrl || null;
    if (Object.keys(ownerUpdate).length) {
      await prisma.owner.update({ where: { id: owner.id }, data: ownerUpdate });
    }
    if (input.socialProfiles !== undefined) {
      await setOwnerSocialProfiles({
        ownerId: owner.id,
        patch: input.socialProfiles,
        source: "telegram",
      });
    }
    if (input.excludedTopics !== undefined) {
      await syncPrivacyTopicsForAgent({
        ownerId: owner.id,
        nextExcludedTopics: input.excludedTopics,
      });
    }
    if (input.networkingGoal !== undefined && owner.networkingGoal !== input.networkingGoal) {
      await syncNetworkingGoalForAgent({
        ownerId: owner.id,
        previousGoal: owner.networkingGoal as "partnership" | "collaboration" | "mentor" | "peer" | null,
        nextGoal: input.networkingGoal,
      });
    }
    if (input.agentActive !== undefined && owner.agent) {
      await setAgentSearchPaused({
        agentInternalId: owner.agent.id,
        paused: !input.agentActive,
        source: "settings",
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TelegramAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: error.issues[0]?.message ?? "Invalid settings" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to update settings";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
