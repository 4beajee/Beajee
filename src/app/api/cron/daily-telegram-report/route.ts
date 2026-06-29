import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runDailyTelegramReport } from "@/lib/services/daily-telegram-report";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await runDailyTelegramReport());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[daily-telegram-report] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
