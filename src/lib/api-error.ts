import { NextResponse } from "next/server";

/**
 * Return a safe error response that doesn't leak internal details in production.
 */
export function safeErrorResponse(
  error: unknown,
  fallbackMessage = "Internal server error",
  status = 500
) {
  if (process.env.NODE_ENV === "development") {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ error: fallbackMessage }, { status });
}
