import { prisma } from "@/lib/db";
import { escapeTelegramHtml } from "@/lib/services/telegram";
import { sendOwnerTopicMessage } from "@/lib/telegram/topics";

export type TeamSpaceEventKind =
  | "task_proposed"
  | "task_completed"
  | "approval_requested"
  | "strategy_session_done"
  | "blocker_flagged";

async function notifyTeamSpace(args: {
  communityId: string;
  kind: TeamSpaceEventKind;
  text: string;
}) {
  const community = await prisma.community.findUnique({
    where: { id: args.communityId },
    select: {
      id: true,
      name: true,
      status: true,
      teamMode: true,
    },
  });

  if (!community || community.status !== "ACTIVE" || !community.teamMode) {
    return { sent: 0, skipped: true };
  }

  const members = await prisma.communityMember.findMany({
    where: {
      communityId: args.communityId,
      status: "ACTIVE",
    },
    select: {
      ownerId: true,
    },
  });

  const text =
    `<b>${escapeTelegramHtml(community.name)} · Team Space</b>\n` +
    `${args.text}\n` +
    `<code>${escapeTelegramHtml(args.kind)}</code>`;

  const results = await Promise.all(
    members.map((member) =>
      sendOwnerTopicMessage({
        ownerId: member.ownerId,
        topic: "team_space",
        text,
      })
    )
  );

  return {
    sent: results.filter((result) => result.sent).length,
    skipped: false,
  };
}

export function notifyTaskProposed(args: {
  communityId: string;
  title: string;
  riskLevel: string;
  requiresHitl: boolean;
  creatorId: string;
}) {
  return notifyTeamSpace({
    communityId: args.communityId,
    kind: "task_proposed",
    text:
      `<b>Task proposed</b>\n` +
      `Title: ${escapeTelegramHtml(args.title)}\n` +
      `Risk: ${escapeTelegramHtml(args.riskLevel)}\n` +
      `Creator: ${escapeTelegramHtml(args.creatorId)}\n` +
      `HITL: ${args.requiresHitl ? "required" : "not required"}`,
  });
}

export function notifyTaskCompleted(args: {
  communityId: string;
  title: string;
  completedBy: string;
}) {
  return notifyTeamSpace({
    communityId: args.communityId,
    kind: "task_completed",
    text:
      `<b>Task completed</b>\n` +
      `Title: ${escapeTelegramHtml(args.title)}\n` +
      `Completed by: ${escapeTelegramHtml(args.completedBy)}`,
  });
}

export function notifyApprovalRequested(args: {
  communityId: string;
  title: string;
  riskLevel: string;
  requestedBy: string;
  explanation: string;
}) {
  return notifyTeamSpace({
    communityId: args.communityId,
    kind: "approval_requested",
    text:
      `<b>Approval requested</b>\n` +
      `Task: ${escapeTelegramHtml(args.title)}\n` +
      `Risk: ${escapeTelegramHtml(args.riskLevel)}\n` +
      `Requested by: ${escapeTelegramHtml(args.requestedBy)}\n` +
      `${escapeTelegramHtml(args.explanation)}`,
  });
}

export function notifyStrategySessionDone(args: {
  communityId: string;
  status: string;
  summary: string;
  actionProposals: number;
}) {
  return notifyTeamSpace({
    communityId: args.communityId,
    kind: "strategy_session_done",
    text:
      `<b>Strategy session ${escapeTelegramHtml(args.status)}</b>\n` +
      `${escapeTelegramHtml(args.summary)}\n` +
      `Action proposals: ${args.actionProposals}`,
  });
}

export function notifyBlockerFlagged(args: {
  communityId: string;
  actorId: string;
  contentPreview: string;
}) {
  return notifyTeamSpace({
    communityId: args.communityId,
    kind: "blocker_flagged",
    text:
      `<b>Blocker flagged</b>\n` +
      `Actor: ${escapeTelegramHtml(args.actorId)}\n` +
      `${escapeTelegramHtml(args.contentPreview)}`,
  });
}

export const __test = {
  notifyTeamSpace,
};
