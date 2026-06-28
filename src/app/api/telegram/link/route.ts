import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { createTelegramLink } from "@/lib/telegram/link";
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
    const limited = rateLimit(request, {
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
    return safeErrorResponse(error, "Failed to create Telegram sync link");
  }
}
