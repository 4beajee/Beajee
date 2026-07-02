import { NextRequest, NextResponse } from "next/server";
import { requireFounderAnalytics } from "@/lib/admin-analytics/auth";
import { buildFounderWeeklySnapshot } from "@/lib/admin-analytics/bundle";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const authError = requireFounderAnalytics(request);
  if (authError) return authError;

  try {
    const snapshot = await buildFounderWeeklySnapshot();
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[founder-analytics] Weekly snapshot failed:", message);
    return NextResponse.json({ error: "Unable to build founder analytics snapshot" }, { status: 500 });
  }
}
