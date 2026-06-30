import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type InboxEventType =
  | "NEW_MESSAGE"
  | "MATCH_PROPOSED"
  | "MATCH_CONFIRMED"
  | "BEACON_TRIGGERED"
  | "FRESHNESS_WARNING"
  | "PRIVACY_SETTINGS_CHANGED"
  | "NETWORKING_GOAL_CHANGED"
  | "AGENT_SEARCH_PAUSED"
  | "AGENT_SEARCH_RESUMED"
  | "WAKEUP_TEST_CONFIRMATION"
  | "CONTEXT_QUESTION_BATCH"
  | "TEAM_ACTIVITY"
  | "TEAM_BLOCKER_LOGGED"
  | "TEAM_TASK_ASSIGNED"
  | "TEAM_TASK_APPROVAL_REQUESTED"
  | "CALL_TIME_PROPOSED"
  | "CALL_TIME_CONFIRMED"
  | "ZOOM_LINK_READY"
  | "PROFILE_COMPLETION_SUGGESTION";

interface CreateArgs {
  ownerId: string;
  agentId: string;
  type: InboxEventType;
  referenceId: string;
  payload: Prisma.InputJsonValue;
}

export async function createInboxEvent(args: CreateArgs) {
  return prisma.inboxEvent.create({
    data: {
      ownerId: args.ownerId,
      agentId: args.agentId,
      type: args.type,
      referenceId: args.referenceId,
      payload: args.payload,
    },
  });
}

export async function getUndeliveredEvents(agentId: string) {
  return prisma.inboxEvent.findMany({
    where: { agentId, dismissedAt: null },
    orderBy: { createdAt: "asc" },
  });
}

export async function markDelivered(eventIds: string[]) {
  if (eventIds.length === 0) return;
  await prisma.inboxEvent.updateMany({
    where: { id: { in: eventIds }, deliveredAt: null },
    data: { deliveredAt: new Date() },
  });
}

export async function markDismissed(eventIds: string[], agentId: string) {
  if (eventIds.length === 0) return { count: 0 };
  return prisma.inboxEvent.updateMany({
    where: { id: { in: eventIds }, agentId },
    data: { dismissedAt: new Date() },
  });
}
