import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { createTelegramLink } from "@/lib/telegram/link";
import { redactTelegramSecrets } from "@/lib/telegram/auth";
import { safeErrorResponse } from "@/lib/api-error";

export async function GET() {
  const auth = await getAuthenticatedOwner();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owner = await prisma.owner.findUnique({
    where: { id: auth.ownerId },
    select: { telegramId: true },
  });
  return NextResponse.json({ connected: !!owner?.telegramId });
}

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimit(request, {
      maxRequests: 5,
      windowMs: 60_000,
      keyPrefix: "telegram-link",
    });
    if (limited) return limited;

    const auth = await getAuthenticatedOwner();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const owner = await prisma.owner.findUnique({
      where: { id: auth.ownerId },
      select: { telegramId: true },
    });
    if (owner?.telegramId) {
      return NextResponse.json({ connected: true, url: null });
    }

    const link = await createTelegramLink(auth.ownerId);
    return NextResponse.json({
      connected: false,
      url: link.url,
      expiresAt: link.expiresAt.toISOString(),
    });
  } catch (error) {
    const safeMessage = redactTelegramSecrets(
      error instanceof Error ? error.message : String(error)
    );
    console.error("[telegram-link] failed:", safeMessage);
    const configurationMissing =
      error instanceof Error && error.message === "TELEGRAM_BOT_USERNAME is not configured";
    return safeErrorResponse(
      error,
      configurationMissing
        ? "Telegram sync is temporarily unavailable"
        : "Failed to create Telegram sync link",
      configurationMissing ? 503 : 500
    );
  }
}
