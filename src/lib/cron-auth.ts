import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

export function isAuthorizedCronRequest(request: NextRequest, authHeader = request.headers.get("authorization") ?? "") {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = `Bearer ${secret}`;
  const actualBuffer = Buffer.from(authHeader);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
