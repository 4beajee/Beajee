import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedOwner } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, {
      maxRequests: 3,
      windowMs: 300_000,
      keyPrefix: "regen-key",
    });
    if (rateLimited) return rateLimited;

    const auth = await getAuthenticatedOwner();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agent = await prisma.agent.findUnique({
      where: { ownerId: auth.ownerId },
    });

    if (!agent) {
      return NextResponse.json({ error: "No agent found" }, { status: 404 });
    }

    const newKey = `gny_${crypto.randomBytes(32).toString("hex")}`;

    await prisma.agent.update({
      where: { id: agent.id },
      data: { apiKey: newKey },
    });

    return NextResponse.json({ apiKey: newKey });
  } catch (err) {
    console.error("[settings/regenerate-key] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
