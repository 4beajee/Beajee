import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  redactTelegramSecrets,
  TelegramAuthError,
  verifyUnifiedToken,
} from "@/lib/telegram/auth";
import { setOwnerSchedulingUrl } from "@/lib/services/owner-scheduling";

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

export async function GET(request: NextRequest) {
  try {
    const verified = verifyUnifiedToken(getBearerToken(request));
    const owner = await prisma.owner.findUnique({
      where: { id: verified.ownerId },
      select: {
        id: true,
        name: true,
        onboarded: true,
        schedulingUrl: true,
      },
    });

    if (!owner) {
      return NextResponse.json({ ok: false, error: "Owner not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, owner });
  } catch (error) {
    if (error instanceof TelegramAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("[telegram-profile] GET failed:", redactTelegramSecrets(error));
    return NextResponse.json({ ok: false, error: "Failed to load profile" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const verified = verifyUnifiedToken(getBearerToken(request));
    const body = (await request.json()) as { schedulingUrl?: unknown };

    if (body.schedulingUrl !== undefined && typeof body.schedulingUrl !== "string") {
      return NextResponse.json({ ok: false, error: "schedulingUrl must be a string" }, { status: 400 });
    }

    const owner = await setOwnerSchedulingUrl({
      ownerId: verified.ownerId,
      schedulingUrl:
        typeof body.schedulingUrl === "string" ? body.schedulingUrl : null,
    });

    return NextResponse.json({
      ok: true,
      schedulingUrl: owner.schedulingUrl,
    });
  } catch (error) {
    if (error instanceof TelegramAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message.includes("Cal.com")) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    console.error("[telegram-profile] PATCH failed:", redactTelegramSecrets(error));
    return NextResponse.json({ ok: false, error: "Failed to update profile" }, { status: 500 });
  }
}