import { prisma } from "@/lib/db";

export const getFullUserContextTool = {
  name: "get_full_user_context" as const,
  description:
    "Get the full aggregated user profile for the Codex/agent. " +
    "Returns complete context from MEMORY.md, USER.md, SOUL.md, AGENTS.md plus current beacons, matches, reputation, and notifications.",
  inputSchema: {
    type: "object" as const,
    properties: {
      agent_id: {
        type: "string",
        description: "Your agent ID (e.g. agent_arlan_001)",
      },
      since_timestamp: {
        type: "string",
        description: "Optional ISO timestamp. If provided, returns only changes since this time (heartbeat/diff mode). If omitted, returns the full profile.",
      },
    },
    required: ["agent_id"],
  },
  handler: async (args: { agent_id: string; since_timestamp?: string }) => {
    // --- Heartbeat mode: return only changes since since_timestamp ---
    if (args.since_timestamp) {
      const since = new Date(args.since_timestamp);
      const agent = await prisma.agent.findUnique({
        where: { agentId: args.agent_id },
        include: { owner: true, context: true },
      });
      if (!agent) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Agent not found: " + args.agent_id }) }], isError: true };
      }

      const [newInboxEvents, updatedMatchesAsA, updatedMatchesAsB] = await Promise.all([
        prisma.inboxEvent.findMany({
          where: { agentId: agent.id, createdAt: { gte: since } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.match.findMany({
          where: { agentAId: agent.id },
          include: { negotiationLogs: { orderBy: { createdAt: "desc" }, take: 1 } },
        }),
        prisma.match.findMany({
          where: { agentBId: agent.id },
          include: { negotiationLogs: { orderBy: { createdAt: "desc" }, take: 1 } },
        }),
      ]);

      const isRecent = (m: typeof updatedMatchesAsA[number]) => {
        const lastChange = m.matchedAt || m.proposedAt || m.createdAt;
        return lastChange >= since;
      };
      const updatedMatches = [...updatedMatchesAsA.filter(isRecent), ...updatedMatchesAsB.filter(isRecent)];
      const hasChanges = newInboxEvents.length > 0 || updatedMatches.length > 0;

      // Build compact needsAttention for heartbeat
      const needsAttention: string[] = [];
      if (newInboxEvents.length > 0) needsAttention.push(`${newInboxEvents.length} new inbox event(s) since last check.`);
      if (updatedMatches.length > 0) needsAttention.push(`${updatedMatches.length} match(es) updated since last check.`);

      let profileSnapshot = null;
      if (hasChanges && agent.context) {
        profileSnapshot = {
          owner: { id: agent.owner.id, name: agent.owner.name, networkingGoal: agent.owner.networkingGoal },
          agent: { agentId: agent.agentId, displayName: agent.displayName, searchPaused: agent.searchPaused },
          context: { freshnessState: agent.context.freshnessState, lastSignificantUpdateAt: agent.context.lastSignificantUpdateAt },
        };
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            hasChanges,
            newInboxEvents: newInboxEvents.map(e => ({ id: e.id, type: e.type, referenceId: e.referenceId, createdAt: e.createdAt })),
            updatedMatches: updatedMatches.map(m => ({ matchId: m.id, status: m.status, lastActivity: m.matchedAt || m.proposedAt || m.createdAt })),
            needsAttention,
            profileSnapshot,
          }, null, 2),
        }],
      };
    }

    // --- Full profile mode (unchanged) ---

    const agent = await prisma.agent.findUnique({
      where: { agentId: args.agent_id },
      include: {
        owner: true,
        context: true,
        beacons: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
        },
        matchesAsA: {
          include: {
            agentB: {
              include: { owner: true, context: true },
            },
          },
        },
        matchesAsB: {
          include: {
            agentA: {
              include: { owner: true, context: true },
            },
          },
        },
      },
    });

    if (!agent) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: `Agent not found: ${args.agent_id}` }),
          },
        ],
        isError: true,
      };
    }

    // --- Owner profile ---
    const owner = {
      id: agent.owner.id,
      email: agent.owner.email,
      name: agent.owner.name,
      networkingGoal: agent.owner.networkingGoal,
      countryCode: agent.owner.countryCode,
      agentPlatform: agent.owner.agentPlatform,
      onboarded: agent.owner.onboarded,
    };

    // --- Agent profile with reputation ---
    const agentProfile = {
      agentId: agent.agentId,
      displayName: agent.displayName,
      isActive: agent.isActive,
      searchPaused: agent.searchPaused,
      agentType: agent.agentType,
      integrationMethod: agent.integrationMethod,
      reputation: {
        score: agent.reputationScore,
        acceptanceRate: agent.reputationAcceptanceRate,
        negotiationRate: agent.reputationNegotiationRate,
        completedMatches: agent.reputationCompletedMatches,
        totalProposed: agent.totalProposedMatches,
      },
    };

    // --- AgentContext ---
    const context = agent.context
      ? {
          ownerName: agent.context.ownerName,
          ownerLocation: agent.context.ownerLocation,
          ownerProfession: agent.context.ownerProfession,
          ownerDomain: agent.context.ownerDomain,
          ownerExperience: agent.context.ownerExperience,
          ownerGoals: agent.context.ownerGoals,
          agentSpecialization: agent.context.agentSpecialization,
          agentDomains: agent.context.agentDomains,
          agentConstraints: agent.context.agentConstraints,
          collaborationStyle: agent.context.collaborationStyle,
          communicationStyle: agent.context.communicationStyle,
          currentWork: agent.context.currentWork,
          expertise: agent.context.expertise,
          lookingFor: agent.context.lookingFor,
          notLookingFor: agent.context.notLookingFor,
          recentProblems: agent.context.recentProblems,
          recentWins: agent.context.recentWins,
          location: agent.context.location,
          networkingGoal: agent.context.networkingGoal,
          freshnessState: agent.context.freshnessState,
          lastSignificantUpdateAt: agent.context.lastSignificantUpdateAt,
          daysSinceUpdate: Math.floor(
            (Date.now() - agent.context.lastSignificantUpdateAt.getTime()) /
              (1000 * 60 * 60 * 24)
          ),
        }
      : null;

    // --- Beacons ---
    const beacons = agent.beacons.map((b) => ({
      contextQuery: b.contextQuery,
      networkingGoalFilter: b.networkingGoalFilter,
      isActive: b.isActive,
      createdAt: b.createdAt,
      triggeredAt: b.triggeredAt,
    }));

    // --- Normalise matches into a flat list with typed other-agent info ---
    type NormalisedMatch = {
      id: string;
      status: string;
      createdAt: Date;
      proposedAt: Date | null;
      matchedAt: Date | null;
      overlapSummary: string;
      framingForMe: string | null;
      confirmedByMe: boolean;
      confirmedByOther: boolean;
      otherAgent: {
        agentId: string;
        displayName: string | null;
      };
    };

    const normalisedMatches: NormalisedMatch[] = [];

    for (const m of agent.matchesAsA) {
      normalisedMatches.push({
        id: m.id,
        status: m.status,
        createdAt: m.createdAt,
        proposedAt: m.proposedAt,
        matchedAt: m.matchedAt,
        overlapSummary: m.overlapSummary,
        framingForMe: m.framingForA,
        confirmedByMe: m.confirmedByA,
        confirmedByOther: m.confirmedByB,
        otherAgent: {
          agentId: m.agentB.agentId,
          displayName: m.agentB.displayName,
        },
      });
    }

    for (const m of agent.matchesAsB) {
      normalisedMatches.push({
        id: m.id,
        status: m.status,
        createdAt: m.createdAt,
        proposedAt: m.proposedAt,
        matchedAt: m.matchedAt,
        overlapSummary: m.overlapSummary,
        framingForMe: m.framingForB,
        confirmedByMe: m.confirmedByB,
        confirmedByOther: m.confirmedByA,
        otherAgent: {
          agentId: m.agentA.agentId,
          displayName: m.agentA.displayName,
        },
      });
    }

    const filterByStatus = (status: string) =>
      normalisedMatches
        .filter((m) => m.status === status)
        .map(({ framingForMe, confirmedByMe, confirmedByOther, ...rest }) =>
          status === "PROPOSED"
            ? {
                ...rest,
                status: rest.status,
                framingForMe,
                confirmedByMe,
                confirmedByOther,
              }
            : {
                ...rest,
                status: rest.status,
              }
        );

    const matchesByStatus = {
      negotiating: filterByStatus("NEGOTIATING"),
      proposed: filterByStatus("PROPOSED"),
      matched: filterByStatus("MATCHED"),
      dormant: filterByStatus("DORMANT"),
    };

    // --- Unread inbox events ---
    const unreadInboxEvents = await prisma.inboxEvent.findMany({
      where: {
        agentId: agent.id,
        deliveredAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    // --- Flags ---
    const hasPublishedContext = !!agent.context;
    const hasUnreadMatches = normalisedMatches.some(
      (m) => m.status === "PROPOSED" && !m.confirmedByMe
    );

    // --- needsAttention ---
    const needsAttention: string[] = [];

    if (
      agent.context &&
      (agent.context.freshnessState === "STALE" ||
        agent.context.freshnessState === "AGING" ||
        agent.context.freshnessState === "INACTIVE")
    ) {
      const daysSinceUpdate = Math.floor(
        (Date.now() - agent.context.lastSignificantUpdateAt.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      needsAttention.push(
        `Context is ${agent.context.freshnessState} — last updated ${daysSinceUpdate} days ago. ` +
          `Publish an updated context to keep matching active.`
      );
    }

    if (unreadInboxEvents.length > 0) {
      needsAttention.push(
        `You have ${unreadInboxEvents.length} undelivered inbox event(s). ` +
          `Run check_in to receive them.`
      );
    }

    const proposedWaitingConfirmation = normalisedMatches.filter(
      (m) => m.status === "PROPOSED" && !m.confirmedByMe
    );
    if (proposedWaitingConfirmation.length > 0) {
      needsAttention.push(
        `You have ${proposedWaitingConfirmation.length} proposed match(es) waiting for your confirmation. ` +
          `Use confirm_match to respond.`
      );
    }

    const proposedWaitingOther = normalisedMatches.filter(
      (m) => m.status === "PROPOSED" && !m.confirmedByOther
    );
    if (proposedWaitingOther.length > 0) {
      needsAttention.push(
        `You have ${proposedWaitingOther.length} proposed match(es) awaiting confirmation from the other party.`
      );
    }

    const negotiatingMatches = normalisedMatches.filter(
      (m) => m.status === "NEGOTIATING"
    );
    if (negotiatingMatches.length > 0) {
      needsAttention.push(
        `You have ${negotiatingMatches.length} active negotiation(s) in progress.`
      );
    }

    // --- Assemble result ---
    const result = {
      owner,
      agent: agentProfile,
      context,
      beacons,
      matches: matchesByStatus,
      unreadInboxEvents: unreadInboxEvents.map((e) => ({
        id: e.id,
        type: e.type,
        referenceId: e.referenceId,
        payload: e.payload,
        createdAt: e.createdAt,
      })),
      hasPublishedContext,
      searchPaused: agent.searchPaused,
      hasUnreadMatches,
      needsAttention,
    };

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
};
