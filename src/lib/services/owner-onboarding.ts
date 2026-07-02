import crypto from "node:crypto";
import { prisma, withDbRetry } from "@/lib/db";
import { normalizeSchedulingUrl } from "@/lib/scheduling-url";
import { buildSetupPrompt, getConnectionInstructions } from "@/lib/onboarding/connection-instructions";
import { PLATFORM_FILE_NAMES, PLATFORM_LABELS, type AgentPlatform, type OnboardingInput } from "@/types/onboarding";
import type { Locale } from "@/i18n/config";
import { createSetupGrant } from "@/lib/setup-grants";

export async function completeOwnerOnboarding(args: {
  ownerId: string;
  input: OnboardingInput;
  locale: Locale;
  baseUrl: string;
}) {
  const {
    agentPlatform,
    networkingGoal,
    countryCode,
    privacyConsent,
    researchConsent,
    excludedTopics,
    schedulingUrl,
  } = args.input;
  const normalizedSchedulingUrl =
    schedulingUrl && schedulingUrl.trim() ? normalizeSchedulingUrl(schedulingUrl.trim()) : null;

  const { owner, agent } = await withDbRetry(async () => {
    const owner = await prisma.owner.update({
      where: { id: args.ownerId },
      data: {
        agentPlatform,
        networkingGoal,
        countryCode,
        privacyConsent,
        researchConsent: researchConsent ?? false,
        excludedTopics: excludedTopics ?? [],
        ...(schedulingUrl !== undefined ? { schedulingUrl: normalizedSchedulingUrl } : {}),
        onboarded: true,
      },
    });

    const existingPurposeA = await prisma.consentLog.findFirst({
      where: { ownerId: owner.id, purpose: "A", withdrawnAt: null },
      select: { id: true },
    });
    if (!existingPurposeA) {
      await prisma.consentLog.create({ data: { ownerId: owner.id, purpose: "A" } });
    }
    if (researchConsent) {
      const existingPurposeB = await prisma.consentLog.findFirst({
        where: { ownerId: owner.id, purpose: "B", withdrawnAt: null },
        select: { id: true },
      });
      if (!existingPurposeB) {
        await prisma.consentLog.create({ data: { ownerId: owner.id, purpose: "B" } });
      }
    }

    let agent = await prisma.agent.findUnique({ where: { ownerId: owner.id } });
    if (!agent) {
      const nameSlug = (owner.name ?? owner.email.split("@")[0])
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
      agent = await prisma.agent.create({
        data: {
          agentId: `agent_${nameSlug}_${Date.now().toString(36)}`,
          ownerId: owner.id,
          apiKey: `gny_${crypto.randomBytes(32).toString("hex")}`,
          isActive: true,
          agentType: "OPENCLAW",
          integrationMethod: "MCP",
        },
      });
    }
    return { owner, agent };
  });

  const fileName = PLATFORM_FILE_NAMES[agentPlatform as AgentPlatform] ?? PLATFORM_FILE_NAMES.open_claw;
  const setupGrant = await createSetupGrant(agent.id);
  return {
    owner: {
      id: owner.id,
      email: owner.email,
      name: owner.name,
      networkingGoal: owner.networkingGoal,
      countryCode: owner.countryCode,
      agentPlatform,
      onboarded: owner.onboarded,
    },
    agent: { agentId: agent.agentId, apiKey: agent.apiKey },
    agentType: "OPENCLAW" as const,
    fileName,
    soulMdEndpoint: `/api/soul/${agent.agentId}`,
    setupPrompt: buildSetupPrompt(
      agent.agentId,
      setupGrant,
      args.baseUrl,
      args.locale,
      PLATFORM_LABELS[agentPlatform as AgentPlatform]
    ),
    connectionInstructions: getConnectionInstructions(
      agent.agentId,
      agent.apiKey,
      agentPlatform as AgentPlatform,
      args.locale
    ),
  };
}
