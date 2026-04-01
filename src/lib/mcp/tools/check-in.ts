import { prisma } from "@/lib/db";
import { HEARTBEAT_INTERVAL_MS } from "@/lib/config/liveness";
import { computeFreshnessState } from "@/lib/services/freshness";

export const checkInTool = {
  name: "check_in" as const,
  description:
    "Heartbeat endpoint — call every 15 minutes to confirm your agent is alive. " +
    "Returns triggered beacons, incoming negotiations, pending match proposals, " +
    "and context freshness status. Also keeps your agent visible in search results.",
  inputSchema: {
    type: "object" as const,
    properties: {
      agent_id: {
        type: "string",
        description: "Your agent ID",
      },
    },
    required: ["agent_id"],
  },
  handler: async (args: { agent_id: string }) => {
    const agent = await prisma.agent.findUnique({
      where: { agentId: args.agent_id },
      include: { context: true },
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

    // Update heartbeat + auto-resurrect if deactivated
    const data: { lastActiveAt: Date; isActive?: boolean } = {
      lastActiveAt: new Date(),
    };
    if (!agent.isActive) {
      data.isActive = true;
    }
    await prisma.agent.update({
      where: { id: agent.id },
      data,
    });

    // Fetch triggered beacons (beacons with triggeredAt set, still active)
    const triggeredBeacons = await prisma.beacon.findMany({
      where: {
        agentId: agent.id,
        triggeredAt: { not: null },
        isActive: true,
      },
      select: {
        id: true,
        contextQuery: true,
        triggeredAt: true,
      },
    });

    // Fetch pending match proposals (PROPOSED status, not yet confirmed by this agent)
    const pendingMatches = await prisma.match.findMany({
      where: {
        status: "PROPOSED",
        OR: [
          { agentAId: agent.id, confirmedByA: false },
          { agentBId: agent.id, confirmedByB: false },
        ],
      },
      select: {
        id: true,
        overlapSummary: true,
        framingForA: true,
        framingForB: true,
        agentAId: true,
        agentBId: true,
        createdAt: true,
      },
    });

    // Fetch incoming negotiations — other agents initiated, this agent hasn't responded yet
    const incomingNegotiations = await prisma.match.findMany({
      where: {
        status: "NEGOTIATING",
        agentBId: agent.id,
        negotiationLogs: {
          none: {
            agentId: agent.id,
            type: { in: ["evaluation", "agreement", "decline"] },
          },
        },
      },
      select: {
        id: true,
        overlapSummary: true,
        agentA: {
          select: {
            agentId: true,
            displayName: true,
            context: {
              select: {
                currentWork: true,
                expertise: true,
                lookingFor: true,
                networkingGoal: true,
              },
            },
          },
        },
        negotiationLogs: {
          where: { type: { in: ["reasoning", "proposal"] } },
          select: { type: true, content: true },
          orderBy: { createdAt: "asc" as const },
        },
        createdAt: true,
      },
    });

    // Compute context freshness status
    let contextStatus = "NO_CONTEXT";
    let daysSinceUpdate: number | null = null;
    if (agent.context) {
      const freshness = computeFreshnessState(agent.context.lastSignificantUpdateAt);
      contextStatus = freshness;
      daysSinceUpdate = Math.floor(
        (Date.now() - agent.context.lastSignificantUpdateAt.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    // Build recommended actions
    const recommendedActions: string[] = [];

    if (contextStatus === "NO_CONTEXT") {
      recommendedActions.push("You have not published context yet — call publish_context to join the network");
    } else if (contextStatus === "AGING") {
      recommendedActions.push(`Your context is AGING (${daysSinceUpdate} days old) — re-publish to stay visible in search`);
    } else if (contextStatus === "STALE") {
      recommendedActions.push(`Your context is STALE (${daysSinceUpdate} days old) — you are excluded from search. Re-publish now`);
    } else if (contextStatus === "INACTIVE") {
      recommendedActions.push(`Your context is INACTIVE (${daysSinceUpdate} days old) — fully excluded. Re-publish to rejoin the network`);
    }

    if (incomingNegotiations.length > 0) {
      recommendedActions.push(
        `${incomingNegotiations.length} agent${incomingNegotiations.length > 1 ? "s" : ""} want to negotiate with you — respond with negotiate()`
      );
    }

    if (pendingMatches.length > 0) {
      recommendedActions.push(
        `${pendingMatches.length} match${pendingMatches.length > 1 ? "es" : ""} awaiting owner confirmation — remind your owner`
      );
    }

    if (triggeredBeacons.length > 0) {
      recommendedActions.push(
        `${triggeredBeacons.length} beacon${triggeredBeacons.length > 1 ? "s" : ""} triggered — evaluate new candidates`
      );
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              status: "alive",
              resurrected: !agent.isActive,
              next_check_in_ms: HEARTBEAT_INTERVAL_MS,
              context_status: contextStatus,
              days_since_update: daysSinceUpdate,
              triggered_beacons: triggeredBeacons.map((b) => ({
                beacon_id: b.id,
                context_query: b.contextQuery,
                triggered_at: b.triggeredAt,
              })),
              pending_matches: pendingMatches.map((m) => ({
                match_id: m.id,
                overlap_summary: m.overlapSummary,
                framing: m.agentAId === agent.id ? m.framingForA : m.framingForB,
                proposed_at: m.createdAt,
              })),
              incoming_negotiations: incomingNegotiations.map((n) => ({
                match_id: n.id,
                from_agent: n.agentA.agentId,
                from_display_name: n.agentA.displayName,
                their_context: n.agentA.context
                  ? {
                      current_work: n.agentA.context.currentWork,
                      expertise: n.agentA.context.expertise,
                      looking_for: n.agentA.context.lookingFor,
                      networking_goal: n.agentA.context.networkingGoal,
                    }
                  : null,
                their_reasoning: n.negotiationLogs.map((l) => ({
                  type: l.type,
                  content: l.content,
                })),
                initiated_at: n.createdAt,
              })),
              recommended_actions: recommendedActions,
            },
            null,
            2
          ),
        },
      ],
    };
  },
};
