import { NextRequest, NextResponse } from "next/server";
import {
  issueUnifiedTokenForOwner,
  issueUnifiedToken,
  redactTelegramSecrets,
  TelegramAuthError,
  verifyInitData,
} from "@/lib/telegram/auth";
import { getAuthenticatedOwner } from "@/lib/auth";
import { getTelegramBotUsername } from "@/lib/telegram/bot";
import { rateLimit } from "@/lib/rate-limit";
import { readLimitedJson, RequestBodyTooLargeError } from "@/lib/request-body";

function authResponse(issued: Awaited<ReturnType<typeof issueUnifiedTokenForOwner>>, telegram?: {
  id: string;
  username: string | null;
  authDate: string;
  startParam: string | null;
}) {
  return {
    ok: true,
    token: issued.token,
    expiresAt: issued.expiresAt.toISOString(),
    owner: {
      id: issued.owner.id,
      email: issued.owner.email,
      name: issued.owner.name,
      image: issued.owner.image,
      onboarded: issued.owner.onboarded,
      telegramId: issued.owner.telegramId,
      schedulingUrl: issued.owner.schedulingUrl,
    },
    telegram: telegram ?? (issued.owner.telegramId ? {
      id: issued.owner.telegramId,
      username: null,
      authDate: new Date().toISOString(),
      startParam: null,
    } : null),
    botUsername: getTelegramBotUsername() || null,
  };
}

export async function GET() {
  try {
    const auth = await getAuthenticatedOwner();
    if (!auth) {
      return NextResponse.json({ ok: false, error: "Open inside Telegram or sign in to Beajee" }, { status: 401 });
    }
    const issued = await issueUnifiedTokenForOwner(auth.ownerId);
    return NextResponse.json(authResponse(issued));
  } catch (error) {
    if (error instanceof TelegramAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Web App authentication failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimit(request, {
      maxRequests: 20,
      windowMs: 60_000,
      keyPrefix: "telegram-auth",
    });
    if (limited) return limited;
    const body = (await readLimitedJson(request, 16 * 1024)) as { initData?: unknown };
    if (typeof body.initData !== "string") {
      return NextResponse.json({ ok: false, error: "initData is required" }, { status: 400 });
    }

    if (body.initData.length > 12_000) {
      return NextResponse.json({ ok: false, error: "initData is too large" }, { status: 413 });
    }
    const verified = verifyInitData(body.initData);
    const issued = await issueUnifiedToken(verified);

    return NextResponse.json(authResponse(issued, {
        id: verified.telegramId,
        username: verified.user.username ?? null,
        authDate: verified.authDate.toISOString(),
        startParam: verified.startParam,
      }));
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ ok: false, error: "Request body is too large" }, { status: 413 });
    }
    if (error instanceof TelegramAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    console.error("[telegram-auth] failed:", redactTelegramSecrets(error));
    return NextResponse.json({ ok: false, error: "Telegram auth failed" }, { status: 500 });
  }
}
