import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  redactTelegramSecrets,
  TelegramAuthError,
  verifyUnifiedToken,
} from "@/lib/telegram/auth";
import { detectSchedulingProvider, schedulingProviderLabel } from "@/lib/scheduling-url";
import { getTelegramBearerToken } from "@/lib/telegram/bearer";

export async function GET(request: NextRequest) {
  try {
    const verified = verifyUnifiedToken(getTelegramBearerToken(request));
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

      const mySchedulingUrl = owner.schedulingUrl;
      const otherSchedulingUrl = otherOwner.schedulingUrl;

      if (otherSchedulingUrl && !mySchedulingUrl) {
        schedulingRole = "guest";
        partnerSchedulingUrl = otherSchedulingUrl;
        partnerSchedulingProvider = schedulingProviderLabel(
          detectSchedulingProvider(otherSchedulingUrl)
        );
      } else if (mySchedulingUrl) {
        schedulingRole = "host";
      }

      return {
        matchId: match.id,
        status: match.status,
        framingForMe,
        otherOwnerName: otherOwner.name,
        schedulingRole,
        partnerSchedulingUrl,
        partnerSchedulingProvider,
        schedulingHostName:
          schedulingRole === "guest" && otherSchedulingUrl ? otherOwner.name : null,
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