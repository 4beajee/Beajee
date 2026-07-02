import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedOwner } from "@/lib/auth";
import { safeErrorResponse } from "@/lib/api-error";
import { rateLimit } from "@/lib/rate-limit";
import { OnboardingSchema } from "@/types/onboarding";
import { loadMessages } from "@/i18n/messages";
import { resolveLocale } from "@/i18n/config";
import { ZodError } from "zod";
import { completeOwnerOnboarding } from "@/lib/services/owner-onboarding";

export async function POST(request: NextRequest) {
  try {
    const locale = resolveLocale({
      cookie: request.headers.get("cookie"),
      acceptLanguage: request.headers.get("accept-language"),
    });
    const messages = await loadMessages(locale);

    const rateLimited = await rateLimit(request, { maxRequests: 5, windowMs: 60_000, keyPrefix: "onboarding" });
    if (rateLimited) return rateLimited;

    const auth = await getAuthenticatedOwner();
    if (!auth) {
      return NextResponse.json({ error: messages.onboarding.errors.unauthorized }, { status: 401 });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: messages.onboarding.errors.invalidBody }, { status: 400 });
    }

    let validated;
    try {
      validated = OnboardingSchema.parse(body);
    } catch (e) {
      if (e instanceof ZodError) {
        return NextResponse.json({ error: messages.onboarding.errors.invalidInput }, { status: 400 });
      }
      return NextResponse.json({ error: messages.onboarding.errors.invalidInput }, { status: 400 });
    }

    const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL;
    const baseUrl = new URL(configuredBaseUrl || request.nextUrl.origin).origin;
    return NextResponse.json(await completeOwnerOnboarding({
      ownerId: auth.ownerId,
      input: validated,
      locale,
      baseUrl,
    }));
  } catch (error) {
    const locale = resolveLocale({
      cookie: request.headers.get("cookie"),
      acceptLanguage: request.headers.get("accept-language"),
    });
    const messages = await loadMessages(locale);
    return safeErrorResponse(error, messages.onboarding.errors.completeFailed);
  }
}
