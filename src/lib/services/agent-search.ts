import { prisma } from "@/lib/db";
import { recordAnalyticsEvent } from "@/lib/analytics-tracking";
import { signalAgentWork } from "@/lib/services/agent-delivery";
import { createInboxEvent } from "@/lib/services/inbox";

export type AgentSearchPauseSource = "settings" | "telegram" | "agent";

export async function setAgentSearchPaused(args: {
  agentInternalId: string;
  paused: boolean;
  source: AgentSearchPauseSource;
}) {
  const agent = await prisma.agent.findUnique({
    where: { id: args.agentInternalId },
    include: { owner: true },
  });

  if (!agent) throw new Error(`Agent not found: ${args.agentInternalId}`);

  const changed = agent.searchPaused !== args.paused || agent.isActive === args.paused;
  const updated = await prisma.agent.update({
    where: { id: agent.id },
    data: {
      searchPaused: args.paused,
      isActive: !args.paused,
      lastActiveAt: args.paused ? agent.lastActiveAt : new Date(),
    },
    include: { owner: true },
  });

  if (args.paused) {
    await prisma.beacon.updateMany({
      where: { agentId: agent.id, isActive: true },
      data: { isActive: false, preservable: true },
    });
  } else {
    await prisma.beacon.updateMany({
      where: { agentId: agent.id, isActive: false, preservable: true },
      data: { isActive: true },
    });
  }

  if (changed) {
    const type = args.paused ? "AGENT_SEARCH_PAUSED" : "AGENT_SEARCH_RESUMED";
    const timestamp = new Date().toISOString();

    await createInboxEvent({
      ownerId: agent.ownerId,
      agentId: agent.id,
      type,
      referenceId: agent.id,
      payload: {
        search_paused: args.paused,
        source: args.source,
        action: args.paused
          ? "Stop searching, do not set beacons, and do not propose new matches until search is resumed."
          : "Search is allowed again. Resume matching strategy and use preserved beacons if still relevant.",
        changed_at: timestamp,
      },
    });

    await recordAnalyticsEvent({
      type,
      ownerId: agent.ownerId,
      agentId: agent.id,
      metadata: {
        source: args.source,
        search_paused: args.paused,
      },
    });

    signalAgentWork({
      agentId: agent.id,
      kind: "AGENT_SEARCH_CHANGED",
      reason: args.paused
        ? "Owner paused match search — stop proposing matches"
        : "Owner resumed match search — refresh matching strategy",
      referenceId: agent.id,
      urgency: "high",
    }).catch((error) => {
      console.error("[agent-search] Failed to signal agent:", error);
    });
  }

  return {
    agentId: updated.agentId,
    searchPaused: updated.searchPaused,
    isActive: updated.isActive,
    changed,
  };
}

export async function setAgentSearchPausedByExternalId(args: {
  agentExternalId: string;
  paused: boolean;
  source: AgentSearchPauseSource;
}) {
  const agent = await prisma.agent.findUnique({
    where: { agentId: args.agentExternalId },
    select: { id: true },
  });

  if (!agent) throw new Error(`Agent not found: ${args.agentExternalId}`);

  return setAgentSearchPaused({
    agentInternalId: agent.id,
    paused: args.paused,
    source: args.source,
  });
}
