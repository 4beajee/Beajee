import { NextRequest, NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/db";
import { getAuthenticatedOwner } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { DeleteAccountSchema } from "@/types/settings";
import { ZodError } from "zod";
import { DAILY_TELEGRAM_REPORT } from "@/lib/services/daily-telegram-report";

export async function POST(request: NextRequest) {
  try {
    const rateLimited = await rateLimit(request, {
      maxRequests: 3,
      windowMs: 300_000,
      keyPrefix: "delete-account",
    });
    if (rateLimited) return rateLimited;

    const auth = await getAuthenticatedOwner();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    let validated;
    try {
      validated = DeleteAccountSchema.parse(body);
    } catch (e) {
      if (e instanceof ZodError) {
        const firstError = e.issues[0]?.message ?? "Invalid input";
        return NextResponse.json({ error: firstError }, { status: 400 });
      }
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    if (validated.confirmEmail !== auth.email) {
      return NextResponse.json(
        { error: "Email does not match your account" },
        { status: 400 }
      );
    }

    // Cascade delete with retry for transient DB connection drops.
    // Most child relations use onDelete: Cascade at the DB level,
    // but we explicitly delete to avoid orphans on partial cascades.
    await withDbRetry(async () => {
      const agent = await prisma.agent.findUnique({
        where: { ownerId: auth.ownerId },
        select: { id: true },
      });

      await prisma.$transaction(async (tx) => {
        const owner = await tx.owner.findUnique({
          where: { id: auth.ownerId },
          select: { onboarded: true },
        });

        if (agent) {
          const matches = await tx.match.findMany({
            where: { OR: [{ agentAId: agent.id }, { agentBId: agent.id }] },
            select: { id: true },
          });
          const matchIds = matches.map((m) => m.id);

          if (matchIds.length > 0) {
            const chats = await tx.chat.findMany({
              where: { matchId: { in: matchIds } },
              select: { id: true },
            });
            const chatIds = chats.map((c) => c.id);

            if (chatIds.length > 0) {
              await tx.message.deleteMany({ where: { chatId: { in: chatIds } } });
              await tx.report.deleteMany({ where: { chatId: { in: chatIds } } });
              await tx.chat.deleteMany({ where: { id: { in: chatIds } } });
            }

            await tx.matchReaction.deleteMany({ where: { matchId: { in: matchIds } } });
            await tx.matchComment.deleteMany({ where: { matchId: { in: matchIds } } });
            await tx.negotiationLog.deleteMany({ where: { matchId: { in: matchIds } } });
            await tx.match.deleteMany({ where: { id: { in: matchIds } } });
          }

          await tx.beacon.deleteMany({ where: { agentId: agent.id } });
          await tx.agentContext.deleteMany({ where: { agentId: agent.id } });
          await tx.negotiationLog.deleteMany({ where: { agentId: agent.id } });
          await tx.agent.delete({ where: { id: agent.id } });
        }

        await tx.consentLog.deleteMany({ where: { ownerId: auth.ownerId } });
        await tx.block.deleteMany({
          where: { OR: [{ blockerId: auth.ownerId }, { blockedId: auth.ownerId }] },
        });
        await tx.report.deleteMany({ where: { reporterId: auth.ownerId } });
        await tx.account.deleteMany({ where: { userId: auth.ownerId } });
        await tx.analyticsEvent.create({
          data: {
            type: DAILY_TELEGRAM_REPORT.deletionEventType,
            metadata: {
              onboarded: owner?.onboarded ?? false,
              hadAgent: !!agent,
              source: "settings",
            },
          },
        });
        await tx.owner.delete({ where: { id: auth.ownerId } });
      }, { timeout: 30_000 });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[settings/delete-account] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
