import { NextRequest, NextResponse } from "next/server";
import { verifyEmailWithToken } from "@/lib/tokens";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    return NextResponse.redirect(new URL("/login?verification=invalid", request.url));
  }

  const email = await verifyEmailWithToken(token);
  return NextResponse.redirect(
    new URL(email ? "/login?verification=success" : "/login?verification=invalid", request.url)
  );
}
