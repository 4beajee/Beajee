import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { createInboxEvent } from "@/lib/services/inbox";
import { signalAgentWork } from "@/lib/services/agent-delivery";
import { findOverlappingCallSlots } from "@/lib/services/calendar-slots";
import type { MatchCallStatus } from "@prisma/client";

interface MatchParticipants {
  matchId: string;
  isOwnerA: boolean;
  ownerAId: string;
  ownerBId: string;
  agentAId: string;
  agentBId: string;
  agentAExternalId: string;
  agentBExternalId: string;
  ownerAName: string | null;
  ownerBName: string | null;
  chatId: string | null;
}

async function loadMatchParticipants(matchId: string, ownerId?: string): Promise<MatchParticipants> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      agentA: { include: { owner: true } },
      agentB: { include: { owner: true } },
      chat: { select: { id: true } },
      call: true,
    },
  });

  if (!match) throw new Error(`Match not found: ${matchId}`);
  if (match.status !== "MATCHED") {
    throw new Error(`Match must be MATCHED to schedule a call (current: ${match.status})`);
  }

  if (ownerId) {
    const isParticipant =
      match.agentA.owner.id === ownerId || match.agentB.owner.id === ownerId;
    if (!isParticipant) throw new Error("You are not a participant of this match");
  }

  const isOwnerA = ownerId ? match.agentA.owner.id === ownerId : false;

  return {
    matchId,
    isOwnerA,
    ownerAId: match.agentA.owner.id,
    ownerBId: match.agentB.owner.id,
    agentAId: match.agentA.id,
    agentBId: match.agentB.id,
    agentAExternalId: match.agentA.agentId,
    agentBExternalId: match.agentB.agentId,
    ownerAName: match.agentA.owner.name,
    ownerBName: match.agentB.owner.name,
    chatId: match.chat?.id ?? null,
  };
}

export async function getOrCreateMatchCall(matchId: string) {
  const existing = await prisma.matchCall.findUnique({ where: { matchId } });
  if (existing) return existing;

  return prisma.matchCall.create({
    data: { matchId, status: "IDLE" },
  });
}

function formatSlotLabel(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const date = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const startTime = start.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  });
  const endTime = end.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  });
  return `${date}, ${startTime}–${endTime} UTC`;
}

async function postChatSystemMessage(
  chatId: string,
  kind: "ZOOM_CALL_LINK" | "ZOOM_CALL_PROPOSAL" | "ZOOM_CALL_CONFIRMED",
  content: string
) {
  await prisma.message.create({
    data: {
      chatId,
      fromOwner: "system",
      kind,
      content,
    },
  });
}

async function notifyAgent(args: {
  ownerId: string;
  agentId: string;
  type: "CALL_TIME_PROPOSED" | "CALL_TIME_CONFIRMED" | "ZOOM_LINK_READY";
  referenceId: string;
  payload: Record<string, unknown>;
  workKind: "CALL_TIME_PROPOSED" | "CALL_TIME_CONFIRMED" | "ZOOM_LINK_READY";
  reason: string;
}) {
  await createInboxEvent({
    ownerId: args.ownerId,
    agentId: args.agentId,
    type: args.type,
    referenceId: args.referenceId,
    payload: args.payload,
  }).catch((err) => console.error("[match-call] inbox event failed:", err));

  signalAgentWork({
    agentId: args.agentId,
    kind: args.workKind,
    reason: args.reason,
    referenceId: args.referenceId,
    urgency: "high",
  }).catch((err) => console.error("[match-call] wake signal failed:", err));
}

export function generateZoomMeeting(matchId: string) {
  const salt = process.env.ZOOM_LINK_SALT ?? "beajee";
  const hash = createHash("sha256").update(`${matchId}:${salt}`).digest("hex");
  const meetingId = String((parseInt(hash.slice(0, 12), 16) % 9_000_000_000) + 1_000_000_000);
  const password = createHash("sha256").update(`${matchId}:${salt}:pwd`).digest("hex").slice(0, 6);
  const zoomUrl = `https://zoom.us/j/${meetingId}?pwd=${password}`;

  return { zoomUrl, zoomMeetingId: meetingId, zoomPassword: password };
}

async function maybeGenerateZoomLink(matchId: string, callId: string) {
  const call = await prisma.matchCall.findUnique({ where: { id: callId } });
  if (!call || call.zoomUrl) return call;

  const bothWant = call.wantsCallByA && call.wantsCallByB;
  if (!bothWant) return call;

  const { zoomUrl, zoomMeetingId, zoomPassword } = generateZoomMeeting(matchId);
  const now = new Date();

  const updated = await prisma.matchCall.update({
    where: { id: callId },
    data: {
      zoomUrl,
      zoomMeetingId,
      zoomPassword,
      status: call.scheduledAt ? "CONFIRMED" : "LINK_READY",
      linkGeneratedAt: now,
    },
  });

  const participants = await loadMatchParticipants(matchId);
  const scheduledNote = updated.scheduledAt
    ? ` Scheduled for ${formatSlotLabel(updated.scheduledAt.toISOString(), new Date(updated.scheduledAt.getTime() + updated.durationMinutes * 60_000).toISOString())}.`
    : "";

  const linkMessage =
    `Zoom call link is ready.${scheduledNote}\n\nJoin: ${zoomUrl}` +
    (zoomPassword ? `\nPassword: ${zoomPassword}` : "");

  if (participants.chatId) {
    await postChatSystemMessage(participants.chatId, "ZOOM_CALL_LINK", linkMessage);
  }

  const payload = {
    match_id: matchId,
    zoom_url: zoomUrl,
    zoom_meeting_id: zoomMeetingId,
    zoom_password: zoomPassword,
    scheduled_at: updated.scheduledAt?.toISOString() ?? null,
    chat_id: participants.chatId,
  };

  await Promise.all([
    notifyAgent({
      ownerId: participants.ownerAId,
      agentId: participants.agentAId,
      type: "ZOOM_LINK_READY",
      referenceId: matchId,
      payload: {
        ...payload,
        other_owner_name: participants.ownerBName,
      },
      workKind: "ZOOM_LINK_READY",
      reason: "Zoom link ready — deliver to owner",
    }),
    notifyAgent({
      ownerId: participants.ownerBId,
      agentId: participants.agentBId,
      type: "ZOOM_LINK_READY",
      referenceId: matchId,
      payload: {
        ...payload,
        other_owner_name: participants.ownerAName,
      },
      workKind: "ZOOM_LINK_READY",
      reason: "Zoom link ready — deliver to owner",
    }),
  ]);

  return updated;
}

export async function initializeMatchCallGoal(matchId: string) {
  return getOrCreateMatchCall(matchId);
}

export async function requestZoomCall(matchId: string, ownerId: string) {
  const participants = await loadMatchParticipants(matchId, ownerId);
  const call = await getOrCreateMatchCall(matchId);

  const wantsField = participants.isOwnerA ? "wantsCallByA" : "wantsCallByB";
  const alreadyWanted = participants.isOwnerA ? call.wantsCallByA : call.wantsCallByB;

  const updated = await prisma.matchCall.update({
    where: { id: call.id },
    data: {
      [wantsField]: true,
      status: call.status === "IDLE" ? "SCHEDULING" : call.status,
    },
  });

  const bothWant = updated.wantsCallByA && updated.wantsCallByB;
  const finalCall = bothWant ? await maybeGenerateZoomLink(matchId, call.id) : updated;

  return {
    matchId,
    wantsCallByMe: true,
    wantsCallByOther: participants.isOwnerA ? finalCall.wantsCallByB : finalCall.wantsCallByA,
    bothWantCall: bothWant,
    zoomUrl: finalCall.zoomUrl,
    status: finalCall.status,
    newlyRequested: !alreadyWanted,
  };
}

export async function findCallSlotsForMatch(matchId: string, agentExternalId?: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      agentA: { include: { owner: true } },
      agentB: { include: { owner: true } },
    },
  });
  if (!match) throw new Error(`Match not found: ${matchId}`);
  if (match.status !== "MATCHED") {
    throw new Error(`Match must be MATCHED to find call slots (current: ${match.status})`);
  }

  if (agentExternalId) {
    const isParticipant =
      match.agentA.agentId === agentExternalId || match.agentB.agentId === agentExternalId;
    if (!isParticipant) throw new Error("Agent is not part of this match");
  }

  return findOverlappingCallSlots(match.agentA.owner.id, match.agentB.owner.id);
}

export async function proposeCallTime(
  matchId: string,
  proposedByOwnerId: string,
  slots: Array<{ start: string; end: string }>
) {
  if (!slots.length) throw new Error("At least one time slot is required");

  const participants = await loadMatchParticipants(matchId, proposedByOwnerId);
  const call = await getOrCreateMatchCall(matchId);
  const recipientOwnerId = participants.isOwnerA ? participants.ownerBId : participants.ownerAId;
  const recipientAgentId = participants.isOwnerA ? participants.agentBId : participants.agentAId;
  const proposerName = participants.isOwnerA ? participants.ownerAName : participants.ownerBName;

  await prisma.matchCallProposal.updateMany({
    where: { matchCallId: call.id, status: "PENDING" },
    data: { status: "EXPIRED" },
  });

  const created = await Promise.all(
    slots.slice(0, 5).map((slot) =>
      prisma.matchCallProposal.create({
        data: {
          matchCallId: call.id,
          proposedByOwnerId,
          slotStart: new Date(slot.start),
          slotEnd: new Date(slot.end),
          status: "PENDING",
        },
      })
    )
  );

  await prisma.matchCall.update({
    where: { id: call.id },
    data: {
      status: "TIME_PROPOSED",
      proposedByOwnerId,
    },
  });

  const slotLabels = created.map((p) => formatSlotLabel(p.slotStart.toISOString(), p.slotEnd.toISOString()));
  const proposalMessage =
    `${proposerName ?? "Your match"} proposed call times:\n` +
    slotLabels.map((label, i) => `${i + 1}. ${label}`).join("\n") +
    "\n\nReply with the number that works, or suggest another time.";

  if (participants.chatId) {
    await postChatSystemMessage(participants.chatId, "ZOOM_CALL_PROPOSAL", proposalMessage);
  }

  await notifyAgent({
    ownerId: recipientOwnerId,
    agentId: recipientAgentId,
    type: "CALL_TIME_PROPOSED",
    referenceId: matchId,
    payload: {
      match_id: matchId,
      proposed_by_owner_name: proposerName,
      proposals: created.map((p) => ({
        proposal_id: p.id,
        start: p.slotStart.toISOString(),
        end: p.slotEnd.toISOString(),
        label: formatSlotLabel(p.slotStart.toISOString(), p.slotEnd.toISOString()),
      })),
      chat_id: participants.chatId,
      action: "Ask your owner which slot works and call confirm_call_time.",
    },
    workKind: "CALL_TIME_PROPOSED",
    reason: "Call time proposed — confirm with owner",
  });

  return {
    matchId,
    status: "TIME_PROPOSED" as MatchCallStatus,
    proposals: created.map((p) => ({
      proposalId: p.id,
      start: p.slotStart.toISOString(),
      end: p.slotEnd.toISOString(),
      label: formatSlotLabel(p.slotStart.toISOString(), p.slotEnd.toISOString()),
    })),
  };
}

export async function confirmCallTime(matchId: string, ownerId: string, proposalId: string) {
  const participants = await loadMatchParticipants(matchId, ownerId);
  const call = await prisma.matchCall.findUnique({
    where: { matchId },
    include: { proposals: { where: { id: proposalId, status: "PENDING" } } },
  });
  if (!call) throw new Error("Call record not found");
  const proposal = call.proposals[0];
  if (!proposal) throw new Error("Proposal not found or already resolved");
  if (proposal.proposedByOwnerId === ownerId) {
    throw new Error("You cannot confirm your own proposal — wait for the other owner");
  }

  const now = new Date();
  const durationMinutes = Math.max(
    15,
    Math.round((proposal.slotEnd.getTime() - proposal.slotStart.getTime()) / 60_000)
  );

  await prisma.matchCallProposal.update({
    where: { id: proposalId },
    data: { status: "ACCEPTED", confirmedAt: now },
  });
  await prisma.matchCallProposal.updateMany({
    where: { matchCallId: call.id, status: "PENDING", id: { not: proposalId } },
    data: { status: "DECLINED" },
  });

  const updated = await prisma.matchCall.update({
    where: { id: call.id },
    data: {
      scheduledAt: proposal.slotStart,
      durationMinutes,
      confirmedAt: now,
      status: call.zoomUrl ? "CONFIRMED" : "CONFIRMED",
      wantsCallByA: true,
      wantsCallByB: true,
    },
  });

  const proposerOwnerId = proposal.proposedByOwnerId;
  const proposerAgentId =
    proposerOwnerId === participants.ownerAId ? participants.agentAId : participants.agentBId;
  const confirmerName = participants.isOwnerA ? participants.ownerAName : participants.ownerBName;
  const slotLabel = formatSlotLabel(proposal.slotStart.toISOString(), proposal.slotEnd.toISOString());

  const confirmMessage = `${confirmerName ?? "Your match"} confirmed the call for ${slotLabel}.`;
  if (participants.chatId) {
    await postChatSystemMessage(participants.chatId, "ZOOM_CALL_CONFIRMED", confirmMessage);
  }

  await notifyAgent({
    ownerId: proposerOwnerId,
    agentId: proposerAgentId,
    type: "CALL_TIME_CONFIRMED",
    referenceId: matchId,
    payload: {
      match_id: matchId,
      confirmed_by_owner_name: confirmerName,
      scheduled_at: proposal.slotStart.toISOString(),
      slot_label: slotLabel,
      chat_id: participants.chatId,
    },
    workKind: "CALL_TIME_CONFIRMED",
    reason: "Call time confirmed — notify owner",
  });

  const finalCall = updated.zoomUrl ? updated : await maybeGenerateZoomLink(matchId, call.id);

  return {
    matchId,
    status: finalCall.status,
    scheduledAt: finalCall.scheduledAt?.toISOString() ?? null,
    zoomUrl: finalCall.zoomUrl,
    slotLabel,
  };
}

export async function getMatchCallStatus(matchId: string, ownerId?: string) {
  const participants = ownerId ? await loadMatchParticipants(matchId, ownerId) : null;
  const call = await prisma.matchCall.findUnique({
    where: { matchId },
    include: {
      proposals: {
        where: { status: "PENDING" },
        orderBy: { slotStart: "asc" },
      },
    },
  });

  if (!call) {
    return {
      matchId,
      status: "IDLE" as MatchCallStatus,
      wantsCallByMe: false,
      wantsCallByOther: false,
      bothWantCall: false,
      zoomUrl: null,
      scheduledAt: null,
      proposals: [],
    };
  }

  const wantsCallByMe = participants
    ? participants.isOwnerA
      ? call.wantsCallByA
      : call.wantsCallByB
    : false;
  const wantsCallByOther = participants
    ? participants.isOwnerA
      ? call.wantsCallByB
      : call.wantsCallByA
    : false;

  return {
    matchId,
    status: call.status,
    wantsCallByMe,
    wantsCallByOther,
    bothWantCall: call.wantsCallByA && call.wantsCallByB,
    zoomUrl: call.zoomUrl,
    zoomMeetingId: call.zoomMeetingId,
    zoomPassword: call.zoomPassword,
    scheduledAt: call.scheduledAt?.toISOString() ?? null,
    linkGeneratedAt: call.linkGeneratedAt?.toISOString() ?? null,
    proposals: call.proposals.map((p) => ({
      proposalId: p.id,
      start: p.slotStart.toISOString(),
      end: p.slotEnd.toISOString(),
      label: formatSlotLabel(p.slotStart.toISOString(), p.slotEnd.toISOString()),
      proposedByMe: ownerId ? p.proposedByOwnerId === ownerId : false,
    })),
  };
}

export async function generateZoomLinkNow(matchId: string, ownerId: string) {
  const participants = await loadMatchParticipants(matchId, ownerId);
  const call = await getOrCreateMatchCall(matchId);

  await prisma.matchCall.update({
    where: { id: call.id },
    data: { wantsCallByA: true, wantsCallByB: true },
  });

  const finalCall = await maybeGenerateZoomLink(matchId, call.id);
  return {
    matchId,
    zoomUrl: finalCall?.zoomUrl ?? null,
    status: finalCall?.status ?? call.status,
    chatId: participants.chatId,
  };
}