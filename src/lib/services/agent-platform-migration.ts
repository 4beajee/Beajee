import { prisma } from "@/lib/db";
import type { Locale } from "@/i18n/config";
import { buildSetupPrompt, getConnectionInstructions } from "@/lib/onboarding/connection-instructions";
import { getAgentPlatformMeta } from "@/lib/onboarding/agent-platform";
import { createInboxEvent } from "@/lib/services/inbox";
import { setAgentSearchPaused } from "@/lib/services/agent-search";
import {
  PLATFORM_FILE_NAMES,
  type AgentPlatform,
} from "@/types/onboarding";

export async function migrateAgentPlatform(args: {
  ownerId: string;
  nextPlatform: AgentPlatform;
  baseUrl: string;
  locale?: Locale;
}) {
  const owner = await prisma.owner.findUnique({
    where: { id: args.ownerId },
    include: { agent: true },
  });

  if (!owner) throw new Error("Owner not found");
  if (!owner.agent) throw new Error("Agent not found");

  const previousPlatform = owner.agentPlatform;
  if (previousPlatform === args.nextPlatform) {
    return {
      changed: false,
      agentPlatform: args.nextPlatform,
      agentId: owner.agent.agentId,
    };
  }

  const platformMeta = getAgentPlatformMeta(args.nextPlatform);
  const locale = args.locale ?? "en";
  const setupPrompt = buildSetupPrompt(
    owner.agent.agentId,
    owner.agent.apiKey,
    args.baseUrl,
    locale
  );
  const connectionInstructions = getConnectionInstructions(
    owner.agent.agentId,
    owner.agent.apiKey,
    args.nextPlatform,
    locale
  );
  const fileName = PLATFORM_FILE_NAMES[args.nextPlatform];

  await prisma.owner.update({
    where: { id: owner.id },
    data: { agentPlatform: args.nextPlatform },
  });

  const agentUpdate: {
    wakeWebhookEnabled?: boolean;
    webhookUrl?: string;
    webhookToken?: string | null;
  } = {};

  if (!platformMeta.features.showWakeSetup && owner.agent.wakeWebhookEnabled) {
    agentUpdate.wakeWebhookEnabled = false;
    agentUpdate.webhookUrl = "";
    agentUpdate.webhookToken = null;
  }

  if (Object.keys(agentUpdate).length > 0) {
    await prisma.agent.update({
      where: { id: owner.agent.id },
      data: agentUpdate,
    });
  }

  await setAgentSearchPaused({
    agentInternalId: owner.agent.id,
    paused: true,
    source: "settings",
  });

  await createInboxEvent({
    ownerId: owner.id,
    agentId: owner.agent.id,
    type: "AGENT_PLATFORM_CHANGED",
    referenceId: owner.agent.id,
    payload: {
      previous_platform: previousPlatform,
      next_platform: args.nextPlatform,
      platform_label: platformMeta.label,
      instruction_file: fileName,
      setup_prompt: setupPrompt,
      connection_instructions: {
        title: connectionInstructions.title,
        description: connectionInstructions.description,
        steps: connectionInstructions.steps,
        codeSnippet: connectionInstructions.codeSnippet ?? null,
        codeLanguage: connectionInstructions.codeLanguage ?? null,
      },
      action:
        "The owner switched agent platforms. Deliver the setup prompt below, help them connect the new agent with the same credentials, and remind them to remove the Beajee block from the old agent's personality file. Search stays paused until the owner resumes it in Settings after connecting.",
      changed_at: new Date().toISOString(),
    },
  });

  return {
    changed: true,
    agentPlatform: args.nextPlatform,
    agentId: owner.agent.agentId,
    platformLabel: platformMeta.label,
    setupPrompt,
  };
}