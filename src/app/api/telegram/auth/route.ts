import { NextRequest, NextResponse } from "next/server";
import {
  issueUnifiedToken,
  redactTelegramSecrets,
  TelegramAuthError,
  verifyInitData,
} from "@/lib/telegram/auth";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { initData?: unknown };
    if (typeof body.initData !== "string") {
      return NextResponse.json({ ok: false, error: "initData is required" }, { status: 400 });
    }

    const verified = verifyInitData(body.initData);
    const issued = await issueUnifiedToken(verified);

    return NextResponse.json({
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
      telegram: {
        id: verified.telegramId,
        username: verified.user.username ?? null,
        authDate: verified.authDate.toISOString(),
        startParam: verified.startParam,
      },
    });
  } catch (error) {
    if (error instanceof TelegramAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    console.error("[telegram-auth] failed:", redactTelegramSecrets(error));
    return NextResponse.json({ ok: false, error: "Telegram auth failed" }, { status: 500 });
  }
}
