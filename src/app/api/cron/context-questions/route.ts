import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { createWeeklyContextQuestionBatches } from "@/lib/services/context-questions";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}` ||
    !isAuthorizedCronRequest(request, authHeader ?? "")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const limit = Math.min(
      500,
      Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? "100") || 100)
    );
    const result = await createWeeklyContextQuestionBatches({ limit });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[context-questions] Cron failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
