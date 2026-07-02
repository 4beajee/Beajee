import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const ANALYTICS_ADMIN_SECRET_ENV = "ANALYTICS_ADMIN_SECRET";
export const FOUNDER_ANALYTICS_SECRET_ENV = "FOUNDER_ANALYTICS_SECRET";

function hasBearerSecret(request: NextRequest, expected: string) {
  const actual = request.headers.get("authorization") ?? "";
  const wanted = `Bearer ${expected}`;
  const actualBuffer = Buffer.from(actual);
  const wantedBuffer = Buffer.from(wanted);
  return actualBuffer.length === wantedBuffer.length && timingSafeEqual(actualBuffer, wantedBuffer);
}

export function requireAnalyticsAdmin(request: NextRequest) {
  const expected = process.env[ANALYTICS_ADMIN_SECRET_ENV];
  if (!expected) {
    return NextResponse.json(
      { error: `${ANALYTICS_ADMIN_SECRET_ENV} not configured` },
      { status: 500 }
    );
  }

  if (!hasBearerSecret(request, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

/** Read-only credential for the founder's private analytics agent. */
export function requireFounderAnalytics(request: NextRequest) {
  const expected = process.env[FOUNDER_ANALYTICS_SECRET_ENV];
  if (!expected) {
    return NextResponse.json(
      { error: `${FOUNDER_ANALYTICS_SECRET_ENV} not configured` },
      { status: 503 }
    );
  }

  if (!hasBearerSecret(request, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
