import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { OnboardingSchema } from "@/types/onboarding";
import { TelegramAuthError, verifyUnifiedToken } from "@/lib/telegram/auth";
import { completeOwnerOnboarding } from "@/lib/services/owner-onboarding";

function bearer(request: NextRequest) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
}

export async function POST(request: NextRequest) {
  try {
    const auth = verifyUnifiedToken(bearer(request));
    const input = OnboardingSchema.parse(await request.json());
    const result = await completeOwnerOnboarding({
      ownerId: auth.ownerId,
      input,
      locale: "en",
      baseUrl: request.nextUrl.origin,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof TelegramAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: error.issues[0]?.message ?? "Invalid onboarding data" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Onboarding failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
