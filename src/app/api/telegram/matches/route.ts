import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { MatchActionSchema } from "@/types/match-action";
import { confirmMatch, markDormant } from "@/lib/services/negotiation";
import { getPrivacySyncStatus } from "@/lib/services/privacy-sync";
import { detectSchedulingProvider, schedulingProviderLabel } from "@/lib/scheduling-url";
import { TelegramAuthError, verifyUnifiedToken } from "@/lib/telegram/auth";

function bearer(request: NextRequest) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
}

export async function GET(request: NextRequest) {
  try {
    const auth = verifyUnifiedToken(bearer(request));
    const owner = await prisma.owner.findUnique({
      where: { id: auth.ownerId },
      include: { agent: true },
    });
    if (!owner) return NextResponse.json({ ok: false, error: "Owner not found" }, { status: 404 });
    if (!owner.agent) {
      return NextResponse.json({ ok: true, needsOnboarding: true, matches: [], freshnessState: null });
    }

    const matches = await prisma.match.findMany({
      where: {
        OR: [{ agentAId: owner.agent.id }, { agentBId: owner.agent.id }],
        status: { in: ["PROPOSED", "MATCHED", "DORMANT"] },
      },
      include: {
        agentA: { include: { owner: true, context: true } },
        agentB: { include: { owner: true, context: true } },
        chat: {
          include: {
            messages: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
        call: {
          include: {
            proposals: {
              where: { status: "PENDING" },
              orderBy: { slotStart: "asc" },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const result = await Promise.all(matches.map(async (match) => {
      const isAgentA = match.agentAId === owner.agent!.id;
      const otherAgent = isAgentA ? match.agentB : match.agentA;
      const confirmedByMe = isAgentA ? match.confirmedByA : match.confirmedByB;
      const confirmedByOther = isAgentA ? match.confirmedByB : match.confirmedByA;
      const lastReadAt = match.chat ? (isAgentA ? match.chat.lastReadByA : match.chat.lastReadByB) : null;
      const unreadCount = match.chat
        ? await prisma.message.count({
            where: {
              chatId: match.chat.id,
              fromOwner: { not: owner.id },
              ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
            },
          })
        : 0;

      let schedulingRole: "guest" | "host" | null = null;
      let partnerSchedulingUrl: string | null = null;
      let partnerSchedulingProvider: string | null = null;
      let schedulingHostName: string | null = null;
      if (match.schedulingHostOwnerId && match.schedulingGuestOwnerId) {
        const hostOwner = match.agentA.owner.id === match.schedulingHostOwnerId
          ? match.agentA.owner
          : match.agentB.owner;
        schedulingHostName = hostOwner.name;
        if (owner.id === match.schedulingGuestOwnerId) {
          schedulingRole = "guest";
          partnerSchedulingUrl = hostOwner.schedulingUrl;
          if (partnerSchedulingUrl) {
            partnerSchedulingProvider = schedulingProviderLabel(detectSchedulingProvider(partnerSchedulingUrl));
          }
        } else if (owner.id === match.schedulingHostOwnerId) {
          schedulingRole = "host";
        }
      }

      const call = match.call;
      return {
        matchId: match.id,
        status: match.status,
        overlapSummary: match.overlapSummary,
        framingForMe: isAgentA ? match.framingForA : match.framingForB,
        confirmedByMe,
        confirmedByOther,
        initiatedByMe: match.initiatorAgentId === owner.agent!.id,
        otherPerson: {
          id: otherAgent.owner.id,
          name: otherAgent.owner.name,
          image: otherAgent.owner.image,
          currentWork: otherAgent.context?.currentWork ?? null,
          expertise: otherAgent.context?.expertise ?? [],
          location: otherAgent.context?.location ?? null,
          profession: otherAgent.context?.ownerProfession ?? null,
        },
        chatId: match.chat?.id ?? null,
        chatStatus: match.chat?.status ?? null,
        unreadCount,
        lastMessage: match.chat?.messages[0]
          ? {
              content: match.chat.messages[0].content,
              fromOwner: match.chat.messages[0].fromOwner,
              createdAt: match.chat.messages[0].createdAt,
            }
          : null,
        proposedAt: match.proposedAt,
        matchedAt: match.matchedAt,
        schedulingRole,
        partnerSchedulingUrl,
        partnerSchedulingProvider,
        schedulingHostName,
        call: call ? {
          status: call.status,
          wantsCallByMe: isAgentA ? call.wantsCallByA : call.wantsCallByB,
          wantsCallByOther: isAgentA ? call.wantsCallByB : call.wantsCallByA,
          zoomUrl: call.zoomUrl,
          scheduledAt: call.scheduledAt,
          proposals: call.proposals.map((proposal) => ({
            proposalId: proposal.id,
            start: proposal.slotStart,
            end: proposal.slotEnd,
            proposedByMe: proposal.proposedByOwnerId === owner.id,
          })),
        } : null,
      };
    }));

    const context = await prisma.agentContext.findUnique({
      where: { agentId: owner.agent.id },
      select: { freshnessState: true },
    });
    const privacySync = await getPrivacySyncStatus(owner.agent.id);
    return NextResponse.json({
      ok: true,
      needsOnboarding: false,
      matches: result,
      freshnessState: context?.freshnessState ?? null,
      privacySync,
      schedulingUrl: owner.schedulingUrl,
    });
  } catch (error) {
    if (error instanceof TelegramAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("[telegram-matches] GET failed:", error);
    return NextResponse.json({ ok: false, error: "Failed to load matches" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = verifyUnifiedToken(bearer(request));
    const input = MatchActionSchema.parse(await request.json());
    const result = input.action === "confirm"
      ? await confirmMatch(input.matchId, auth.ownerId)
      : await markDormant(input.matchId, auth.ownerId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof TelegramAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: error.issues[0]?.message ?? "Invalid match action" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Match action failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
