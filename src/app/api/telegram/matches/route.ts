import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  redactTelegramSecrets,
  TelegramAuthError,
  verifyUnifiedToken,
} from "@/lib/telegram/auth";
import { detectSchedulingProvider, schedulingProviderLabel } from "@/lib/scheduling-url";

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

export async function GET(request: NextRequest) {
  try {
    const verified = verifyUnifiedToken(getBearerToken(request));
    const owner = await prisma.owner.findUnique({
      where: { id: verified.ownerId },
      include: { agent: true },
    });

    if (!owner?.agent) {
      return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 404 });
    }

    const matches = await prisma.match.findMany({
      where: {
        OR: [{ agentAId: owner.agent.id }, { agentBId: owner.agent.id }],
        status: { in: ["PROPOSED", "MATCHED"] },
      },
      include: {
        agentA: { include: { owner: true } },
        agentB: { include: { owner: true } },
      },
      orderBy: { proposedAt: "desc" },
      take: 20,
    });

    const result = matches.map((match) => {
      const isAgentA = match.agentAId === owner.agent!.id;
      const otherOwner = isAgentA ? match.agentB.owner : match.agentA.owner;
      const framingForMe = isAgentA ? match.framingForA : match.framingForB;

      let schedulingRole: "guest" | "host" | null = null;
      let partnerSchedulingUrl: string | null = null;
      let partnerSchedulingProvider: string | null = null;

      if (match.schedulingHostOwnerId && match.schedulingGuestOwnerId) {
        const hostOwner =
          match.agentA.owner.id === match.schedulingHostOwnerId
            ? match.agentA.owner
            : match.agentB.owner;

        if (owner.id === match.schedulingGuestOwnerId) {
          schedulingRole = "guest";
          partnerSchedulingUrl = hostOwner.schedulingUrl;
          if (partnerSchedulingUrl) {
            partnerSchedulingProvider = schedulingProviderLabel(
              detectSchedulingProvider(partnerSchedulingUrl)
            );
          }
        } else if (owner.id === match.schedulingHostOwnerId) {
          schedulingRole = "host";
        }
      }

      return {
        matchId: match.id,
        status: match.status,
        framingForMe,
        otherOwnerName: otherOwner.name,
        schedulingRole,
        partnerSchedulingUrl,
        partnerSchedulingProvider,
        schedulingHostName: match.schedulingHostOwnerId
          ? (match.agentA.owner.id === match.schedulingHostOwnerId
              ? match.agentA.owner.name
              : match.agentB.owner.name)
          : null,
      };
    });

    return NextResponse.json({
      ok: true,
      matches: result,
      schedulingUrl: owner.schedulingUrl,
    });
  } catch (error) {
    if (error instanceof TelegramAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("[telegram-matches] failed:", redactTelegramSecrets(error));
    return NextResponse.json({ ok: false, error: "Failed to load matches" }, { status: 500 });
  }
}