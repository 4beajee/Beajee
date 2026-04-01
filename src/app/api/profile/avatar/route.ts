import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedOwner } from "@/lib/auth";
import { safeErrorResponse } from "@/lib/api-error";
import { rateLimit } from "@/lib/rate-limit";
import sharp from "sharp";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const AVATAR_SIZE = 256;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// POST /api/profile/avatar — upload a profile photo
export async function POST(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, {
      maxRequests: 5,
      windowMs: 60_000,
      keyPrefix: "avatar-upload",
    });
    if (rateLimited) return rateLimited;

    const auth = await getAuthenticatedOwner();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("avatar") as File | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP, and GIF images are allowed" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File must be under 5 MB" },
        { status: 400 }
      );
    }

    // Read file buffer and resize with sharp
    const buffer = Buffer.from(await file.arrayBuffer());
    const resized = await sharp(buffer)
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "centre" })
      .jpeg({ quality: 80, progressive: true })
      .toBuffer();

    // Convert to data URL
    const dataUrl = `data:image/jpeg;base64,${resized.toString("base64")}`;

    // Save to Owner.image
    await prisma.owner.update({
      where: { id: auth.ownerId },
      data: { image: dataUrl },
    });

    return NextResponse.json({ image: dataUrl });
  } catch (error) {
    return safeErrorResponse(error, "Failed to upload avatar");
  }
}

// DELETE /api/profile/avatar — remove profile photo
export async function DELETE(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, {
      maxRequests: 5,
      windowMs: 60_000,
      keyPrefix: "avatar-delete",
    });
    if (rateLimited) return rateLimited;

    const auth = await getAuthenticatedOwner();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.owner.update({
      where: { id: auth.ownerId },
      data: { image: null },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return safeErrorResponse(error, "Failed to remove avatar");
  }
}
