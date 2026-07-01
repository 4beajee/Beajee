import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { redactTelegramSecrets } from "@/lib/telegram/auth";
import { runTelegramNegotiationProtocol } from "@/lib/telegram/negotiation";
import { readLimitedJson, RequestBodyTooLargeError } from "@/lib/request-body";
import { rateLimit } from "@/lib/rate-limit";

function isAuthorized(request: NextRequest) {
  const secret =
    process.env.TELEGRAM_NEGOTIATION_SECRET?.trim() ||
    process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ||
    "";
  if (!secret) return process.env.NODE_ENV !== "production";

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const telegramSecret = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  return bearer === secret || telegramSecret === secret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const limited = await rateLimit(request, {
      maxRequests: 30,
      windowMs: 60_000,
      keyPrefix: "telegram-negotiation",
    });
    if (limited) return limited;
    const payload = await readLimitedJson(request, 32 * 1024);
    const result = await runTelegramNegotiationProtocol(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ ok: false, error: "Request body is too large" }, { status: 413 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: error.issues[0]?.message ?? "Invalid negotiation payload" },
        { status: 400 }
      );
    }

    console.error("[telegram-negotiation] failed:", redactTelegramSecrets(error));
    return NextResponse.json({ ok: false, error: "Telegram negotiation failed" }, { status: 500 });
  }
}
