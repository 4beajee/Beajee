import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { demoConfig } from "@/lib/config/demo";
import { runDemoResponderTick } from "@/lib/demo/responder-tick";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}` || !isAuthorizedCronRequest(request, authHeader ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!demoConfig.enabled) {
    return NextResponse.json({ success: true, skipped: "demo_disabled" });
  }

  try {
    const outcome = await runDemoResponderTick();
    return NextResponse.json({ success: true, ...outcome });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[demo-responder] Cron failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
