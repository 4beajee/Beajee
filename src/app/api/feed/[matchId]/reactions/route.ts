import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// POST /api/feed/[matchId]/reactions
// Body: { type: "LIKE" | "DISLIKE" }
// Toggle logic: same type again → remove; different type → switch
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { matchId } = await params;
  const body = await req.json();
  const type = body.type;

  if (type !== "LIKE" && type !== "DISLIKE") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const ownerId = session.user.id as string;

  // Check match exists and is public
  const match = await prisma.match.findFirst({
    where: { id: matchId, isPublic: true, status: "MATCHED" },
    select: { id: true },
  });
  if (!match) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.matchReaction.findUnique({
    where: { matchId_ownerId: { matchId, ownerId } },
  });

  let userReaction: string | null = null;

  if (existing) {
    if (existing.type === type) {
      // Same type → remove reaction
      await prisma.matchReaction.delete({ where: { id: existing.id } });
    } else {
      // Different type → switch
      await prisma.matchReaction.update({
        where: { id: existing.id },
        data: { type },
      });
      userReaction = type;
    }
  } else {
    // No existing → create
    await prisma.matchReaction.create({
      data: { matchId, ownerId, type },
    });
    userReaction = type;
  }

  // Return updated counts
  const [likes, dislikes] = await Promise.all([
    prisma.matchReaction.count({ where: { matchId, type: "LIKE" } }),
    prisma.matchReaction.count({ where: { matchId, type: "DISLIKE" } }),
  ]);

  return NextResponse.json({ likes, dislikes, userReaction });
}
