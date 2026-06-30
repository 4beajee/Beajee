import { prisma } from "@/lib/db";
import { createInboxEvent } from "@/lib/services/inbox";
import { signalAgentWork } from "@/lib/services/agent-delivery";
import { findOverlappingCallSlots } from "@/lib/services/calendar-slots";
import type { MatchCallStatus, Prisma } from "@prisma/client";
import { sendTelegramCallRequest } from "@/lib/telegram/match-card";
import { createZoomMeeting, isZoomConfigured } from "@/lib/zoom-provider";

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
  return prisma.matchCall.upsert({
    where: { matchId },
    create: { matchId, status: "IDLE" },
    update: {},
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
  payload: Prisma.InputJsonValue;
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

async function maybeGenerateZoomLink(matchId: string, callId: string) {
  const updated = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${`zoom-provision:${callId}`}, 0))
    `;
    const call = await tx.matchCall.findUnique({ where: { id: callId } });
    if (!call || call.zoomUrl || !call.wantsCallByA || !call.wantsCallByB) return call;
    if (!isZoomConfigured()) return call;

    const { zoomUrl, zoomMeetingId, zoomPassword } = await createZoomMeeting({
      matchId,
      scheduledAt: call.scheduledAt,
      durationMinutes: call.durationMinutes,
    });
    return tx.matchCall.update({
      where: { id: callId },
      data: {
        zoomUrl,
        zoomMeetingId,
        zoomPassword,
        status: call.scheduledAt ? "CONFIRMED" : "LINK_READY",
        linkGeneratedAt: new Date(),
      },
    });
  });
  if (!updated?.zoomUrl) return updated;
  const zoomUrl = updated.zoomUrl;
  const zoomMeetingId = updated.zoomMeetingId;
  const zoomPassword = updated.zoomPassword;

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
  const finalCall = (bothWant ? await maybeGenerateZoomLink(matchId, call.id) : updated) ?? updated;

  if (!alreadyWanted) {
    sendTelegramCallRequest({
      ownerId: participants.isOwnerA ? participants.ownerBId : participants.ownerAId,
      matchId,
      requesterName: participants.isOwnerA ? participants.ownerAName : participants.ownerBName,
    }).catch(() => undefined);
  }

  return {
    matchId,
    wantsCallByMe: true,
    wantsCallByOther: participants.isOwnerA ? finalCall.wantsCallByB : finalCall.wantsCallByA,
    bothWantCall: bothWant,
    zoomUrl: finalCall.zoomUrl,
    meetingProvisioned: Boolean(finalCall.zoomUrl),
    providerConfigured: isZoomConfigured(),
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

export function validateCallSlots(slots: Array<{ start: string; end: string }>, now = new Date()) {
  if (slots.length < 1 || slots.length > 5) throw new Error("Provide between 1 and 5 time slots");
  const horizon = now.getTime() + 90 * 24 * 60 * 60 * 1000;
  const normalized = slots.map((slot) => {
    const start = new Date(slot.start);
    const end = new Date(slot.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error("Call slots must use valid ISO 8601 timestamps");
    }
    const duration = end.getTime() - start.getTime();
    if (start.getTime() <= now.getTime() || start.getTime() > horizon) {
      throw new Error("Call slots must be in the future and within 90 days");
    }
    if (duration < 15 * 60_000 || duration > 120 * 60_000) {
      throw new Error("Call slots must be between 15 and 120 minutes");
    }
    return { start, end };
  });
  for (let index = 1; index < normalized.length; index++) {
    if (normalized[index].start <= normalized[index - 1].start) {
      throw new Error("Call slots must be unique and ordered by start time");
    }
  }
  return normalized;
}

export async function proposeCallTime(
  matchId: string,
  proposedByOwnerId: string,
  slots: Array<{ start: string; end: string }>
) {
  const validatedSlots = validateCallSlots(slots);

  const participants = await loadMatchParticipants(matchId, proposedByOwnerId);
  const call = await getOrCreateMatchCall(matchId);
  const recipientOwnerId = participants.isOwnerA ? participants.ownerBId : participants.ownerAId;
  const recipientAgentId = participants.isOwnerA ? participants.agentBId : participants.agentAId;
  const proposerName = participants.isOwnerA ? participants.ownerAName : participants.ownerBName;

  const created = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${`call-proposals:${call.id}`}, 0))
    `;
    await tx.matchCallProposal.updateMany({
      where: { matchCallId: call.id, status: "PENDING" },
      data: { status: "EXPIRED" },
    });
    const proposals = await Promise.all(
      validatedSlots.map((slot) =>
        tx.matchCallProposal.create({
          data: {
            matchCallId: call.id,
            proposedByOwnerId,
            slotStart: slot.start,
            slotEnd: slot.end,
            status: "PENDING",
          },
        })
      )
    );
    await tx.matchCall.update({
      where: { id: call.id },
      data: { status: "TIME_PROPOSED", proposedByOwnerId },
    });
    return proposals;
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
  const { call, proposal, updated } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${`call-confirm:${matchId}`}, 0))
    `;
    const currentCall = await tx.matchCall.findUnique({
      where: { matchId },
      include: { proposals: { where: { id: proposalId, status: "PENDING" } } },
    });
    if (!currentCall) throw new Error("Call record not found");
    const currentProposal = currentCall.proposals[0];
    if (!currentProposal) throw new Error("Proposal not found or already resolved");
    if (currentProposal.proposedByOwnerId === ownerId) {
      throw new Error("You cannot confirm your own proposal — wait for the other owner");
    }
    const now = new Date();
    const accepted = await tx.matchCallProposal.updateMany({
      where: { id: proposalId, matchCallId: currentCall.id, status: "PENDING" },
      data: { status: "ACCEPTED", confirmedAt: now },
    });
    if (accepted.count !== 1) throw new Error("Proposal not found or already resolved");
    await tx.matchCallProposal.updateMany({
      where: { matchCallId: currentCall.id, status: "PENDING", id: { not: proposalId } },
      data: { status: "DECLINED" },
    });
    const durationMinutes = Math.round(
      (currentProposal.slotEnd.getTime() - currentProposal.slotStart.getTime()) / 60_000
    );
    const nextCall = await tx.matchCall.update({
      where: { id: currentCall.id },
      data: {
        scheduledAt: currentProposal.slotStart,
        durationMinutes,
        confirmedAt: now,
        status: "CONFIRMED",
        wantsCallByA: true,
        wantsCallByB: true,
      },
    });
    return { call: currentCall, proposal: currentProposal, updated: nextCall };
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

  const finalCall = (updated.zoomUrl ? updated : await maybeGenerateZoomLink(matchId, call.id)) ?? updated;

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
